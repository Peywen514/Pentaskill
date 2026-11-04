export const stages = [
  { id: 'beginner', number: '01', name: 'AI 新手村', short: 'AI 新手', label: '從好奇開始', description: '認識 AI、寫出清楚的提問，讓日常工作輕一點。', skill: 'AI 素養與提示', color: 'violet', courseId: 'ai-starter', quest: '辨識可靠的 AI 使用方式', xp: 50 },
  { id: 'theory', number: '02', name: '原理探索林', short: '理論基礎', label: '理解為什麼', description: '搞懂模型、資料與限制，建立自己的判斷力。', skill: '模型與資料觀念', color: 'blue', courseId: 'ai-foundations', quest: '破解模型幻覺迷思', xp: 80 },
  { id: 'practice', number: '03', name: '實作練功場', short: '進階實作', label: '把想法做出來', description: '串起工具與流程，做出能解決真實問題的作品。', skill: '工作流程與 API', color: 'pink', courseId: 'ai-workflows', quest: '設計可靠的自動化流程', xp: 100 },
  { id: 'developer', number: '04', name: '開發者基地', short: '開發者', label: '打造自己的工具', description: '用程式、檢索與測試，把 AI 變成可用的產品。', skill: '開發、評估與部署', color: 'purple', courseId: 'ai-developer', quest: '守住應用程式的金鑰', xp: 120 }
];

export const initialCourses = [
  { id: 'ai-starter', stage: 0, category: 'AI 入門', title: 'AI 不難，從你的第一個好問題開始', subtitle: 'AI 入門 × 提示設計 × 日常效率', description: '不需要程式基礎。從清楚描述任務、補足情境到驗證答案，建立真正用得上的 AI 使用習慣。', instructor: '精五門教學團隊', duration: '3 小時 20 分', lessons: 12, price: 1680, coachingPrice: 4880, credits: 2, art: 'prompt', color: 'violet', badge: '新手首選', published: true, outcomes: ['寫出含情境與限制的提示', '檢查 AI 回答的可靠性', '完成一份自己的工作小助手模板'] },
  { id: 'ai-foundations', stage: 1, category: '理論基礎', title: '看懂 AI 的底層邏輯，不再只會下指令', subtitle: '大型語言模型 × 資料 × AI 素養', description: '用直觀的案例理解模型如何學習、為什麼會出錯，以及什麼時候需要人類的判斷。', instructor: '精五門教學團隊', duration: '4 小時 10 分', lessons: 16, price: 2280, coachingPrice: 5480, credits: 2, art: 'nodes', color: 'blue', badge: '觀念打底', published: true, outcomes: ['理解生成模型的限制', '區分訓練與推論', '規劃資料品質與驗證方式'] },
  { id: 'ai-workflows', stage: 2, category: '進階實作', title: '把重複工作交給 AI：打造你的自動化流程', subtitle: '工作流程 × API × 實戰專案', description: '把零散工具串成有輸入、驗證與錯誤處理的流程，做出一個實際可交付的小專案。', instructor: '精五門教學團隊', duration: '6 小時 30 分', lessons: 24, price: 3280, coachingPrice: 6480, credits: 2, art: 'workflow', color: 'pink', badge: '實作推薦', published: true, outcomes: ['設計多步驟工作流程', '串接 API 與結構化輸出', '處理失敗、重試與人工確認'] },
  { id: 'ai-developer', stage: 3, category: 'AI 開發', title: '從零到作品：開發你的第一個 AI 應用', subtitle: '程式開發 × RAG × 評估與部署', description: '讓原型走向可靠的應用。從資料檢索到金鑰管理，用測試與評估驗證產品是否真的有用。', instructor: '精五門教學團隊', duration: '8 小時 15 分', lessons: 32, price: 4280, coachingPrice: 7480, credits: 2, art: 'code', color: 'purple', badge: '挑戰進階', published: true, outcomes: ['建立具檢索能力的 AI 應用', '保護伺服器端密鑰', '建立測試集並部署作品'] }
];

export const questions = [
  { id: 'goal', dimension: 0, title: '你想請 AI 幫忙整理會議紀錄，哪一種指令比較好？', choices: ['「幫我整理一下。」', '「依這份紀錄整理決議、待辦與負責人；沒寫到的資訊請標示缺漏。」', '「寫得厲害一點，內容不夠就自行補齊。」'], correct: 1 },
  { id: 'verify', dimension: 0, title: 'AI 給你一個看起來很精確的數字，下一步是？', choices: ['數字很精確，直接引用', '換個語氣再問一次就足夠', '查核原始來源、日期與計算方式'], correct: 2 },
  { id: 'model', dimension: 1, title: '為什麼語言模型有時會很有自信地答錯？', choices: ['生成合理文字不等於完成事實查核', '它永遠可以讀到所有最新資料', '只要模型夠大就不會答錯'], correct: 0 },
  { id: 'data', dimension: 1, title: '公司想用自己的內部文件回答問題，哪個觀念較正確？', choices: ['把文件名稱寫進提示就能讀到全文', '需要有權限控制的檢索流程，並檢查引用與資料版本', '把所有文件公開最方便'], correct: 1 },
  { id: 'workflow', dimension: 2, title: '自動產生報價單時，哪個流程較可靠？', choices: ['AI 直接決定價格並寄出', '失敗時無限重試同一請求', '從商品資料取價、驗證欄位，必要時人工確認並記錄結果'], correct: 2 },
  { id: 'security', dimension: 3, title: 'AI 服務的 API 金鑰應放在哪裡？', choices: ['伺服器端的秘密設定，依使用者身分控制存取', '網頁的 JavaScript，藏起按鈕就好', '公開 GitHub，大家開發比較方便'], correct: 0 }
];

export const quests = [
  { stage: 0, title: '小怪：有自信的錯答案', question: 'AI 說：「這個統計數字一定正確。」你會怎麼做？', choices: ['直接放進報告', '檢查原始來源與日期', '只把文字改得保守一點'], correct: 1, explanation: '答對了！先查核來源與時效，再決定是否引用。可靠的判斷比漂亮的答案更重要。' },
  { stage: 1, title: '小怪：無所不知的模型', question: '哪一個說法正確？', choices: ['模型生成的每個來源都是真實的', '檢索可以提供資料，但仍需驗證回答與引用', '提供更多資料就完全不會有幻覺'], correct: 1, explanation: '答對了！檢索有助於提供依據，但仍需要權限、版本、引用與回答品質的驗證。' },
  { stage: 2, title: '小怪：失控的工作流程', question: '付款 API 逾時後，要重試時最需要什麼？', choices: ['每次都建立一筆新交易', '不檢查結果，直接顯示成功', '查詢交易狀態，並用冪等識別避免重複扣款'], correct: 2, explanation: '答對了！先確認交易狀態，再使用冪等設計避免重複執行。' },
  { stage: 3, title: '魔王：外洩的金鑰', question: '一把 API 金鑰曾被提交到公開儲存庫，應該？', choices: ['撤銷並更換金鑰，再檢查存取紀錄與外洩範圍', '只刪掉最新版本的那一行', '把儲存庫改名即可'], correct: 0, explanation: '答對了！公開過的金鑰必須視為外洩，刪除檔案無法讓舊金鑰重新安全。' }
];
