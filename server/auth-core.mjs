import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const SESSION_MS = 8 * 60 * 60 * 1000;
const COST = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export const digest = value => createHash('sha256').update(value).digest('hex');
let activeDerivations = 0;
async function derive(password, salt) {
  if (activeDerivations >= 2) throw new AuthError('目前登入人數較多，請稍後再試', 429);
  activeDerivations++;
  try { return await scrypt(password, salt, 64, COST); } finally { activeDerivations--; }
}
export class AuthError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function normalizeEmail(value) {
  if (typeof value !== 'string') throw new AuthError('請填寫有效的電子郵件');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError('請填寫有效的電子郵件');
  return email;
}
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new AuthError('密碼需為 8–128 個字元');
}
export function profile(user) { return { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: Boolean(user.email_verified) }; }
export async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt);
  return `scrypt$32768$8$3$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [algorithm, n, r, p, salt, encoded] = stored.split('$');
  if (algorithm !== 'scrypt' || n !== '32768' || r !== '8' || p !== '3' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(encoded)) return false;
  const hash = await derive(password, salt);
  return timingSafeEqual(hash, Buffer.from(encoded, 'hex'));
}

export function sessionToken(req, secure = false) {
  const name = secure ? '__Host-pentaskill_session' : 'pentaskill_session';
  const matches = (req.headers.cookie ?? '').split(';').map(s => s.trim()).filter(s => s.startsWith(`${name}=`));
  return matches.length === 1 ? matches[0].slice(name.length + 1) : '';
}
export function sessionCookie(token, secure = false, clear = false) {
  return `${secure ? '__Host-' : ''}pentaskill_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_MS / 1000}${secure ? '; Secure' : ''}`;
}
