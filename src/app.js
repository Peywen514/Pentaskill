import { initialCourses, stages, questions, quests } from './catalog.js';
import { assess, awardQuest, experience, pricePlan, createPreviewOrder, validateCourse, validateBooking, dateInTaipei } from './domain.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const main = $('#main'), modal = $('#modal'), content = $('#modal-content');
const STORE = 'pentaskill-preview-v1';
const symbols = ['✦', '◈', '⚒', '⌘'];
let state = { completed: [], assessment: null, orders: [], bookings: [], progress: 0, courses: structuredClone(initialCourses) };
let storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(STORE));
  if (saved?.version === 1) {
    if (Array.isArray(saved.completed)) state.completed = [...new Set(saved.completed.filter(id => stages.some(s => s.id === id)))];
    if (Array.isArray(saved.answers)) { try { state.assessment = assess(saved.answers); state.answers = saved.answers; } catch {} }
    if (Array.isArray(saved.orders)) state.orders = saved.orders.filter(o => o.status === 'preview_draft' && !o.paid && initialCourses.some(c => c.id === o.courseId)).slice(-20);
    if (Array.isArray(saved.bookings)) state.bookings = saved.bookings.filter(b => b.status === 'preview_request' && typeof b.date === 'string' && typeof b.topic === 'string').slice(-20);
    if (Number.isFinite(saved.progress)) state.progress = Math.min(100, Math.max(0, saved.progress));
    if (Array.isArray(saved.courses)) {
      state.courses = initialCourses.map(base => { try { const custom = saved.courses.find(c => c.id === base.id); return custom ? { ...base, ...validateCourse(custom) } : base; } catch { return base; } });
    }
  }
} catch { storageAvailable = false; }

