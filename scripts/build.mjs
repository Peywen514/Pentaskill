import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url), dist = new URL('../dist/', import.meta.url);
await mkdir(dist, { recursive: true });
for (const file of ['index.html', 'src', 'assets']) await cp(new URL(file, root), new URL(file, dist), { recursive: true, force: true });
console.log(`Static preview built: ${fileURLToPath(dist)}`);
