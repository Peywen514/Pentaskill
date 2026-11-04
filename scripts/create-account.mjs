import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { AuthStore } from '../server/auth.mjs';
import { existsSync } from 'node:fs';

if (!process.env.AUTH_DB_PATH && existsSync(new URL('../deployment.json', import.meta.url))) throw new Error('正式會員已搬至 D1。本機工具請明確設定測試用 AUTH_DB_PATH，避免修改搬移前的備份資料庫。');

if (!stdin.isTTY) throw new Error('請在互動式終端執行 npm run account:create，密碼不接受命令列參數');
const rl = createInterface({ input: stdin, output: stdout, terminal: true });
let hidden = false;
const write = rl._writeToOutput.bind(rl);
rl._writeToOutput = text => { if (!hidden) write(text); };
const ask = text => new Promise(resolve => rl.question(text, resolve));
async function password(prompt) { stdout.write(prompt); hidden = true; try { return await ask(''); } finally { hidden = false; stdout.write('\n'); } }
let store;
try {
  const email = await ask('電子郵件：');
  const name = await ask('顯示名稱：');
  const role = (await ask('身分 student / instructor / admin：')).trim();
  if (!['student', 'instructor', 'admin'].includes(role)) throw new Error('請輸入有效身分');
  const secret = await password('密碼（8–128 字元，不顯示輸入）：');
  const repeated = await password('再輸入一次密碼：');
  if (secret !== repeated) throw new Error('兩次密碼不一致');
  store = new AuthStore(process.env.AUTH_DB_PATH ?? fileURLToPath(new URL('../.data/pentaskill.sqlite', import.meta.url)));
  const user = await store.createUser({ email, name, password: secret }, role);
  console.log(`已建立 ${user.role} 帳號：${user.email}。沒有預設密碼或公開提權入口。`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { rl.close(); store?.close(); }