let filter = 'all', search = '', carouselIndex = 0, carouselTimer, mapStage = state.assessment?.stage ?? 0, quizAnswers = [], quizIndex = 0, toastTimer;
const money = n => `NT$ ${Number(n).toLocaleString('zh-TW')}`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const visibleCourses = () => state.courses.filter(c => c.published);
const courseById = id => state.courses.find(c => c.id === id);
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ ...state, version: 1 })); }
  catch { storageAvailable = false; toast('瀏覽器無法保存紀錄；本次操作僅保留到頁面關閉。'); }
}
function toast(text) { const el = $('#toast'); el.textContent = text; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 4500); }
function openDialog(html) { content.innerHTML = html; if (!modal.open) modal.showModal(); }
function closeDialog() { modal.close(); }
$('.modal-close').addEventListener('click', closeDialog);
modal.addEventListener('click', e => { if (e.target === modal) { const r = modal.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(); } });
function stageIcon(i) { return `<div class="stage-symbol ${stages[i].color}" aria-hidden="true">${symbols[i]}</div>`; }
function art(kind) {
  const start = '<svg class="course-art" viewBox="0 0 300 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
  const end = '</svg>';
  const arts = {
    prompt: '<rect x="45" y="29" width="200" height="126" rx="13" fill="#f9f4fe" stroke="#b093cc" stroke-width="2"/><path d="M45 52h200" stroke="#d4c4e5"/><circle cx="58" cy="40" r="3" fill="#b9a1d0"/><circle cx="69" cy="40" r="3" fill="#cfbbe2"/><circle cx="80" cy="40" r="3" fill="#e8b2db"/><rect x="65" y="69" width="95" height="13" rx="6" fill="#dac7ec"/><rect x="65" y="91" width="152" height="7" rx="3" fill="#e5dcee"/><rect x="65" y="106" width="120" height="7" rx="3" fill="#e5dcee"/><rect x="65" y="125" width="154" height="16" rx="6" fill="#f1ecf6"/><path d="m205 130 5 3-5 3" stroke="#724d97"/><rect x="202" y="12" width="48" height="47" rx="14" fill="#432363" transform="rotate(12 202 12)"/><path d="m225 24 2 10 10 3-10 3-3 10-2-10-9-3 10-3 2-10Z" fill="#cda2f7"/><path d="m39 111-5 8 8 3M256 100l8 3-5 8" stroke="#9671bb" stroke-width="2"/>',
    nodes: '<path d="M72 91h46m50 0h50M148 43v28m0 42v30M87 50l38 27m46 28 38 26M87 132l37-27m47-28 37-27" stroke="#96c6d0" stroke-width="2" stroke-dasharray="5 5"/><rect x="119" y="64" width="58" height="55" rx="17" fill="#69a4b0"/><path d="m135 83 7-7m-7 7 7 7m20-7-7-7m7 7-7 7m-9 11h9" stroke="#f3fbfc" stroke-width="3" stroke-linecap="round"/><g fill="#fcfbfd" stroke="#a8cbd2" stroke-width="2"><rect x="49" y="66" width="43" height="43" rx="12"/><rect x="212" y="66" width="43" height="43" rx="12"/><rect x="129" y="18" width="37" height="30" rx="10"/><rect x="129" y="136" width="37" height="30" rx="10"/></g><g fill="#a2d0d9"><circle cx="70" cy="87" r="8"/><circle cx="233" cy="87" r="8"/><circle cx="77" cy="41" r="9"/><circle cx="218" cy="41" r="9"/><circle cx="77" cy="141" r="9"/><circle cx="218" cy="141" r="9"/></g>',
    workflow: '<path d="M73 87h150M150 87v45" stroke="#d27fbd" stroke-width="2" stroke-dasharray="5 4"/><rect x="24" y="57" width="65" height="62" rx="14" fill="#fef8fc" stroke="#dfa5d0" stroke-width="2"/><rect x="118" y="57" width="65" height="62" rx="14" fill="#b15099"/><rect x="211" y="57" width="65" height="62" rx="14" fill="#fef8fc" stroke="#dfa5d0" stroke-width="2"/><rect x="128" y="132" width="45" height="28" rx="8" fill="#f8e9f4" stroke="#dfa5d0"/><path d="M43 78h26m-26 8h20m-20 8h26" stroke="#c67ab3" stroke-width="3" stroke-linecap="round"/><path d="m145 73-9 16h12l-2 14 15-20h-12l5-10" fill="#f9dff3"/><path d="m231 87 9 8 15-17" stroke="#b55b9f" stroke-width="3" stroke-linecap="round"/><circle cx="99" cy="34" r="4" fill="#de9fce"/><path d="m192 29 4 7 8 2-8 2-4 7-2-7-7-2 7-2 2-7" fill="#d581c0"/>',
    code: '<rect x="40" y="26" width="221" height="134" rx="14" fill="#fefcff" stroke="#c7b8d6" stroke-width="2"/><path d="M40 51h221" stroke="#dfd5e9"/><circle cx="56" cy="39" r="3" fill="#d3c6df"/><circle cx="68" cy="39" r="3" fill="#e3dce9"/><path d="m72 76 10 7-10 7m20 0h29" stroke="#a08ab6" stroke-width="3" stroke-linecap="round"/><path d="M72 106h55m-55 13h92m-92 13h65" stroke="#e2d9eb" stroke-width="6" stroke-linecap="round"/><rect x="181" y="68" width="56" height="65" rx="12" fill="#e5dbef"/><path d="m199 88-8 8 8 8m19-16 8 8-8 8m-9-20-5 26" stroke="#8e75a7" stroke-width="3" stroke-linecap="round"/>'
  };
  return start + (arts[kind] ?? arts.prompt) + end;
}
function courseVisual(c, extra = '') { return `<div class="course-visual ${c.color} ${extra}"><span class="visual-label">${escape(c.badge)}</span>${art(c.art)}<span class="visual-number">PENTASKILL / 0${c.stage + 1}</span></div>`; }
function courseCard(c) { return `<article class="course-card">${courseVisual(c)}<div class="course-body"><div class="course-category"><span>${escape(c.category)}</span><span>LEVEL 0${c.stage + 1}</span></div><h3><a href="#course/${c.id}">${escape(c.title)}</a></h3><div class="course-meta"><span>◷ ${c.duration}</span><span>▤ ${c.lessons} 個單元</span></div><div class="course-bottom"><span class="price"><small>NT$</small>${c.price.toLocaleString('zh-TW')}</span><a href="#course/${c.id}" class="text-link" aria-label="了解課程：${escape(c.title)}">了解課程 ↗</a></div></div></article>`; }
function teaserMap() { return `<div class="path-line">${stages.map((s, i) => `<a class="path-step" href="#map">${stageIcon(i)}<strong>${s.short}</strong><small>LEVEL ${s.number}</small></a>`).join('')}</div>`; }
function heroArt() { return `<div class="hero-art" aria-label="從新手到開發者的四階段學習路徑插畫"><div class="learning-window"><div class="window-top"><span>● ● ●</span><span>YOUR LEARNING JOURNEY ↗</span></div><div class="window-heading">每個高手，都曾是新手。<small>你的下一步，從這裡開始。</small></div><div class="mini-map">${stages.map((s, i) => `<div class="mini-node" style="--y:${25 - i * 15}px"><b>${symbols[i]}</b><span>${s.short}</span></div>`).join('')}</div><div class="window-progress"><span></span></div><div class="window-bottom"><span>STEP BY STEP. SKILL BY SKILL.</span><span>01 / 04</span></div></div><div class="float-card float-one"><div class="float-icon">✧</div><div><strong>找到自己的起點</strong><span>6 題小測驗，開啟學習旅程</span></div></div><div class="float-card float-two"><div class="float-icon">⚑</div><div><strong>小小闖關，大大進步</strong><span>完成任務 · 累積你的 XP</span></div></div><div class="art-caption">A LITTLE PRACTICE. A NEW POSSIBILITY.</div></div>`; }

