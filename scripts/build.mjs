import { cp, mkdir, lstat, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
const root = new URL('../', import.meta.url), dist = new URL('../dist/', import.meta.url);
const workspace=resolve(fileURLToPath(root)),target=resolve(fileURLToPath(dist));
if(target!==resolve(workspace,'dist')||!target.startsWith(workspace+sep))throw new Error('Unsafe build output path');
try { if((await lstat(target)).isSymbolicLink())throw new Error('Build output must not be a symlink'); } catch(error) { if(error.code!=='ENOENT')throw error; }
// 只重建已確認位於本專案內的 dist 產物，不刪除任何來源或資料庫。
await rm(target,{recursive:true,force:true});
await mkdir(dist, { recursive: true });
for (const file of ['index.html', 'src', 'assets']) await cp(new URL(file, root), new URL(file, dist), { recursive: true, force: true });
console.log(`Static preview built: ${fileURLToPath(dist)}`);
