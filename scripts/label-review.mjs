import {readFile,writeFile} from 'node:fs/promises';
const path=new URL('../dist/index.html',import.meta.url);
const html=await readFile(path,'utf8');
const old='新版體驗預覽 <span class="preview-divider">／</span> 課程與價格為示範；尚未開放正式購課與預約。';
const label='手機測試站 <span class="preview-divider">／</span> 僅供預覽，請勿輸入真實個資；不會正式收款或預約。';
if(!html.includes(old))throw new Error('Review label target missing');
await writeFile(path,html.replace(old,label));