function home() {
  main.innerHTML = `<div class="wrap"><section class="hero"><div class="hero-copy"><div class="hero-tag"><span>✦</span> 上班族進修 × 銀髮族樂學</div><h1 class="brand-headline">學得精 • 學得快 • <em>學得好</em></h1><p>零基礎也能輕鬆上手！專為上班族與樂活銀髮族打造，金牌業師 1 對 1 耐心帶練，學會實用技能，做出自己的精彩作品。</p><div class="hero-buttons"><a class="button" href="#courses">探索精選課程 <span>↗</span></a><button class="text-link" data-action="quiz">AI 學習起點小測驗 →</button></div><div class="hero-caption"><span>✓ 多元實用課程</span><span>✓ 業師耐心帶練</span><span>✓ 依自己的步調學</span></div></div>${heroArt()}</section><div class="trust-strip"><span><b>◈</b> 清楚分級，不再盲目選課</span><span><b>⌘</b> 從觀念走向真實作品</span><span><b>⚑</b> 任務闖關，看見每次進步</span><span><b>◎</b> 1 對 1，卡關有人陪</span></div><section class="section" aria-labelledby="featured-title"><div class="section-head"><div><span class="section-kicker">CURATED FOR YOUR NEXT STEP</span><h2 id="featured-title">下一個技能，從這堂開始</h2><p>依照興趣與程度，找到適合自己的課程。</p></div><a class="text-link" href="#courses">探索所有課程 ↗</a></div><div class="section-head"><div class="filter-row">${filters()}</div><div class="carousel-controls" aria-label="精選課程輪播"><button class="icon-button" data-action="prev-slide" aria-label="上一組精選課程">←</button><small id="slide-label"></small><button class="icon-button" data-action="next-slide" aria-label="下一組精選課程">→</button><button class="icon-button" id="carousel-pause" data-action="pause-carousel" aria-label="暫停自動輪播">Ⅱ</button></div></div><div class="course-grid" id="featured-grid"></div></section><section class="path-teaser"><div><span class="section-kicker">YOUR PERSONAL LEARNING MAP</span><h2>想學 AI，<br>從哪裡開始？</h2><p>6 道小題找到起點，跟著地圖輕鬆練習。</p><a class="text-link" href="#map">打開我的學習地圖 →</a></div>${teaserMap()}</section><section class="coaching-teaser"><div class="coaching-graphic" aria-hidden="true">◎</div><div><span class="section-kicker">A LITTLE GUIDANCE, A BIG DIFFERENCE</span><h3>遇到卡關，不用一個人硬撐。</h3><p>帶著問題來，和業師一起拆解。透過 Zoom，專注在真正的學習。</p></div><a class="button button-outline" href="#coaching">認識 1 對 1 個教 ↗</a></section></div>`;
  renderFeatured();
  const grid = $('#featured-grid');
  grid.addEventListener('mouseenter', stopCarousel);
  grid.addEventListener('focusin', stopCarousel);
  startCarousel();
}
function filters() { return [{ id: 'all', name: '全部課程' }, ...stages.map((s, i) => ({ id: String(i), name: s.short }))].map(f => `<button class="filter ${filter === f.id ? 'active' : ''}" data-action="filter" data-filter="${f.id}" aria-pressed="${filter === f.id}">${f.name}</button>`).join(''); }
function filtered() { return visibleCourses().filter(c => (filter === 'all' || String(c.stage) === filter) && (!search || `${c.title} ${c.category} ${c.subtitle}`.toLowerCase().includes(search.toLowerCase()))); }
function renderFeatured() {
  const list = filtered(), grid = $('#featured-grid');
  if (!grid) return;
  carouselIndex = list.length ? ((carouselIndex % list.length) + list.length) % list.length : 0;
  const count = matchMedia('(max-width:760px)').matches ? 1 : matchMedia('(max-width:1024px)').matches ? 2 : 3;
  const cards = list.length <= count ? list : Array.from({ length: count }, (_, i) => list[(carouselIndex + i) % list.length]);
  grid.innerHTML = cards.length ? cards.map(courseCard).join('') : '<div class="empty empty-filter">這個階段的課程正在準備中，先探索其他課程吧。</div>';
  $('#slide-label').textContent = `${list.length ? carouselIndex + 1 : 0} / ${list.length}`;
  $$('[data-action="prev-slide"], [data-action="next-slide"]').forEach(b => b.disabled = list.length <= count);
}
function stopCarousel() { clearInterval(carouselTimer); carouselTimer = null; const b = $('#carousel-pause'); if (b) { b.textContent = '▷'; b.setAttribute('aria-label', '啟動自動輪播'); } }
function startCarousel() { stopCarousel(); if (matchMedia('(prefers-reduced-motion:reduce)').matches) return; carouselTimer = setInterval(() => { if (!document.hidden && !modal.open) { carouselIndex++; renderFeatured(); } }, 6500); const b = $('#carousel-pause'); if (b) { b.textContent = 'Ⅱ'; b.setAttribute('aria-label', '暫停自動輪播'); } }
document.addEventListener('visibilitychange', () => { if (document.hidden) stopCarousel(); });

function catalog() {
  main.innerHTML = `<div class="wrap"><div class="page-heading"><span class="eyebrow">FIND YOUR NEXT SKILL</span><h1>好奇心，值得一堂好課。</h1><p>依照程度探索課程，或先做小測驗。每個人都有自己的起點，不用急著跟上別人的進度。</p></div><div class="catalog-tools"><div class="filter-row">${filters()}</div><label class="search"><span class="field-hint">搜尋課程</span><input type="search" id="course-search" placeholder="試試「入門」或「API」" value="${escape(search)}"></label></div><div class="course-grid catalog-full" id="catalog-grid"></div></div>`;
  renderCatalog();
  $('#course-search').addEventListener('input', e => { search = e.target.value; renderCatalog(); });
}
function renderCatalog() { $('#catalog-grid').innerHTML = filtered().map(courseCard).join('') || '<div class="empty empty-filter">沒有找到符合的課程。試試其他關鍵字或程度。</div>'; }

