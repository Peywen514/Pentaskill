import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const deployment=JSON.parse(readFileSync(new URL('../deployment.json',import.meta.url),'utf8'));
const origin=new URL(deployment.url).origin;
if(!/^https:\/\/pentaskill-v2\.[a-z0-9-]+\.workers\.dev$/.test(origin))throw new Error('Invalid cloud preview target');
const port=Number(process.env.PORT??4173);
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  res.writeHead(307,{Location:origin+url.pathname+url.search,'Cache-Control':'no-store'});res.end();
});
server.listen(port,'127.0.0.1',()=>console.log(`PentaSkill cloud preview: http://127.0.0.1:${port} -> ${origin}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
