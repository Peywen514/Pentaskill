import { randomBytes, randomUUID } from 'node:crypto';
import { AuthError, normalizeEmail, validatePassword, profile, hashPassword, verifyPassword, digest, SESSION_MS } from './auth-core.mjs';

export class D1AuthStore {
  constructor(db) {
    this.db = db;
    this.dummyHash = `scrypt$32768$8$3$${randomBytes(16).toString('hex')}$${randomBytes(64).toString('hex')}`;
  }
  async limit(key, maximum, now = Date.now()) {
    const row = await this.db.prepare(`INSERT INTO auth_limits(key,count,until_at) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET count = CASE WHEN until_at <= ? THEN 1 ELSE count + 1 END,
      until_at = CASE WHEN until_at <= ? THEN excluded.until_at ELSE until_at END RETURNING count`).bind(digest(key), now + 900000, now, now).first();
    await this.db.prepare('DELETE FROM auth_limits WHERE until_at < ?').bind(now - 86400000).run();
    if (row.count > maximum) throw new AuthError('嘗試次數較多，請於 15 分鐘後再試', 429);
  }
  async createUser({ email, password, name }, role = 'student') {
    email = normalizeEmail(email); validatePassword(password);
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) throw new AuthError('稱呼需為 2–50 個字');
    if (!['student','instructor','admin'].includes(role)) throw new AuthError('無效的帳號身分');
    const passwordHash = await hashPassword(password), id = randomUUID();
    try { await this.db.prepare('INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)').bind(id,email,name.trim(),passwordHash,role,Date.now()).run(); }
    catch (error) { if (await this.db.prepare('SELECT id FROM users WHERE email=?').bind(email).first()) throw new AuthError('無法建立帳號；若已註冊，請改用登入', 409); throw error; }
    return profile(await this.db.prepare('SELECT * FROM users WHERE id=?').bind(id).first());
  }
  async login({ email, password }, ip) {
    await this.limit(`login-ip:${ip}`,30);
    let normalized;
    try { normalized=normalizeEmail(email); } catch { throw new AuthError('電子郵件或密碼不正確',401); }
    await this.limit(`login-account:${normalized}`,10);
    if (typeof password !== 'string' || password.length < 1 || password.length > 128) throw new AuthError('電子郵件或密碼不正確',401);
    const user=await this.db.prepare('SELECT * FROM users WHERE email=?').bind(normalized).first();
    const valid=await verifyPassword(password,user?.password_hash??this.dummyHash);
    if (!user || !user.active || !valid) throw new AuthError('電子郵件或密碼不正確',401);
    return profile(user);
  }
  async createSession(userId,now=Date.now()) {
    const token=randomBytes(32).toString('base64url');
    await this.db.batch([
      this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now),
      this.db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').bind(digest(token),userId,now+SESSION_MS,now)
    ]);
    return token;
  }
  async userFromToken(token,now=Date.now()) {
    if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) return null;
    const user=await this.db.prepare(`SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id
      WHERE sessions.token_hash=? AND sessions.expires_at>? AND users.active=1`).bind(digest(token),now).first();
    return user?profile(user):null;
  }
  async logout(token) { if (typeof token==='string' && token) await this.db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(digest(token)).run(); }
  async requireRole(token,roles) {
    const user=await this.userFromToken(token);
    if (!user) throw new AuthError('請先登入',401);
    if (!roles.includes(user.role)) throw new AuthError('此帳號沒有操作權限',403);
    return user;
  }
  async listMembers({ search='',role='',page=1 }={}) {
    const query=memberQuery({search,role,page});
    const result=await this.db.batch([
      this.db.prepare(`SELECT count(*) AS total FROM users ${query.where}`).bind(...query.values),
      this.db.prepare(`SELECT id,name,email,role,active,email_verified,created_at FROM users ${query.where} ORDER BY created_at DESC,id LIMIT 25 OFFSET ?`).bind(...query.values,(query.page-1)*25)
    ]);
    return { members:result[1].results.map(memberProfile),total:result[0].results[0].total,page:query.page,pageSize:25 };
  }
}

export function memberQuery({ search='',role='',page=1 }) {
  if (typeof search!=='string' || search.length>100 || !['','student','instructor','admin'].includes(role) || !Number.isInteger(Number(page)) || Number(page)<1 || Number(page)>10000) throw new AuthError('篩選條件不正確');
  const terms=[],values=[];
  if (search.trim()) { terms.push("(lower(email) LIKE ? ESCAPE '\\' OR lower(name) LIKE ? ESCAPE '\\')"); const pattern='%'+search.trim().toLowerCase().replace(/[\\%_]/g,'\\$&')+'%';values.push(pattern,pattern); }
  if (role) { terms.push('role=?');values.push(role); }
  return {where:terms.length?'WHERE '+terms.join(' AND '):'',values,page:Number(page)};
}
export function memberProfile(user) { return { id:user.id,name:user.name,email:user.email,role:user.role,active:Boolean(user.active),emailVerified:Boolean(user.email_verified),createdAt:new Date(user.created_at).toISOString() }; }