function detail(id) {
  const c = courseById(id);
  if (!c?.published) { main.innerHTML = '<div class="wrap section"><div class="empty">這門課目前未上架。<a class="text-link" href="#courses">回到課程商城 →</a></div></div>'; return; }
  main.innerHTML = `<div class="wrap"><div class="page-heading"><a href="#courses" class="text-link">← 所有課程</a><p class="section-kicker">LEVEL 0${c.stage + 1} / ${escape(c.category)}</p><h1>${escape(c.title)}</h1><p>${escape(c.description)}</p></div><div class="two-col"><div>${courseVisual(c, 'course-detail-art')}<div class="panel"><h3>練完這堂課，你可以……</h3><ul>${c.outcomes.map(s => `<li>${escape(s)}</li>`).join('')}</ul><p>${c.duration} · ${c.lessons} 個單元 · ${escape(c.instructor)}</p><button class="text-link" data-action="video">先看一段播放示範 →</button></div></div><div class="panel"><span class="section-kicker">CHOOSE YOUR LEARNING PACE</span><h3>選一種，適合自己的學法。</h3>${planChoices(c)}<p class="note">陪跑方案包含本課程錄播＋${c.credits} 堂 60 分鐘 Zoom 個教。錄播方案不含個教；遊戲 XP 不作現金折抵。價格為待確認的示範價格。</p><button class="button" data-action="order" data-id="${c.id}">查看方案摘要 ↗</button><button class="text-link" data-action="quote" data-id="${c.id}">需要不同堂數？規劃客製報價 →</button></div></div></div>`;
}
function planChoices(c) { return `<div class="plan-options"><label class="plan-option"><input type="radio" name="plan" value="recorded" checked> 錄播自學<strong>${money(c.price)}</strong><small>本課程所有錄播單元<br>依自己的步調練習<br>不含個教堂數</small></label><label class="plan-option"><input type="radio" name="plan" value="coaching"> 業師陪跑<strong>${money(c.coachingPrice)}</strong><small>錄播課程＋${c.credits} 堂個教<br>每堂 60 分鐘，Zoom 進行<br>以付款後核發的堂數預約</small></label></div>`; }
function previewOrder(id) {
  const c = courseById(id); if (!c?.published) return;
  const kind = $('input[name="plan"]:checked', main)?.value ?? 'recorded';
  const plan = pricePlan(c, kind);
  openDialog(`<span class="section-kicker">YOUR PLAN SUMMARY</span><h2 id="modal-title" class="modal-heading">把下一步，安排好。</h2><p class="modal-subtitle">${escape(c.title)}</p><div class="quote-summary">${kind === 'coaching' ? '錄播＋業師陪跑' : '錄播自學'}<strong>${money(plan.amount)}</strong>${plan.coachingCredits} 堂個教 · TWD · 示範價格</div><p class="note warn">目前可保存方案草稿，尚未開放付款。保存不會扣款、不會開通課程，也不會核發個教堂數。</p><div class="modal-actions"><button class="button" data-action="save-order" data-id="${c.id}" data-plan="${kind}">保存我的方案草稿</button><button class="text-link" data-action="close-modal">再想一下</button></div>`);
}
function quote(id) {
  const c = courseById(id) ?? visibleCourses()[0];
  if (!c) { toast('目前沒有上架課程可規劃報價。'); return; }
  openDialog(`<span class="section-kicker">A PLAN THAT FITS YOU</span><h2 id="modal-title" class="modal-heading">規劃你的個教方案</h2><p class="modal-subtitle">先試算不同堂數的學習組合。正式報價將由顧問確認內容、效期與受益學員。</p><form id="quote-form" class="form-grid"><label class="field">課程<select name="course">${visibleCourses().map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${escape(x.title)}</option>`).join('')}</select></label><label class="field">個教堂數<select name="credits"><option value="2">2 堂 × 60 分鐘</option><option value="4">4 堂 × 60 分鐘</option><option value="6">6 堂 × 60 分鐘</option></select></label><button class="button" type="submit">試算學習組合</button></form><div id="quote-result" aria-live="polite"></div>`);
  $('#quote-form').addEventListener('submit', e => { e.preventDefault(); const f = new FormData(e.target), selected = courseById(f.get('course')), credits = Number(f.get('credits')); if (!selected || ![2, 4, 6].includes(credits)) return; const unit = (selected.coachingPrice - selected.price) / selected.credits; $('#quote-result').innerHTML = `<div class="quote-summary">${escape(selected.title)}<br>錄播＋${credits} 堂個教<strong>${money(selected.price + unit * credits)}</strong>本次僅為示範試算，不是有效報價單。<br>正式流程：顧問開單 → 學員確認 → 付款驗證 → 核發授權與堂數。</div>`; });
}

function map() {
  main.innerHTML = `<div class="wrap"><div class="page-heading"><span class="eyebrow">EVERY EXPERT WAS ONCE A BEGINNER</span><h1>你的 AI 升級地圖</h1><p>從新手村到開發者基地。找到適合的起點，一關一關練出真正的能力。</p></div><section class="map-hero"><div><span class="section-kicker">${state.assessment ? 'YOUR STARTING POINT' : 'NOT SURE WHERE TO START?'}</span><h2>${state.assessment ? `建議從「${stages[state.assessment.stage].name}」出發` : '不確定從哪開始？先來一場暖身。'}</h2><p>6 題情境測驗 · 約 2 分鐘 · 可以重測，也可以自由探索其他階段</p></div><button class="button" data-action="quiz">${state.assessment ? '重新測驗' : '開始起點小測驗'} ↗</button></section><div class="map-layout"><div class="journey" aria-label="學習階段">${stages.map((s, i) => `<button class="journey-node ${mapStage === i ? 'selected' : ''}" data-action="map-stage" data-stage="${i}" aria-pressed="${mapStage === i}">${stageIcon(i)}<div><span class="node-index">LEVEL ${s.number} / ${s.label}</span>${state.assessment?.stage === i ? '<span class="node-badge">推薦起點</span>' : ''}<h3>${s.name}${state.completed.includes(s.id) ? ' ✓' : ''}</h3><p>${s.description}</p></div></button>`).join('')}</div><aside><div class="panel map-detail" id="map-detail"></div><div class="xp-card"><span class="eyebrow" style="color:#c6b2da">YOUR ADVENTURE LOG</span><div class="xp-num">${experience(state.completed)} <small>XP</small></div><div class="badge-row">${stages.map((s, i) => `<span class="achievement ${state.completed.includes(s.id) ? 'earned' : ''}" title="${s.name}${state.completed.includes(s.id) ? '：已完成任務' : '：尚未完成任務'}">${symbols[i]}</span>`).join('')}</div><p>答對任務累積經驗值，同一關只獲獎一次。<br>這是學習成就，與購課權限、折抵金分開。</p></div></aside></div></div>`;
  mapDetail();
}
function mapDetail() {
  const s = stages[mapStage], c = courseById(s.courseId), done = state.completed.includes(s.id);
  $('#map-detail').innerHTML = `${stageIcon(mapStage)}<span class="section-kicker">${s.skill}</span><h3>${s.name}</h3><p>${s.description}</p><ul>${c.outcomes.map(t => `<li>${escape(t)}</li>`).join('')}</ul><button class="button button-outline" data-action="quest" data-stage="${mapStage}">${done ? '再次練習' : `挑戰暖身關卡 ＋${s.xp} XP`} ↗</button><br>${c.published ? `<a class="text-link" href="#course/${c.id}">推薦課程：${escape(c.category)} →</a>` : '<p class="muted">對應課程準備中，可先挑戰暖身任務。</p>'}`;
}
function startQuiz() { stopCarousel(); quizAnswers = []; quizIndex = 0; quizQuestion(); }
function quizQuestion() {
  const q = questions[quizIndex];
  openDialog(`<span class="section-kicker">找到起點小測驗 · ${quizIndex + 1} / ${questions.length}</span><div class="quiz-progress" aria-label="第 ${quizIndex + 1} 題，共 ${questions.length} 題">${questions.map((_, i) => `<span class="${i <= quizIndex ? 'filled' : ''}"></span>`).join('')}</div><h2 id="modal-title" class="modal-heading">${q.title}</h2><p class="modal-subtitle">選最接近你判斷的答案。不確定也沒關係，這是幫你找起點。</p><div class="quiz-options">${q.choices.map((choice, i) => `<button class="quiz-option ${quizAnswers[quizIndex] === i ? 'selected' : ''}" data-action="quiz-answer" data-answer="${i}" aria-pressed="${quizAnswers[quizIndex] === i}"><span class="quiz-letter">${'ABC'[i]}</span>${choice}</button>`).join('')}</div><div class="modal-actions">${quizIndex ? '<button class="button button-outline" data-action="quiz-back">← 上一題</button>' : ''}<button class="button" data-action="quiz-next" ${quizAnswers[quizIndex] === undefined ? 'disabled' : ''}>${quizIndex === questions.length - 1 ? '查看我的學習起點' : '下一題 →'}</button></div>`);
}
function quizResult() {
  const result = assess(quizAnswers); state.assessment = result; state.answers = [...quizAnswers]; mapStage = result.stage; save();
  openDialog(`<span class="section-kicker">YOUR JOURNEY STARTS HERE</span><h2 id="modal-title" class="modal-heading">從「${stages[result.stage].name}」出發，<br>剛剛好。</h2><p class="modal-subtitle">這次答對 ${result.correct} / ${result.total} 題。依最早出現的基礎缺口安排起點；這不是證照評量，也不限制你選其他課程。</p><div class="result-bars">${stages.map((s, i) => `<div><span>${s.skill}</span><div class="progress-track"><span style="width:${result.mastery[i] * 100}%"></span></div><span>${result.scores[i]}/${result.totals[i]}</span></div>`).join('')}</div><div class="success-box">下一步：${stages[result.stage].description}</div><div class="modal-actions"><button class="button" data-action="quiz-go-map">打開我的學習地圖 ↗</button><button class="text-link" data-action="quiz">重新測驗</button></div>`);
}
function quest(index) {
  const q = quests[index]; if (!q) return;
  openDialog(`<span class="section-kicker">${stages[index].name} · 暖身任務</span><h2 id="modal-title" class="modal-heading">${q.title}</h2><p>${q.question}</p><div class="quiz-options">${q.choices.map((a, i) => `<button class="quiz-option" data-action="quest-answer" data-stage="${index}" data-answer="${i}"><span class="quiz-letter">${'ABC'[i]}</span>${a}</button>`).join('')}</div><div id="quest-feedback" aria-live="polite"></div>`);
}

function member() {
  const progress = Math.round(state.progress), xp = experience(state.completed), c = initialCourses[0];
  main.innerHTML = `<div class="wrap"><div class="page-heading"><span class="eyebrow">A LITTLE PROGRESS, EVERY DAY</span><h1>歡迎回來，學習探險家。</h1><p>不用一步到位。今天再前進一小步，就很好。</p></div><div class="member-layout"><aside class="panel member-side"><div class="avatar" aria-hidden="true">✦</div><h3>學習探險家</h3><span class="pill">訪客體驗模式</span><div class="side-links"><a href="#member">◷ 我的學習紀錄</a><a href="#map">⚑ 地圖與成就</a><a href="#coaching">◎ 個教預約</a><button class="text-link" data-action="reset">清除這台裝置的體驗紀錄</button></div></aside><div><div class="stats-grid"><div class="stat"><strong>${xp}<small> XP</small></strong><span>累積學習經驗</span></div><div class="stat"><strong>${state.completed.length}<small> / 4</small></strong><span>已完成暖身任務</span></div><div class="stat"><strong>${state.bookings.length}</strong><span>體驗預約草稿</span></div></div><h3>繼續你的學習</h3><div class="continue-card">${courseVisual(c)}<div class="continue-copy"><span class="section-kicker">免費播放體驗 · 不代表已購課</span><h3>先感受一下，自己的學習節奏。</h3><p class="muted" style="font-size:14px;margin-bottom:0">使用公開示範影片體驗播放與進度記憶。</p><div class="progress-track"><span style="width:${progress}%"></span></div><button class="button button-small" data-action="video">${progress > 0 && progress < 100 ? '接續播放' : '開啟播放體驗'} ↗</button><small class="muted"> 已看 ${progress}%</small></div></div><div class="two-col"><div class="panel"><h3>我的方案草稿</h3>${state.orders.length ? state.orders.slice().reverse().map(o => `<div class="order-item"><strong>${escape(courseById(o.courseId)?.title)}</strong>${o.kind === 'coaching' ? '錄播＋個教' : '錄播自學'} · ${money(o.amount)}<br><small>草稿 · 未付款 · 未開通授權</small></div>`).join('') : '<div class="empty">還沒有方案草稿。<br><a class="text-link" href="#courses">探索適合的課程 →</a></div>'}</div><div class="panel"><h3>下一站，去哪裡？</h3><p>${state.assessment ? `你的推薦起點是「${stages[state.assessment.stage].name}」，先挑戰一個暖身任務吧。` : '先用 6 道情境題找到學習起點，再挑選適合自己的課程。'}</p><a href="#map" class="button button-outline">前往學習地圖 ↗</a></div></div><p class="note">${storageAvailable ? '體驗紀錄只保存在這台瀏覽器，尚未建立正式會員帳號，不會跨裝置同步。' : '目前瀏覽器儲存不可用，體驗紀錄只會保留到頁面關閉。'}</p></div></div></div>`;
}

function coaching() {
  const min = dateInTaipei(new Date(Date.now() + 73 * 3600 * 1000));
  main.innerHTML = `<div class="wrap"><div class="page-heading"><span class="eyebrow">YOUR NEXT BREAKTHROUGH, TOGETHER</span><h1>帶著問題來，<br>帶著下一步回去。</h1><p>1 對 1 個教，透過 Zoom 和業師專注討論你的作品與卡關。影音由外部平台承載，精五門負責課程、堂數與預約管理。</p></div><div class="two-col"><div class="panel"><span class="section-kicker">HOW IT WORKS</span><h3>把時間留給真正的練習。</h3><ul><li>選購含個教的方案，付款確認後取得堂數。</li><li>選擇業師時段，附上主題與希望獲得的協助。</li><li>預約確認後，在私人預約頁取得 Zoom 連結。</li><li>準時加入，每堂 60 分鐘，聚焦解決一個問題。</li></ul><p class="note">暫定規則：提前 72 小時預約；課前 48 小時可改期或取消並歸還堂數。正式規則將於營運驗收確認。會議使用等候室與密碼，連結不公開展示。</p><button class="text-link" data-action="quote">先規劃我的個教方案 →</button></div><div class="panel"><span class="section-kicker">TRY THE BOOKING FLOW</span><h3>試排一堂，看看流程。</h3><form id="booking-form" class="form-grid"><label class="field">業師<select name="instructor"><option value="mentor-ai">AI 實作業師 · 示範排班</option></select></label><div class="form-row"><label class="field">日期<input name="date" type="date" min="${min}" value="${min}" required></label><label class="field">時段（台北時間）<select name="slot"><option value="14:00">14:00–15:00</option><option value="16:00">16:00–17:00</option><option value="19:00">19:00–20:00</option></select></label></div><label class="field">這次想一起解決什麼？<textarea name="topic" minlength="4" maxlength="500" required placeholder="例如：想請老師檢視我的自動化流程，看看錯誤處理可以怎麼改善。"></textarea></label><p class="note warn">這是預約流程體驗，不會保留真實時段、不會扣堂數，也不會寄信或建立 Zoom 會議。</p><button class="button" type="submit">保存體驗預約草稿 ↗</button><p id="booking-error" class="error-text" role="alert"></p></form></div></div><section class="panel" style="margin-bottom:40px"><h3>我的體驗預約</h3><div id="booking-list">${bookingList()}</div></section></div>`;
  $('#booking-form').addEventListener('submit', e => { e.preventDefault(); const f = new FormData(e.target); try { const booking = validateBooking({ date: f.get('date'), slot: f.get('slot'), topic: f.get('topic'), existing: state.bookings }); state.bookings.push({ ...booking, id: crypto.randomUUID() }); save(); $('#booking-list').innerHTML = bookingList(); $('#booking-error').textContent = ''; toast('體驗預約草稿已保存，尚未預約真實時段。'); } catch (err) { $('#booking-error').textContent = err.message; } });
}
function bookingList() { return state.bookings.length ? state.bookings.map(b => `<div class="booking-item"><strong>${escape(b.date)} · ${escape(b.slot)}（Asia/Taipei）</strong>${escape(b.topic)}<br><small>草稿 · 未確認 · Zoom 連結於正式預約確認後提供</small><br><button class="text-link" data-action="remove-booking" data-id="${escape(b.id)}">移除此草稿</button></div>`).join('') : '<div class="empty">還沒有預約草稿。先試試上方的預約流程吧。</div>'; }

function video() {
  main.innerHTML = `<div class="wrap"><div class="page-heading"><a class="text-link" href="#member">← 我的學習</a><h1>每一次練習，都是前進。</h1><p>免費播放器驗收示範。此影片不是正式課程內容，不代表已取得付費課程授權。</p></div><div class="video-layout"><div><video id="learning-video" controls playsinline preload="metadata" aria-label="公開花卉示範影片"><source src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" type="video/mp4">你的瀏覽器不支援影片播放。</video><div class="video-panel"><span class="section-kicker">播放體驗 / 單元 01</span><h2>先從一次小小的練習開始</h2><p class="muted" style="font-size:15px">使用影片本身的播放控制、暫停與跳轉；進度依實際播放位置保存。</p><div class="progress-track"><span id="video-progress" style="width:${state.progress}%"></span></div><p id="video-status" class="field-hint" aria-live="polite">影片載入中。上次播放位置 ${Math.round(state.progress)}%。</p><p class="note">正式版將由後端驗證購課資格，並提供受保護的影片播放 Token。示範來源：MDN 公開 CC0 影片。</p></div></div><aside class="panel"><h3>這一次，先體驗</h3><div class="lesson-list"><div class="lesson-row">▷ 01 · 播放與進度記憶<br><small>免費示範</small></div><div class="lesson-row locked">▣ 正式課程章節<br><small>付款開課與影片保護於後續階段串接</small></div></div><a href="#map" class="button button-outline button-small">試試暖身闖關 ↗</a></aside></div></div>`;
  const v = $('#learning-video'); let lastSave = 0;
  v.addEventListener('loadedmetadata', () => { if (Number.isFinite(v.duration) && state.progress < 99) v.currentTime = v.duration * state.progress / 100; $('#video-status').textContent = '影片已就緒；按播放開始練習。'; });
  const update = (force = false) => { if (!Number.isFinite(v.duration) || v.duration <= 0) return; state.progress = Math.min(100, v.currentTime / v.duration * 100); $('#video-progress').style.width = `${state.progress}%`; $('#video-status').textContent = `已播放 ${Math.round(state.progress)}% · ${Math.floor(v.currentTime)} / ${Math.floor(v.duration)} 秒`; if (force || Date.now() - lastSave > 5000) { save(); lastSave = Date.now(); } };
  v.addEventListener('timeupdate', () => update()); v.addEventListener('pause', () => update(true)); v.addEventListener('ended', () => update(true));
  v.addEventListener('error', () => { $('#video-status').textContent = '示範影片暫時無法載入，請確認網路連線後重試。'; });
}

