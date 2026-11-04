import { DatabaseSync, backup } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const expected={name:'pentaskill-members-v2-20261104',id:'ce99a8e9-a19a-4a92-8494-5be318945f6a'};
const config=JSON.parse(readFileSync(resolve(root,'wrangler.jsonc'),'utf8'));
if(config.d1_databases.length!==1||config.d1_databases[0].database_name!==expected.name||config.d1_databases[0].database_id!==expected.id)throw new Error('Migration target differs from the newly created database');
const mode=process.argv[2]??'export';
const privateDir=resolve(root,'.data','d1-migration');mkdirSync(privateDir,{recursive:true,mode:0o700});
const sqlPath=resolve(privateDir,'members.sql'),receiptPath=resolve(privateDir,'receipt.json');
const sqlValue=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
const fingerprint=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
function wrangler(args){
  // 只拼接固定操作、已驗證的目標名稱與本專案私有路徑；密碼與 Token 不進命令列。
  try {
    const result=execFileSync(process.execPath,[resolve(root,'node_modules','wrangler','bin','wrangler.js'),...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024});
    // 檔案匯入包含上傳進度文字；成功與否先看結束碼，再由 verify 比對全部欄位。
    return args.includes('--file')?null:JSON.parse(result);
  } catch { throw new Error('Cloudflare D1 operation failed; raw output suppressed to protect member data.'); }
}
const query=sql=>wrangler(['d1','execute',expected.name,'--remote','--command',sql,'--json'])[0].results;

if(mode==='export'){
  const source=new DatabaseSync(resolve(root,'.data','pentaskill.sqlite'),{readOnly:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  await backup(source,resolve(privateDir,`before-d1-${stamp}.sqlite`));
  const users=source.prepare('SELECT id,email,name,password_hash,role,email_verified,active,created_at FROM users ORDER BY id').all();
  const changes=source.prepare('SELECT id,user_id,previous_role,new_role,changed_at FROM role_changes ORDER BY id').all();source.close();
  if(!users.length)throw new Error('No members to migrate');
  const statements=[];
  for(const [table,rows]of [['users',users],['role_changes',changes]])for(const row of rows)statements.push(`INSERT INTO ${table}(${Object.keys(row).join(',')}) VALUES (${Object.values(row).map(sqlValue).join(',')});`);
  writeFileSync(sqlPath,statements.join('\n')+'\n',{mode:0o600});
  writeFileSync(receiptPath,JSON.stringify({target:expected,count:users.length,roleChanges:changes.length,userFingerprint:fingerprint(users),auditFingerprint:fingerprint(changes)},null,2),{mode:0o600});
  console.log(`Exported ${users.length} member(s) and ${changes.length} role change(s). Private files remain under ignored .data/d1-migration; sessions are not exported.`);
}else if(mode==='import'){
  const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
  if(receipt.target.id!==expected.id)throw new Error('Receipt target mismatch');
  if(query('SELECT count(*) AS total FROM users')[0].total!==0)throw new Error('Target is not empty; refusing overwrite or repeated import');
  wrangler(['d1','execute',expected.name,'--remote','--file',sqlPath,'--json']);
  console.log('Import submitted to the newly created D1 database. Run verify before switching traffic.');
}else if(mode==='verify'){
  const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
  const users=query('SELECT id,email,name,password_hash,role,email_verified,active,created_at FROM users ORDER BY id');
  const changes=query('SELECT id,user_id,previous_role,new_role,changed_at FROM role_changes ORDER BY id');
  if(fingerprint(users)!==receipt.userFingerprint||fingerprint(changes)!==receipt.auditFingerprint)throw new Error('Migration verification failed; source remains unchanged');
  if(query('SELECT count(*) AS total FROM sessions')[0].total!==0)throw new Error('Unexpected sessions exist before cutover');
  const report={verifiedAt:new Date().toISOString(),target:expected.name,members:users.length,roleChanges:changes.length,passwordHashesUnchanged:true,sessionsMigrated:false};
  writeFileSync(resolve(privateDir,'verification.json'),JSON.stringify(report,null,2),{mode:0o600});
  console.log(JSON.stringify(report));
}else throw new Error('Use export, import or verify');
