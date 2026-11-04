import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { AuthStore } from '../server/auth.mjs';

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