function admin() {
  main.innerHTML = `<div class="wrap"><div class="page-heading"><span class="eyebrow">COURSE WORKSPACE / PREVIEW</span><h1>把好課，整理得更清楚。</h1><p>第一階段管理介面體驗。這不是正式管理後台；修改只影響此瀏覽器的示範資料。</p></div><p class="note warn">正式後台需登入、後端角色驗證與操作稽核。此頁不存放任何真實會員、金流設定或秘密。</p><section class="panel" style="margin:25px 0 40px"><div class="admin-controls"><h2>課程管理</h2><button class="button button-small button-outline" data-action="restore-courses">還原示範課程</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>課程</th><th>程度</th><th>錄播方案</th><th>陪跑方案</th><th>狀態</th><th>操作</th></tr></thead><tbody>${state.courses.map(c => `<tr><td><strong>${escape(c.title)}</strong><br><small class="muted">${c.id}</small></td><td>${stages[c.stage].short}</td><td>${money(c.price)}</td><td>${money(c.coachingPrice)}</td><td><span class="pill">${c.published ? '上架' : '草稿'}</span></td><td><button class="text-link" data-action="edit-course" data-id="${c.id}">編輯</button></td></tr>`).join('')}</tbody></table></div></section></div>`;
}
function editCourse(id) {
  const c = courseById(id); if (!c) return;
  openDialog(`<span class="section-kicker">EDIT COURSE / PREVIEW</span><h2 id="modal-title" class="modal-heading">編輯課程</h2><form id="course-form" class="form-grid"><label class="field">課程名稱<input name="title" value="${escape(c.title)}" minlength="4" maxlength="80" required></label><label class="field">程度<select name="stage">${stages.map((s, i) => `<option value="${i}" ${i === c.stage ? 'selected' : ''}>${s.short}</option>`).join('')}</select></label><div class="form-row"><label class="field">錄播價格（TWD）<input name="price" type="number" min="0" step="1" value="${c.price}" required></label><label class="field">陪跑價格（含 ${c.credits} 堂）<input name="coachingPrice" type="number" min="0" step="1" value="${c.coachingPrice}" required></label></div><label class="field">上架狀態<select name="published"><option value="true" ${c.published ? 'selected' : ''}>上架</option><option value="false" ${!c.published ? 'selected' : ''}>草稿（不出現在商城）</option></select></label><p class="note">只修改本機驗收資料。正式版會由伺服器驗證管理權限、資料與價格版本。</p><button class="button" type="submit">保存體驗修改</button><p class="error-text" id="course-error" role="alert"></p></form>`);
  $('#course-form').addEventListener('submit', e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.target)); try { const update = validateCourse({ ...values, published: values.published === 'true' }); Object.assign(c, update); save(); closeDialog(); admin(); toast('課程體驗修改已保存到這台瀏覽器。'); } catch (err) { $('#course-error').textContent = err.message; } });
}

