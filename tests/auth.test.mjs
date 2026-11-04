import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { AuthStore, authHandler, sessionCookie } from '../server/auth.mjs';

const secret = 'only-for-memory-tests-2026';
const userData = (email = 'student@example.test') => ({ email, name: '測試學員', password: secret });

test('密碼有獨立隨機 Salt；回應不含密碼；雜湊不能當密碼登入', async () => {
  const store = new AuthStore();
  try {
    const user = await store.createUser(userData()); await store.createUser(userData('second@example.test'));
    const rows = store.db.prepare('SELECT password_hash FROM users').all();
    assert.notEqual(rows[0].password_hash, rows[1].password_hash);
    assert.ok(rows.every(r => r.password_hash.startsWith('scrypt$32768$8$3$') && !r.password_hash.includes(secret)));
    assert.equal(user.password_hash, undefined); assert.equal(user.password, undefined);
    assert.equal((await store.login({ email: ' STUDENT@EXAMPLE.TEST ', password: secret }, 'unit')).id, user.id);
    await assert.rejects(store.login({ email: user.email, password: rows[0].password_hash }, 'unit'), e => e.status === 401);
  } finally { store.close(); }
});

test('Session 原文不寫進資料庫，過期與登出後無法使用', async () => {
  const store = new AuthStore();
  try {
    const user = await store.createUser(userData()); const now = Date.now(); const token = store.createSession(user.id, now);
    assert.notEqual(store.db.prepare('SELECT token_hash FROM sessions').get().token_hash, token);
    assert.equal(store.userFromToken(token).id, user.id);
    assert.equal(store.userFromToken(token, now + 8 * 3600000), null);
    store.logout(token); assert.equal(store.userFromToken(token), null);
  } finally { store.close(); }
});

test('HTTPS Cookie 有 HttpOnly、SameSite、Secure、__Host 及登出清除設定', () => {
  const cookie = sessionCookie('test', true); assert.match(cookie, /^__Host-/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /; Secure/); assert.doesNotMatch(cookie, /Domain=/); assert.match(sessionCookie('', true, true), /Max-Age=0/);
});

test('拒絕弱密碼、重複信箱與無效帳號資料', async () => {
  const store = new AuthStore();
  try {
    await assert.rejects(store.createUser({ ...userData(), password: 'short' })); await assert.rejects(store.createUser({ ...userData(), email: 'invalid' })); await assert.rejects(store.createUser({ ...userData(), name: '' }));
    await store.createUser(userData()); await assert.rejects(store.createUser(userData('STUDENT@example.test')), e => e.status === 409);
  } finally { store.close(); }
});

test('登入嘗試有帳號與來源限流', async () => {
  const store = new AuthStore();
  try { for (let i = 0; i < 10; i++) await assert.rejects(store.login({ email: 'missing@example.test', password: secret }, 'rate'), e => e.status === 401); await assert.rejects(store.login({ email: 'missing@example.test', password: secret }, 'rate'), e => e.status === 429); }
  finally { store.close(); }
});

test('SQLite 重開後會員及 Session 仍存在', async t => {
  const parent = resolve(tmpdir()); const dir = mkdtempSync(join(parent, 'pentaskill-auth-'));
  t.after(() => { const target = resolve(dir); if (!target.startsWith(parent + sep) || !basename(target).startsWith('pentaskill-auth-')) throw new Error('Unsafe test cleanup path'); rmSync(target, { recursive: true }); });
  const path = join(dir, 'test.sqlite'); let store = new AuthStore(path);
  const user = await store.createUser(userData()); const token = store.createSession(user.id); store.close();
  store = new AuthStore(path); try { assert.equal(store.userFromToken(token).id, user.id); } finally { store.close(); }
});

test('HTTP 註冊、登入、角色授權、CSRF 與登出完整流程', async t => {
  const store = new AuthStore(); let handler;
  const server = createServer((req, res) => handler(req, res, new URL(req.url, 'http://localhost')));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`; handler = authHandler(store, { origin });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); });
  const post = (path, data, cookie = '', extra = {}) => fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-PentaSkill-Client': 'web', Cookie: cookie, ...extra }, body: JSON.stringify(data) });
  const get = (path, cookie = '') => fetch(origin + path, { headers: { Cookie: cookie } });
  assert.equal((await get('/api/admin/status')).status, 401);
  assert.equal((await post('/api/auth/register', userData(), '', { Origin: 'https://other.example' })).status, 403);
  assert.equal((await post('/api/auth/register', userData(), '', { 'X-PentaSkill-Client': '' })).status, 403);
  assert.equal((await post('/api/auth/register', userData(), '', { 'Content-Type': 'text/plain' })).status, 415);
  const registration = await post('/api/auth/register', { ...userData(), role: 'admin', purchasedCourses: ['all'] });
  assert.equal(registration.status, 201); const body = await registration.json(); assert.equal(body.user.role, 'student'); assert.equal(body.user.emailVerified, false); assert.equal(body.user.purchasedCourses, undefined);
  const cookie = registration.headers.get('set-cookie').split(';')[0]; assert.match(registration.headers.get('set-cookie'), /HttpOnly/);
  assert.equal((await get('/api/workspace', cookie)).status, 200);
  assert.equal((await get('/api/admin/status', cookie)).status, 403);
  assert.equal((await get('/api/instructor/status', cookie)).status, 403);
  assert.equal((await post('/api/auth/login', { email: body.user.email, password: 'wrong' })).status, 401);
  const login = await post('/api/auth/login', { email: body.user.email, password: secret }, cookie); assert.equal(login.status, 200);
  const next = login.headers.get('set-cookie').split(';')[0]; assert.notEqual(next, cookie);
  assert.equal((await (await get('/api/auth/session', cookie)).json()).user, null);
  const loggedOut = await post('/api/auth/logout', {}, next); assert.equal(loggedOut.status, 200); assert.match(loggedOut.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await get('/api/workspace', next)).status, 401);
  const admin = await store.createUser(userData('admin@example.test'), 'admin'); const adminToken = store.createSession(admin.id);
  assert.equal((await get('/api/admin/status', `pentaskill_session=${adminToken}`)).status, 200);
  const instructor = await store.createUser(userData('instructor@example.test'), 'instructor'); const instructorToken = store.createSession(instructor.id);
  assert.equal((await get('/api/instructor/status', `pentaskill_session=${instructorToken}`)).status, 200);
  assert.equal((await get('/api/admin/status', `pentaskill_session=${instructorToken}`)).status, 403);
});
