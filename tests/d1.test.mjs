import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { D1AuthStore } from '../server/d1-store.mjs';
import { hashPassword } from '../server/auth-core.mjs';
import worker,{workerApi} from '../server/worker.mjs';
import { checkMacValue, createCheckout, acceptNotification } from '../server/ecpay.mjs';

function fixture(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const name of ['0001_members.sql','0002_learning.sql','0003_initial_catalog.sql','0004_ecpay_orders.sql','0005_course_favorites.sql'])sqlite.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
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

test('綠界檢查碼符合官方全方位金流範例',()=>{
  const fields={TradeDesc:'促銷方案',PaymentType:'aio',MerchantTradeDate:'2023/03/12 15:30:23',MerchantTradeNo:'ecpay20230312153023',MerchantID:'3002607',ReturnURL:'https://www.ecpay.com.tw/receive.php',ItemName:'Apple iphone 15',TotalAmount:'30000',ChoosePayment:'ALL',EncryptType:'1'};
  assert.equal(checkMacValue(fields,'pwFHCqoQZGmho4w6','EkRm7iFT261dpevs'),'6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840');
});

test('綠界僅在真實成功且驗簽金額正確時開通，重複通知不重複授權',async()=>{
  const {store,sqlite,db}=fixture();try{
    const user=await store.createUser({email:'buyer@example.test',name:'測試學員',password:'testpassword8'});
    const env={ECPAY_MODE:'stage',ECPAY_MERCHANT_ID:'3002607',ECPAY_HASH_KEY:'pwFHCqoQZGmho4w6',ECPAY_HASH_IV:'EkRm7iFT261dpevs',ECPAY_SITE_ORIGIN:'https://staging.example'};
    await assert.rejects(createCheckout(db,user,'ai-starter',{}));
    const checkout=await createCheckout(db,user,'ai-starter',env);assert.equal(checkout.fields.TotalAmount,'1680');
    const token=await store.createSession(user.id);
    const paymentRequest=(cookie,origin)=>new Request('https://staging.example/api/payments/ecpay/checkout',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-PentaSkill-Client':'web'},body:JSON.stringify({courseId:'ai-starter'})});
    assert.equal((await workerApi(paymentRequest('','https://staging.example'),store,env)).status,401);
    assert.equal((await workerApi(paymentRequest('__Host-pentaskill_session='+token,'https://evil.example'),store,env)).status,403);
    assert.equal((await workerApi(paymentRequest('__Host-pentaskill_session='+token,'https://staging.example'),store,{})).status,503);
    const payload={MerchantID:env.ECPAY_MERCHANT_ID,MerchantTradeNo:checkout.merchantTradeNo,TradeNo:'24010100000001',TradeAmt:'1680',RtnCode:'1',SimulatePaid:'0'};
    const sign=x=>({...x,CheckMacValue:checkMacValue(x,env.ECPAY_HASH_KEY,env.ECPAY_HASH_IV)});
    const callback=async fields=>workerApi(new Request('https://staging.example/api/payments/ecpay/notify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)}),store,env);
    assert.equal((await callback({...sign(payload),TradeAmt:'1'})).status,400);
    assert.equal((await callback(sign({...payload,SimulatePaid:'1'}))).status,200);
    await assert.rejects(acceptNotification(db,{...sign(payload),TradeAmt:'1'},env));
    await assert.rejects(acceptNotification(db,sign({...payload,TradeAmt:'1'}),env));
    assert.equal((await acceptNotification(db,sign({...payload,SimulatePaid:'1'}),env)).paid,false);
    assert.equal((await acceptNotification(db,sign({...payload,RtnCode:'0'}),env)).paid,false);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM payment_entitlements').get().n,0);
    assert.equal((await acceptNotification(db,sign(payload),env)).paid,true);
    assert.equal((await acceptNotification(db,sign(payload),env)).paid,true);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM payment_entitlements').get().n,1);
    await assert.rejects(acceptNotification(db,sign({...payload,TradeNo:'24010100000002'}),env));
    await assert.rejects(createCheckout(db,user,'ai-starter',env));
  }finally{sqlite.close()}
});

test('課程與學習 API 權限、跨裝置紀錄及偽造答案防護',async()=>{
  const {store,sqlite}=fixture();try{
    const admin=await store.createUser({email:'admin@example.test',name:'管理者',password:'testpassword8'},'admin');
    const student=await store.createUser({email:'student@example.test',name:'學員甲',password:'testpassword8'});
    const other=await store.createUser({email:'other@example.test',name:'學員乙',password:'testpassword8'});
    const at=await store.createSession(admin.id),st=await store.createSession(student.id),st2=await store.createSession(student.id),ot=await store.createSession(other.id);
    const call=(path,token='',body)=>workerApi(new Request('https://new.example'+path,{method:body?'POST':'GET',headers:{Cookie:'__Host-pentaskill_session='+token,...(body?{Origin:'https://new.example','Content-Type':'application/json','X-PentaSkill-Client':'web'}:{})},...(body?{body:JSON.stringify(body)}:{})}),store);
    assert.equal((await call('/api/catalog')).status,200);
    assert.equal((await call('/api/admin/catalog',st)).status,403);
    assert.equal((await call('/api/admin/category',st,{name:'未授權'})).status,403);
    assert.equal((await call('/api/admin/category',at,{name:'繪圖'})).status,200);
    assert.equal((await call('/api/learning/assessment',st,{answers:[1,2,0,1,2,0]})).status,200);
    assert.deepEqual((await (await call('/api/learning',st2)).json()).answers,[1,2,0,1,2,0]);
    assert.equal((await (await call('/api/learning',ot)).json()).answers,null);
    const wrong=await (await call('/api/learning/quest',st,{stage:0,answer:0})).json();assert.equal(wrong.correct,false);assert.deepEqual(wrong.completed,[]);
    const correct=await (await call('/api/learning/quest',st,{stage:0,answer:1})).json();assert.equal(correct.correct,true);assert.deepEqual(correct.completed,['beginner']);
    assert.deepEqual((await (await call('/api/learning',st2)).json()).completed,['beginner']);
    assert.equal((await call('/api/favorites')).status,401);
    assert.equal((await call('/api/favorites',st,{courseId:'ai-starter',selected:true})).status,200);
    assert.deepEqual((await (await call('/api/favorites',st2)).json()).favorites,['ai-starter']);
    assert.deepEqual((await (await call('/api/favorites',ot)).json()).favorites,[]);
    assert.equal((await call('/api/favorites',st,{courseId:'invalid',selected:true})).status,404);
    assert.equal((await call('/api/favorites',st,{courseId:'ai-starter',selected:false})).status,200);
    assert.equal((await call('/api/my-courses')).status,401);
    sqlite.prepare('INSERT INTO course_entitlements(user_id,course_id,granted_by,granted_at,reason) VALUES (?,?,?,?,?)').run(student.id,'ai-starter',admin.id,Date.now(),'test');
    assert.deepEqual((await (await call('/api/my-courses',st2)).json()).courses.map(c=>c.id),['ai-starter']);
    assert.deepEqual((await (await call('/api/my-courses',ot)).json()).courses,[]);
    assert.equal((await call('/api/learning/assessment',st,{answers:[99]})).status,400);
    assert.equal((await call('/api/admin/role',st,{userId:student.id,role:'admin'})).status,403);
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
