import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AuthError } from './auth-core.mjs';

// All-in-one checkout uses the legacy ECPay/.NET URL encoding rules.
export function checkMacValue(params,key,iv){
  const pairs=Object.entries(params).filter(([k])=>k.toLowerCase()!=='checkmacvalue').sort(([a],[b])=>a.toLowerCase()<b.toLowerCase()?-1:a.toLowerCase()>b.toLowerCase()?1:0).map(([k,v])=>`${k}=${v}`).join('&');
  const raw=`HashKey=${key}&${pairs}&HashIV=${iv}`;
  const encoded=encodeURIComponent(raw).replace(/%20/g,'+').replace(/~/g,'%7e').toLowerCase();
  return createHash('sha256').update(encoded,'utf8').digest('hex').toUpperCase();
}
export function validMac(params,key,iv){const received=params.CheckMacValue;if(typeof received!=='string'||!/^[A-Fa-f0-9]{64}$/.test(received))return false;return timingSafeEqual(Buffer.from(received.toUpperCase(),'ascii'),Buffer.from(checkMacValue(params,key,iv),'ascii'))}
function settings(env){
  if(env.ECPAY_MODE!=='stage'||!env.ECPAY_MERCHANT_ID||!env.ECPAY_HASH_KEY||!env.ECPAY_HASH_IV||!env.ECPAY_SITE_ORIGIN)throw new AuthError('付款功能尚未開放',503);
  let url;try{url=new URL(env.ECPAY_SITE_ORIGIN)}catch{throw new AuthError('付款設定不完整',503)}
  if(url.protocol!=='https:'||url.origin!==env.ECPAY_SITE_ORIGIN)throw new AuthError('付款設定不完整',503);
  return {merchant:env.ECPAY_MERCHANT_ID,key:env.ECPAY_HASH_KEY,iv:env.ECPAY_HASH_IV,origin:url.origin};
}
function taipeiDate(now){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}:${p.second}`}
export async function createCheckout(db,user,courseId,env,now=Date.now()){
  const config=settings(env);if(typeof courseId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(courseId))throw new AuthError('課程不正確');
  const row=await db.prepare('SELECT id,data,published FROM courses WHERE id=?').bind(courseId).first();if(!row||!row.published)throw new AuthError('課程目前無法購買',404);
  const c=JSON.parse(row.data);if(!Number.isSafeInteger(c.price)||c.price<1||c.price>9999999)throw new AuthError('課程價格尚未設定');
  const owned=await db.prepare('SELECT 1 AS found FROM payment_entitlements WHERE user_id=? AND course_id=? AND revoked_at IS NULL UNION ALL SELECT 1 AS found FROM course_entitlements WHERE user_id=? AND course_id=? AND revoked_at IS NULL LIMIT 1').bind(user.id,courseId,user.id,courseId).first();if(owned)throw new AuthError('此課程已開通',409);
  const trade='P'+randomBytes(9).toString('hex').toUpperCase();
  await db.prepare('INSERT INTO payment_orders(merchant_trade_no,user_id,course_id,course_title,amount,status,created_at) VALUES (?,?,?,?,?,?,?)').bind(trade,user.id,courseId,String(c.title),c.price,'pending',now).run();
  const params={MerchantID:config.merchant,MerchantTradeNo:trade,MerchantTradeDate:taipeiDate(now),PaymentType:'aio',TotalAmount:String(c.price),TradeDesc:'PentaSkill course',ItemName:String(c.title).replace(/[#&<>]/g,' ').slice(0,150),ReturnURL:config.origin+'/api/payments/ecpay/notify',ClientBackURL:config.origin+'/#member',ChoosePayment:'ALL',EncryptType:'1'};
  params.CheckMacValue=checkMacValue(params,config.key,config.iv);
  return {action:'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',fields:params,merchantTradeNo:trade};
}
export async function acceptNotification(db,params,env,now=Date.now()){
  const config=settings(env);if(!validMac(params,config.key,config.iv)||params.MerchantID!==config.merchant)throw new AuthError('付款通知驗證失敗',400);
  if(!/^[A-Za-z0-9]{1,20}$/.test(params.MerchantTradeNo??'')||!/^[A-Za-z0-9]{1,30}$/.test(params.TradeNo??'')||!/^[0-9]+$/.test(params.TradeAmt??''))throw new AuthError('付款通知格式不正確',400);
  const order=await db.prepare('SELECT * FROM payment_orders WHERE merchant_trade_no=?').bind(params.MerchantTradeNo).first();
  if(!order||String(order.amount)!==params.TradeAmt)throw new AuthError('付款通知與訂單不符',400);
  if(params.SimulatePaid==='1'||params.RtnCode!=='1')return {accepted:true,paid:false};
  if(params.SimulatePaid!=='0')throw new AuthError('付款通知格式不正確',400);
  if(order.status==='paid'){if(order.ecpay_trade_no!==params.TradeNo)throw new AuthError('付款交易編號不符',409);return {accepted:true,paid:true};}
  await db.batch([
    db.prepare("UPDATE payment_orders SET status='paid',paid_at=?,ecpay_trade_no=? WHERE merchant_trade_no=? AND status='pending'").bind(now,params.TradeNo,order.merchant_trade_no),
    db.prepare(`INSERT INTO payment_entitlements(user_id,course_id,merchant_trade_no,granted_at) SELECT user_id,course_id,merchant_trade_no,? FROM payment_orders WHERE merchant_trade_no=? AND status='paid' AND ecpay_trade_no=? ON CONFLICT(user_id,course_id) DO UPDATE SET merchant_trade_no=excluded.merchant_trade_no,granted_at=excluded.granted_at,revoked_at=NULL WHERE payment_entitlements.revoked_at IS NOT NULL`).bind(now,order.merchant_trade_no,params.TradeNo)
  ]);
  return {accepted:true,paid:true};
}
