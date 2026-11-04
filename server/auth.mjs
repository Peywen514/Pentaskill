import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { AuthError, normalizeEmail, validatePassword, profile, hashPassword, verifyPassword, digest, SESSION_MS, sessionToken, sessionCookie } from './auth-core.mjs';
import { memberQuery, memberProfile } from './d1-store.mjs';
export { AuthError, normalizeEmail, hashPassword, sessionCookie } from './auth-core.mjs';

export class AuthStore {
  constructor(path = ':memory:') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
        password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','instructor','admin')),
        email_verified INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
      CREATE TABLE IF NOT EXISTS auth_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS role_changes (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
        previous_role TEXT NOT NULL, new_role TEXT NOT NULL, changed_at INTEGER NOT NULL
      );
    `);
    // 不存在的帳號也執行同等成本的密碼運算，不在回應中洩漏帳號是否存在。
    this.dummyHash = `scrypt$32768$8$3$${randomBytes(16).toString('hex')}$${randomBytes(64).toString('hex')}`;
  }
  close() { this.db.close(); }
  listMembers(options={}) {
    const query=memberQuery(options);
    const total=this.db.prepare(`SELECT count(*) AS total FROM users ${query.where}`).get(...query.values).total;
    const members=this.db.prepare(`SELECT id,name,email,role,active,email_verified,created_at FROM users ${query.where} ORDER BY created_at DESC,id LIMIT 25 OFFSET ?`).all(...query.values,(query.page-1)*25).map(memberProfile);
    return {members,total,page:query.page,pageSize:25};
  }
  // 僅供有後端主機權限的操作工具使用，不公開 HTTP 角色變更端點。
  setRole(email, role) {
    email = normalizeEmail(email);
    if (!['student', 'instructor', 'admin'].includes(role)) throw new AuthError('無效的帳號身分');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const user = this.db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(email);
      if (!user) throw new AuthError('找不到已註冊的有效帳號，請先註冊', 404);
      if (user.role !== role) {
        if (user.role === 'admin' && this.db.prepare("SELECT count(*) AS total FROM users WHERE role='admin' AND active=1").get().total <= 1) throw new AuthError('不可移除最後一位有效管理者');
        this.db.prepare('UPDATE users SET role=? WHERE id=?').run(role, user.id);
        this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
        this.db.prepare('INSERT INTO role_changes(id,user_id,previous_role,new_role,changed_at) VALUES (?,?,?,?,?)').run(randomUUID(), user.id, user.role, role, Date.now());
      }
      this.db.exec('COMMIT');
      return profile(this.db.prepare('SELECT * FROM users WHERE id=?').get(user.id));
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  limit(key, maximum, now = Date.now()) {
    const until = now + 15 * 60 * 1000;
    const row = this.db.prepare(`INSERT INTO auth_limits(key,count,until_at) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET count = CASE WHEN until_at <= ? THEN 1 ELSE count + 1 END,
      until_at = CASE WHEN until_at <= ? THEN excluded.until_at ELSE until_at END RETURNING count`).get(digest(key), until, now, now);
    this.db.prepare('DELETE FROM auth_limits WHERE until_at < ?').run(now - 86400000);
    if (row.count > maximum) throw new AuthError('嘗試次數較多，請於 15 分鐘後再試', 429);
  }
  async createUser({ email, password, name }, role = 'student') {
    email = normalizeEmail(email); validatePassword(password);
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) throw new AuthError('稱呼需為 2–50 個字');
    if (!['student', 'instructor', 'admin'].includes(role)) throw new AuthError('無效的帳號身分');
    const passwordHash = await hashPassword(password);
    const id = randomUUID();
    try { this.db.prepare('INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)').run(id, email, name.trim(), passwordHash, role, Date.now()); }
    catch (error) { if (error.code?.startsWith('ERR_SQLITE') && this.db.prepare('SELECT id FROM users WHERE email=?').get(email)) throw new AuthError('無法建立帳號；若已註冊，請改用登入', 409); throw error; }
    return profile(this.db.prepare('SELECT * FROM users WHERE id=?').get(id));
  }
  async login({ email, password }, ip) {
    this.limit(`login-ip:${ip}`, 30);
    let normalized;
    try { normalized = normalizeEmail(email); } catch { throw new AuthError('電子郵件或密碼不正確', 401); }
    this.limit(`login-account:${normalized}`, 10);
    if (typeof password !== 'string' || password.length < 1 || password.length > 128) throw new AuthError('電子郵件或密碼不正確', 401);
    const user = this.db.prepare('SELECT * FROM users WHERE email=?').get(normalized);
    const valid = await verifyPassword(password, user?.password_hash ?? this.dummyHash);
    if (!user || !user.active || !valid) throw new AuthError('電子郵件或密碼不正確', 401);
    return profile(user);
  }
  createSession(userId, now = Date.now()) {
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    const token = randomBytes(32).toString('base64url');
    this.db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').run(digest(token), userId, now + SESSION_MS, now);
    return token;
  }
  userFromToken(token, now = Date.now()) {
    if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) return null;
    const user = this.db.prepare(`SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id
      WHERE sessions.token_hash=? AND sessions.expires_at>? AND users.active=1`).get(digest(token), now);
    return user ? profile(user) : null;
  }
  logout(token) { if (typeof token === 'string') this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token)); }
  requireRole(token, roles) {
    const user = this.userFromToken(token);
    if (!user) throw new AuthError('請先登入', 401);
    if (!roles.includes(user.role)) throw new AuthError('此帳號沒有操作權限', 403);
    return user;
  }
}

export function authHandler(store, { origin, secure = false }) {
  return async (req, res, url) => {
    const send = (status, data, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }); res.end(JSON.stringify(data)); };
    try {
      if (req.headers.host !== new URL(origin).host) throw new AuthError('請使用設定的網站網址', 403);
      const token = sessionToken(req, secure);
      if (req.method === 'GET' && url.pathname === '/api/auth/session') { send(200, { user: store.userFromToken(token) }); return; }
      if (req.method === 'GET' && url.pathname === '/api/workspace') {
        const user = store.requireRole(token, ['student', 'instructor', 'admin']);
        send(200, { user, bookings: [], bookingSyncEnabled: false, workspace: user.role }); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/admin/status') {
        store.requireRole(token, ['admin']);
        send(200, { access: 'admin', coursePersistenceEnabled: false }); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/admin/members') {
        store.requireRole(token,['admin']);
        send(200,store.listMembers({search:url.searchParams.get('search')??'',role:url.searchParams.get('role')??'',page:url.searchParams.get('page')??1}));return;
      }
      if (req.method === 'GET' && url.pathname === '/api/instructor/status') {
        store.requireRole(token, ['instructor', 'admin']);
        send(200, { access: 'instructor', bookings: [], bookingSyncEnabled: false }); return;
      }
      if (req.method !== 'POST' || !['/api/auth/register', '/api/auth/login', '/api/auth/logout'].includes(url.pathname)) { send(404, { error: '找不到這個服務' }); return; }
      if (req.headers.origin !== origin || req.headers['x-pentaskill-client'] !== 'web' || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) throw new AuthError('請從本站操作', 403);
      if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new AuthError('請使用 JSON 格式', 415);
      if (Number(req.headers['content-length'] ?? 0) > 8192) throw new AuthError('資料超過允許大小', 413);
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 8192) throw new AuthError('資料超過允許大小', 413); chunks.push(chunk); }
      const raw = Buffer.concat(chunks).toString('utf8');
      let body;
      try { body = JSON.parse(raw); } catch { throw new AuthError('資料格式不正確'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AuthError('資料格式不正確');
      if (url.pathname === '/api/auth/logout') { store.logout(token); send(200, { user: null }, { 'Set-Cookie': sessionCookie('', secure, true) }); return; }
      let user;
      if (url.pathname === '/api/auth/register') {
        store.limit(`register-ip:${req.socket.remoteAddress}`, 5);
        // 明確忽略前端傳來的 role、權限、購課與餘額欄位。
        user = await store.createUser({ email: body.email, password: body.password, name: body.name }, 'student');
      } else user = await store.login(body, req.socket.remoteAddress);
      // 每次成功驗證都重新產生 Session，舊 Cookie 不升級沿用。
      store.logout(token);
      const fresh = store.createSession(user.id);
      send(url.pathname.endsWith('register') ? 201 : 200, { user }, { 'Set-Cookie': sessionCookie(fresh, secure) });
    } catch (error) { if (!(error instanceof AuthError)) console.error('[auth] request failed', error.code ?? error.name); send(error instanceof AuthError ? error.status : 500, { error: error instanceof AuthError ? error.message : '服務暫時無法處理，請稍後再試' }); }
  };
}
