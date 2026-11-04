import { questions, stages } from './catalog.js';

export function assess(answers) {
  if (!Array.isArray(answers) || answers.length !== questions.length || answers.some((a, i) => !Number.isInteger(a) || a < 0 || a >= questions[i].choices.length)) throw new Error('請完成所有題目');
  const scores = [0, 0, 0, 0], totals = [0, 0, 0, 0];
  questions.forEach((q, i) => { totals[q.dimension]++; if (answers[i] === q.correct) scores[q.dimension]++; });
  const mastery = scores.map((score, i) => score / totals[i]);
  // 從第一個有缺口的基礎開始，不讓高階題掩蓋基礎不足。
  let stage = mastery.findIndex(value => value < 1);
  if (stage < 0) stage = 3;
  return { stage, scores, totals, mastery, courseId: stages[stage].courseId, correct: scores.reduce((a, b) => a + b, 0), total: questions.length, version: 1 };
}

export function awardQuest(completed, stageIndex, correct) {
  if (!Array.isArray(completed) || !Number.isInteger(stageIndex) || !stages[stageIndex]) throw new Error('無效的任務');
  const unique = [...new Set(completed.filter(id => stages.some(s => s.id === id)))];
  const id = stages[stageIndex].id;
  if (!correct || unique.includes(id)) return { completed: unique, earned: 0 };
  return { completed: [...unique, id], earned: stages[stageIndex].xp };
}

export function experience(completed = []) {
  return stages.filter(s => completed.includes(s.id)).reduce((sum, s) => sum + s.xp, 0);
}

export function pricePlan(course, kind) {
  if (!course || !['recorded', 'coaching'].includes(kind)) throw new Error('請選擇有效方案');
  const amount = kind === 'coaching' ? course.coachingPrice : course.price;
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('價格必須為非負整數');
  return { courseId: course.id, kind, amount, currency: 'TWD', coachingCredits: kind === 'coaching' ? course.credits : 0 };
}

export function createPreviewOrder(course, kind, id) {
  if (!id) throw new Error('缺少訂單識別碼');
  return { id, ...pricePlan(course, kind), status: 'preview_draft', paid: false, entitlements: [], createdAt: new Date().toISOString() };
}

export function validateCourse(input) {
  const title = String(input.title ?? '').trim();
  if (title.length < 4 || title.length > 80) throw new Error('課程名稱需為 4–80 個字');
  const price = Number(input.price), coachingPrice = Number(input.coachingPrice);
  if (!Number.isSafeInteger(price) || price < 0 || !Number.isSafeInteger(coachingPrice) || coachingPrice < price) throw new Error('價格需為整數，陪跑方案不可低於錄播方案');
  if (!Number.isInteger(Number(input.stage)) || Number(input.stage) < 0 || Number(input.stage) > 3) throw new Error('請選擇有效程度');
  return { title, price, coachingPrice, stage: Number(input.stage), published: Boolean(input.published) };
}

export function dateInTaipei(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function validateBooking({ date, slot, topic, existing = [], now = new Date() }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['14:00', '16:00', '19:00'].includes(slot)) throw new Error('請選擇有效日期與時段');
  const start = new Date(`${date}T${slot}:00+08:00`);
  if (!Number.isFinite(start.getTime()) || dateInTaipei(start) !== date) throw new Error('日期無效');
  if (start.getTime() - now.getTime() < 72 * 3600 * 1000) throw new Error('請至少提前 72 小時預約');
  if (String(topic ?? '').trim().length < 4) throw new Error('請用至少 4 個字描述想討論的主題');
  if (existing.some(b => b.date === date && b.slot === slot && b.status !== 'cancelled')) throw new Error('這個時段已有體驗預約，請選其他時間');
  return { date, slot, topic: topic.trim(), startsAt: start.toISOString(), timeZone: 'Asia/Taipei', durationMinutes: 60, provider: 'zoom', status: 'preview_request', meetingUrl: null };
}
