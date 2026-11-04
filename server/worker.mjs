import { D1AuthStore } from './d1-store.mjs';
import { AuthError, sessionToken, sessionCookie } from './auth-core.mjs';

export const securityHeaders = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Cache-Control':'no-store',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; media-src https://interactive-examples.mdn.mozilla.net; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};

export async function workerApi(request,store) {
  const url=new URL(request.url), origin=url.origin, secure=url.protocol==='https:';
  const token=sessionToken({headers:{cookie:request.headers.get('Cookie')??''}},secure);
  const json=(status,data,headers={})=>new Response(JSON.stringify(data),{status,headers:{...securityHeaders,'Content-Type':'application/json; charset=utf-8',...headers}});
  try {
    if(request.method==='GET' && url.pathname==='/api/auth/session') return json(200,{user:await store.userFromToken(token)});
    if(request.method==='GET' && url.pathname==='/api/workspace') {const user=await store.requireRole(token,['student','instructor','admin']);return json(200,{user,bookings:[],bookingSyncEnabled:false,workspace:user.role});}
    if(request.method==='GET' && url.pathname==='/api/admin/status') {await store.requireRole(token,['admin']);return json(200,{access:'admin',coursePersistenceEnabled:false,memberStorage:'cloudflare-d1'});}
    if(request.method==='GET' && url.pathname==='/api/instructor/status') {await store.requireRole(token,['instructor','admin']);return json(200,{access:'instructor',bookings:[],bookingSyncEnabled:false});}
    if(request.method==='GET' && url.pathname==='/api/admin/members') {
      await store.requireRole(token,['admin']);
      return json(200,await store.listMembers({search:url.searchParams.get('search')??'',role:url.searchParams.get('role')??'',page:url.searchParams.get('page')??1}));
    }
    if(request.method!=='POST' || !['/api/auth/register','/api/auth/login','/api/auth/logout'].includes(url.pathname)) return json(404,{error:'找不到這個服務'});
    if(request.headers.get('Origin')!==origin || request.headers.get('X-PentaSkill-Client')!=='web' || (request.headers.has('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin')) throw new AuthError('請從本站操作',403);
    if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new AuthError('請使用 JSON 格式',415);
    if(Number(request.headers.get('Content-Length')??0)>8192) throw new AuthError('資料超過允許大小',413);
    const reader=request.body?.getReader(),chunks=[];let size=0;
    if(reader) {for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new AuthError('資料超過允許大小',413);}chunks.push(value);}}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AuthError('資料格式不正確');}
    if(!body||typeof body!=='object'||Array.isArray(body))throw new AuthError('資料格式不正確');
    if(url.pathname==='/api/auth/logout'){await store.logout(token);return json(200,{user:null},{'Set-Cookie':sessionCookie('',secure,true)});}
    const ip=request.headers.get('CF-Connecting-IP')??'local';let user;
    if(url.pathname==='/api/auth/register') {await store.limit(`register-ip:${ip}`,5);user=await store.createUser({email:body.email,password:body.password,name:body.name},'student');}
    else user=await store.login(body,ip);
    await store.logout(token);const fresh=await store.createSession(user.id);
    return json(url.pathname.endsWith('register')?201:200,{user},{'Set-Cookie':sessionCookie(fresh,secure)});
  }catch(error){if(!(error instanceof AuthError))console.error('[api]',error.code??error.name);return json(error instanceof AuthError?error.status:500,{error:error instanceof AuthError?error.message:'服務暫時無法處理，請稍後再試'});}
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')){
      if(env.MIGRATION_PENDING==='true')return new Response(JSON.stringify({error:'會員資料搬移中，請稍後再試'}),{status:503,headers:{...securityHeaders,'Content-Type':'application/json'}});
      if(!env.DB)return new Response(JSON.stringify({error:'資料服務尚未設定'}),{status:503,headers:{...securityHeaders,'Content-Type':'application/json'}});
      const db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
      return workerApi(request,new D1AuthStore(db));
    }
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{...securityHeaders,Allow:'GET, HEAD'}});
    let path;try{path=decodeURIComponent(url.pathname);}catch{return new Response('Not found',{status:404,headers:securityHeaders});}
    if(!(path==='/'||path==='/index.html'||path.startsWith('/src/')||path.startsWith('/assets/'))||path.includes('\\')||path.split('/').some(p=>p.startsWith('.')))return new Response('Not found',{status:404,headers:securityHeaders});
    const result=await env.ASSETS.fetch(request),headers=new Headers(result.headers);
    for(const [key,value]of Object.entries(securityHeaders))headers.set(key,value);
    return new Response(result.body,{status:result.status,headers});
  }
};
