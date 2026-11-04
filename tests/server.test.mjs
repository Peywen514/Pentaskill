import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
test('預覽伺服器只提供公開前端檔案並設定安全標頭', async t => {
  const port = 4187;
  const child = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: String(port), NODE_ENV: 'test', APP_ORIGIN: `http://127.0.0.1:${port}`, AUTH_DB_PATH: ':memory:' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('Preview server exited before ready'); })]);
  for (const path of ['/', '/src/app.js', '/assets/pentaskill-logo-transparent.png']) { const response = await fetch(`http://127.0.0.1:${port}${path}`); assert.equal(response.status, 200); assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); if (path.endsWith('.png')) assert.equal(response.headers.get('content-type'), 'image/png'); }
  for (const path of ['/.git/config', '/package.json', '/docs/architecture.md', '/missing', '/src/%5c..%5c.git%5cconfig']) assert.equal((await fetch(`http://127.0.0.1:${port}${path}`)).status, 404);
  assert.equal((await fetch(`http://127.0.0.1:${port}/`, { method: 'POST' })).status, 405);
});

test('舊本機預覽入口轉向雲端，不再由本機提供正式會員 API',async t=>{
  const port=4188;
  const child=spawn(process.execPath,['scripts/preview-cloud.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});t.after(()=>child.kill());
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('Redirect server failed');})]);
  const response=await fetch(`http://127.0.0.1:${port}/api/auth/session`,{redirect:'manual'});
  assert.equal(response.status,307);assert.equal(response.headers.get('location'),'https://pentaskill-v2.pey514514.workers.dev/api/auth/session');
});
