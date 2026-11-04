import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { D1AuthStore } from '../server/d1-store.mjs';
import { hashPassword } from '../server/auth-core.mjs';
import worker,{workerApi} from '../server/worker.mjs';

function fixture(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');sqlite.exec(readFileSync(new URL('../migrations/0001_members.sql',import.meta.url),'utf8'));
  const db={prepare(sql){return {values:[],bind(...values){this.values=values;return this;},async first(){return sqlite.prepare(sql).get(...this.values)??null;},async all(){return {results:sqlite.prepare(sql).all(...this.values),success:true};},async run(){sqlite.prepare(sql).run(...this.values);return {results:[],success:true};}};},async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements){try{result.push(await s.all());}catch{result.push(await s.run());}}sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
  return {sqlite,db,store:new D1AuthStore(db)};
}

test('D1 遷移保留原 scrypt 雜湊與管理者身分，登入後 Session 可撤銷',async()=>{
  const {store,sqlite,db}=fixture();try{
    const secret='migration-only-password',hash=await hashPassword(secret);
    await db.prepare('INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)').bind('migrated','owner@example.test','管理者',hash,'admin',Date.now()).run();
    const user=await store.login({email:'owner@example.test',password:secret},'migration');assert.equal(user.role,'admin');
    assert.equal(sqlite.prepare('SELECT password_hash FROM users').get().password_hash,hash);
    const token=await store.createSession(user.id);assert.equal((await store.userFromToken(token)).id,user.id);await store.logout(token);assert.equal(await store.userFromToken(token),null);
  }finally{sqlite.close();}
});

test('會員清單可搜尋／身分篩選，輸出沒有密碼雜湊或登入 Token',async()=>{
  const {store,sqlite}=fixture();try{
    await store.createUser({email:'owner@example.test',name:'管理者',password:'testpassword8'},'admin');
    await store.createUser({email:'learner@example.test',name:'學員甲',password:'testpassword8'});
    const all=await store.listMembers();assert.equal(all.total,2);assert.equal((await store.listMembers({role:'admin'})).total,1);assert.equal((await store.listMembers({search:'learner'})).total,1);
    assert.equal((await store.listMembers({search:'%'})).total,0);
    assert.ok(all.members.every(m=>!('password_hash'in m)&&!('token_hash'in m)));
    await assert.rejects(store.listMembers({role:'superuser'}));await assert.rejects(store.listMembers({page:-1}));
  }finally{sqlite.close();}
});

test('Worker HTTP API 對匿名／學員隱藏會員資料；管理者可讀；跨站寫入被拒絕',async()=>{
  const {store,sqlite}=fixture();try{
    const request=(path,cookie='')=>new Request('https://new.example'+path,{headers:{Cookie:cookie}});
    assert.equal((await workerApi(request('/api/admin/members'),store)).status,401);
    const student=await store.createUser({email:'student@example.test',name:'學員甲',password:'testpassword8'}),token=await store.createSession(student.id);
    assert.equal((await workerApi(request('/api/admin/members','__Host-pentaskill_session='+token),store)).status,403);
    const admin=await store.createUser({email:'admin@example.test',name:'管理者',password:'testpassword8'},'admin'),adminToken=await store.createSession(admin.id);
    const response=await workerApi(request('/api/admin/members','__Host-pentaskill_session='+adminToken),store);assert.equal(response.status,200);const data=await response.json();assert.equal(data.total,2);assert.doesNotMatch(JSON.stringify(data),/password_hash|scrypt\$/);
    const blocked=await workerApi(new Request('https://new.example/api/auth/register',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json','X-PentaSkill-Client':'web'},body:'{}'}),store);assert.equal(blocked.status,403);
  }finally{sqlite.close();}
});

test('Worker 只提供前端公開檔案，不提供伺服器、資料庫或匯出檔',async()=>{
  const env={ASSETS:{fetch:async()=>new Response('asset')}};
  for(const path of ['/server/auth-core.mjs','/.data/pentaskill.sqlite','/migrations/0001_members.sql','/docs/authentication.md'])assert.equal((await worker.fetch(new Request('https://new.example'+path),env)).status,404);
  assert.equal((await worker.fetch(new Request('https://new.example/'),env)).status,200);
});