function route() {
  const oldVideo = $('#learning-video'); if (oldVideo) oldVideo.pause();
  stopCarousel(); if (modal.open) closeDialog();
  const [page = 'home', id] = location.hash.slice(1).split('/');
  $$('[data-nav]').forEach(a => { const active = a.dataset.nav === page || (page === 'course' && a.dataset.nav === 'courses'); a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const handlers = { home, courses: catalog, map, member, coaching, admin, video, course: () => detail(id) };
  (handlers[page] ?? home)();
  document.title = `${({ home: '學得精 • 學得快 • 學得好', courses: '探索課程', map: 'AI 學習地圖', member: '我的學習', coaching: '1 對 1 個教', admin: '課程管理預覽', video: '影片學習體驗', course: '課程介紹' })[page] ?? '首頁'}｜精五門 PentaSkill`;
  window.scrollTo({ top: 0, behavior: 'instant' });
}
window.addEventListener('hashchange', () => { route(); main.focus({ preventScroll: true }); });
document.addEventListener('click', e => {
  const button = e.target.closest('[data-action]'); if (!button || button.disabled) return;
  const a = button.dataset.action, id = button.dataset.id;
  if (a === 'quiz') startQuiz();
  if (a === 'close-modal') closeDialog();
  if (a === 'filter') { filter = button.dataset.filter; carouselIndex = 0; $$('[data-action="filter"]').forEach(b => { b.classList.toggle('active', b.dataset.filter === filter); b.setAttribute('aria-pressed', String(b.dataset.filter === filter)); }); if ($('#featured-grid')) renderFeatured(); else renderCatalog(); }
  if (a === 'prev-slide' || a === 'next-slide') { stopCarousel(); carouselIndex += a === 'next-slide' ? 1 : -1; renderFeatured(); }
  if (a === 'pause-carousel') { if (carouselTimer) stopCarousel(); else startCarousel(); }
  if (a === 'map-stage') { mapStage = Number(button.dataset.stage); $$('.journey-node').forEach(b => { b.classList.toggle('selected', Number(b.dataset.stage) === mapStage); b.setAttribute('aria-pressed', String(Number(b.dataset.stage) === mapStage)); }); mapDetail(); }
  if (a === 'quiz-answer') { quizAnswers[quizIndex] = Number(button.dataset.answer); $$('.quiz-option', content).forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); }); $('[data-action="quiz-next"]').disabled = false; }
  if (a === 'quiz-next' && quizAnswers[quizIndex] !== undefined) { if (quizIndex < questions.length - 1) { quizIndex++; quizQuestion(); } else quizResult(); }
  if (a === 'quiz-back') { quizIndex--; quizQuestion(); }
  if (a === 'quiz-go-map') { closeDialog(); if (location.hash === '#map') map(); else location.hash = 'map'; }
  if (a === 'quest') quest(Number(button.dataset.stage));
  if (a === 'quest-answer') {
    const i = Number(button.dataset.stage), correct = Number(button.dataset.answer) === quests[i].correct;
    const result = awardQuest(state.completed, i, correct); state.completed = result.completed; save();
    const feedback = $('#quest-feedback'); feedback.className = correct ? 'success-box' : 'note warn'; feedback.textContent = correct ? `${quests[i].explanation} ${result.earned ? `獲得 ${result.earned} XP！` : '這關已領過經驗值，複習也很棒。'}` : '再想想，選擇可以驗證、可追蹤，也能保護資料的做法。';
    if (correct) { $$('[data-action="quest-answer"]', content).forEach(b => b.disabled = true); const go = document.createElement('button'); go.className = 'button'; go.style.marginTop = '18px'; go.textContent = '回到學習地圖 ↗'; go.dataset.action = 'quiz-go-map'; feedback.after(go); }
  }
  if (a === 'order') previewOrder(id);
  if (a === 'save-order') { const c = courseById(id); if (!c?.published) return; const existing = state.orders.find(o => o.courseId === id && o.kind === button.dataset.plan && o.amount === pricePlan(c, button.dataset.plan).amount); if (!existing) state.orders.push(createPreviewOrder(c, button.dataset.plan, crypto.randomUUID())); save(); closeDialog(); toast(existing ? '這個方案已經保存在草稿中。' : '方案草稿已保存，可在「我的學習」查看。'); }
  if (a === 'quote') quote(id);
  if (a === 'video') location.hash = 'video';
  if (a === 'remove-booking') { state.bookings = state.bookings.filter(b => b.id !== id); save(); $('#booking-list').innerHTML = bookingList(); toast('體驗預約草稿已移除。'); }
  if (a === 'edit-course') editCourse(id);
  if (a === 'restore-courses') { state.courses = structuredClone(initialCourses); save(); admin(); toast('已還原示範課程。'); }
  if (a === 'reset') openDialog('<h2 id="modal-title" class="modal-heading">清除這台裝置的體驗紀錄？</h2><p class="modal-subtitle">會清除測驗結果、XP、播放進度、方案與預約草稿，並還原課程示範資料。</p><div class="modal-actions"><button class="button" data-action="confirm-reset">確認清除</button><button class="button button-outline" data-action="close-modal">保留紀錄</button></div>');
  if (a === 'confirm-reset') { state = { completed: [], assessment: null, orders: [], bookings: [], progress: 0, courses: structuredClone(initialCourses) }; save(); mapStage = 0; closeDialog(); member(); toast('這台裝置的體驗紀錄已清除。'); }
});
route();

window.addEventListener('resize', () => { if (document.querySelector('#featured-grid')) renderFeatured(); });
