import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const origin=new URL(process.argv[2]).origin;
if(!/^https:\/\/pentaskill-v2\.[a-z0-9-]+\.workers\.dev$/.test(origin))throw new Error('Expected new pentaskill-v2 Workers URL');
const email=`migration-smoke-${Date.now()}-${randomBytes(4).toString('hex')}@example.invalid`;
const password=randomBytes(24).toString('base64url');let id,cookie;
const post=(path,data,originHeader=origin)=>fetch(origin+path,{method:'POST',headers:{Origin:originHeader,'Content-Type':'application/json','X-PentaSkill-Client':'web',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
try{
  const home=await fetch(origin+'/');if(home.status!==200)throw new Error('Homepage failed');
  const registration=await post('/api/auth/register',{email,password,name:'搬移驗證專用帳號',role:'admin'});
  if(registration.status!==201)throw new Error(`Cloud registration failed (HTTP ${registration.status})`);
  const data=await registration.json();id=data.user.id;
  if(data.user.role!=='student')throw new Error('Public role escalation detected');
  cookie=registration.headers.get('set-cookie')?.split(';')[0];
  if(!cookie||!registration.headers.get('set-cookie').includes('Secure'))throw new Error('Secure session cookie missing');
  const own=await fetch(origin+'/api/workspace',{headers:{Cookie:cookie}});if(own.status!==200)throw new Error('Authenticated workspace failed');
  const denied=await fetch(origin+'/api/admin/members',{headers:{Cookie:cookie}});if(denied.status!==403)throw new Error('Student could read members');
  const blocked=await post('/api/auth/logout',{},'https://other.invalid');if(blocked.status!==403)throw new Error('Cross-site mutation accepted');
  const logout=await post('/api/auth/logout',{});if(logout.status!==200)throw new Error('Logout failed');
  const stale=await fetch(origin+'/api/workspace',{headers:{Cookie:cookie}});if(stale.status!==401)throw new Error('Logged-out session still valid');
  const login=await post('/api/auth/login',{email,password});if(login.status!==200)throw new Error(`Cloud password login failed (HTTP ${login.status})`);
  cookie=login.headers.get('set-cookie').split(';')[0];await post('/api/auth/logout',{});
  console.log('Cloud homepage, registration, password login, secure cookies, role isolation, CSRF and logout passed.');
}finally{
  if(id){
    if(!/^[a-f0-9-]{36}$/.test(id)||!/^migration-smoke-[0-9]+-[a-f0-9]+@example\.invalid$/.test(email))throw new Error('Unsafe test cleanup identifiers');
    const root=fileURLToPath(new URL('../',import.meta.url)),dir=resolve(root,'.data','d1-migration');mkdirSync(dir,{recursive:true});
    const path=resolve(dir,'smoke-cleanup.sql');
    writeFileSync(path,`DELETE FROM sessions WHERE user_id='${id}';\nDELETE FROM users WHERE id='${id}' AND email='${email}';\n`,{mode:0o600});
    try{execFileSync(process.execPath,[resolve(root,'node_modules','wrangler','bin','wrangler.js'),'d1','execute','pentaskill-members-v2-20261104','--remote','--file',path,'--json'],{cwd:root,stdio:['ignore','pipe','pipe']});console.log('Disposable test account removed from the new D1 database.');}
    catch{throw new Error('Test account cleanup failed; no original member data was modified.');}
  }
}
