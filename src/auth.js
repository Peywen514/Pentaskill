export let account = null;
export let authAvailable = true;
export async function request(path, { method = 'GET', data } = {}) {
  let response;
  try {
    response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000), headers: method === 'POST' ? { 'Content-Type': 'application/json', 'X-PentaSkill-Client': 'web' } : {}, body: data === undefined ? undefined : JSON.stringify(data) });
  } catch { throw new Error('暫時無法連線到登入服務，請稍後再試'); }
  let body;
  try { body = await response.json(); } catch { throw new Error('登入服務尚未就緒，請確認使用完整伺服器啟動網站'); }
  if (!response.ok) { const error = new Error(body.error ?? '操作未完成，請稍後再試'); error.status = response.status; throw error; }
  return body;
}
export async function refreshSession() {
  try { const result = await request('/api/auth/session'); account = result.user; authAvailable = true; }
  catch { account = null; authAvailable = false; }
  return account;
}
export async function signOut() { await request('/api/auth/logout', { method: 'POST', data: {} }); account = null; }
export const homeFor = user => user?.role === 'admin' ? 'admin' : user?.role === 'instructor' ? 'instructor' : 'member';
export const roleLabel = role => ({ student: '學員', instructor: '講師', admin: '管理者' })[role] ?? '會員';

export function updateAccountNav() {
  const root = document.querySelector('#account-nav');
  root.replaceChildren();
  const link = document.createElement('a'); link.className = 'button button-small button-outline member-link';
  link.href = account ? `#${homeFor(account)}` : '#login';
  link.textContent = account ? ({ student: '我的學習', instructor: '講師專區', admin: '管理中心' })[account.role] : '登入 / 註冊';
  root.append(link);
  if (account) { const button = document.createElement('button'); button.type = 'button'; button.className = 'text-link account-logout'; button.dataset.action = 'logout'; button.textContent = '登出'; root.append(button); }
}

export function mountAuth(container, { mode = 'login', onSuccess }) {
  const registering = mode === 'register';
  container.innerHTML = `<div class="wrap auth-wrap"><section class="panel auth-panel"><span class="section-kicker">PENTASKILL / ${registering ? 'JOIN US' : 'WELCOME BACK'}</span><h1>${registering ? '開啟你的學習旅程' : '歡迎回到精五門'}</h1><p class="muted">${registering ? '建立學員帳號，從適合自己的課程開始。' : '登入帳號，回到自己的學習空間。'}</p><form id="auth-form" class="form-grid">${registering ? '<label class="field">怎麼稱呼你？<input name="name" autocomplete="name" minlength="2" maxlength="50" required placeholder="請填寫姓名或暱稱"></label>' : ''}<label class="field">電子郵件<input name="email" type="email" autocomplete="username" maxlength="254" required placeholder="你的 Email"></label><label class="field">密碼<input name="password" id="auth-password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" ${registering ? 'minlength="12"' : ''} maxlength="128" required><span class="field-hint">${registering ? '至少 12 個字元，建議使用容易記住的一句話。' : '密碼的英文大小寫與空白都需要相同。'}</span></label>${registering ? '<label class="field">再輸入一次密碼<input name="confirmation" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>' : ''}<label class="show-password"><input type="checkbox" id="show-password"> 顯示密碼</label><button type="submit" class="button" id="auth-submit">${registering ? '建立學員帳號' : '登入'}</button><p class="error-text" id="auth-error" role="alert"></p></form><p class="auth-switch">${registering ? '已經有帳號？ <a class="text-link" href="#login">前往登入 →</a>' : '第一次來？ <a class="text-link" href="#register">免費建立學員帳號 →</a>'}</p></section></div>`;
  container.querySelector('#show-password').addEventListener('change', e => { container.querySelectorAll('input[name="password"],input[name="confirmation"]').forEach(input => input.type = e.target.checked ? 'text' : 'password'); });
  container.querySelector('#auth-form').addEventListener('submit', async e => {
    e.preventDefault(); const form = e.target, values = Object.fromEntries(new FormData(form)), button = container.querySelector('#auth-submit'), error = container.querySelector('#auth-error');
    if (registering && values.password !== values.confirmation) { error.textContent = '兩次輸入的密碼不一致，請再確認'; return; }
    button.disabled = true; button.textContent = registering ? '正在建立帳號…' : '正在登入…'; error.textContent = '';
    try {
      const result = await request(`/api/auth/${registering ? 'register' : 'login'}`, { method: 'POST', data: { email: values.email, password: values.password, ...(registering ? { name: values.name } : {}) } });
      account = result.user; authAvailable = true;
      form.reset(); values.password = ''; values.confirmation = '';
      if (form.isConnected) await onSuccess(account);
    } catch (err) { if (error.isConnected) error.textContent = err.message; }
    finally { if (button.isConnected) { button.disabled = false; button.textContent = registering ? '建立學員帳號' : '登入'; } }
  });
}
