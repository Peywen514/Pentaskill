import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { AuthStore } from '../server/auth.mjs';
import { existsSync } from 'node:fs';

if (!process.env.AUTH_DB_PATH && existsSync(new URL('../deployment.json', import.meta.url))) throw new Error('正式會員已搬至 D1。本機工具請明確設定測試用 AUTH_DB_PATH，避免修改搬移前的備份資料庫。');

const { values } = parseArgs({ options: { email: { type: 'string' }, role: { type: 'string' } }, strict: true });
if (!values.email || !['student', 'instructor', 'admin'].includes(values.role)) {
  console.error('用法：npm run account:role -- --email 已註冊信箱 --role admin|instructor|student');
  process.exit(1);
}
const store = new AuthStore(process.env.AUTH_DB_PATH ?? fileURLToPath(new URL('../.data/pentaskill.sqlite', import.meta.url)));
try {
  const user = store.setRole(values.email, values.role);
  console.log(`已設定 ${user.email} 的身分為 ${user.role}；身分變更後請重新登入。`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { store.close(); }
