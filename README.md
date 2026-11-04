# 精五門 PentaSkill 新版

獨立於舊專案的新版開發。**目前為第 1 階段互動原型＋第 2 階段登入基礎，尚未正式營運。**

新版已部署：[精五門 PentaSkill](https://pentaskill-v2.pey514514.workers.dev)。會員、角色與登入憑證現在使用全新的 Cloudflare D1，不依賴本機資料庫。管理者可在 [會員資料](https://pentaskill-v2.pey514514.workers.dev/#members) 登入後搜尋與檢閱帳號。詳見 [D1 搬移與檢閱指南](docs/cloudflare-d1.md)。

## 本階段已實作

- Email／密碼註冊、登入、登出，D1 會員／Session 保存，學員／講師／管理者後端權限檢查與會員清單搜尋。Node／SQLite 保留作隔離開發測試。
- 淺色紫白／霓光紫、青藍、桃紫品牌 UI、放大字級、手機／平板／桌機響應式版型、精選課程輪播（可暫停）。
- 課程商城、程度篩選、關鍵字搜尋、課程介紹、錄播與陪跑方案摘要。
- 四階段 AI 學習地圖：新手 → 理論 → 實作 → 開發者。
- 6 題情境程度測驗，依第一個基礎缺口推薦起點並解釋各維度結果。
- 4 個暖身任務、重複獎勵防止與成就 XP；XP 不涉及金錢或購課授權。
- 訪客會員中心預覽、公開示範影片播放器與實際播放位置記憶。
- 個教預約草稿、台北時區與提前 72 小時檢查；客製堂數示範試算。
- 課程管理預覽：編輯名稱／程度／方案價格／上架狀態。
- 本機資料版本與清除功能；畫面明確標示不是真實交易。

**未實作：驗證信與密碼重設、跨裝置學習資料、真實付款、付款回呼、真實預約鎖定、Zoom 建立會議、正式教材與付費影片、正式課程資料管理。** 登入與後端角色驗證已實作；管理專區中的課程編輯仍為本機預覽。本機草稿不會扣款、開課、占用講師時段或寄信。

## 執行

開發工具使用 Node.js 24 或以上與鎖定版本的 Wrangler；正式網站使用 Workers＋D1。帳號資料已搬到雲端，本機 `.data/` 僅保留私有備份及隔離測試資料。

```sh
npm ci
npm run dev
# http://127.0.0.1:4173 轉向新版雲端網站
npm run check
npm test
npm run build
```

`dist/` 為前端體驗版產物。不要直接將儲存庫根目錄當作靜態網站公開。
正式登入由雲端 Worker 處理，不需要本機開機。`account:create`／`account:role` 現在只允許明確指定測試資料庫使用，不能修改正式 D1 會員；無預設帳密。

## 主要入口

| 路徑 | 用途 |
| --- | --- |
| `#home` | 首頁與精選輪播 |
| `#courses` | 課程商城 |
| `#course/ai-starter` | 課程與方案 |
| `#map` | 學習地圖／程度測驗／闖關 |
| `#member` | 學員登入後的會員中心 |
| `#login`／`#register` | 登入／學員註冊 |
| `#instructor` | 講師登入後的專區入口 |
| `#members` | 管理者專用會員清單 |
| `#video` | CC0 影片播放體驗 |
| `#coaching` | 個教與預約草稿 |
| `#admin` | 管理者登入後的課程管理預覽 |

## 開發紀錄

- [需求與分階段計畫](docs/requirements.md)
- [系統架構與資料流程](docs/architecture.md)
- [驗收清單與驗證結果](docs/acceptance.md)
- [決策與待確認事項](docs/decisions.md)
- [參考平台與研究來源](docs/research.md)
- [變更紀錄](CHANGELOG.md)
- [登入與帳號管理](docs/authentication.md)
- [Cloudflare D1 搬移與會員檢閱](docs/cloudflare-d1.md)

## 外部資源

字型：Google Fonts Noto Sans TC（離線時使用系統字型）。示範影片：MDN `cc0-videos/flower.mp4`。Logo 使用提供圖片的透明去背版本，原始 PNG 保留，網站保持等比例完整顯示；課程插畫為程式繪製 SVG。去背方式與提示記錄於 [素材處理紀錄](docs/asset-edits.md)。未沿用舊站帳戶或密鑰。課程、價格與業師名稱都是新版驗收用內容，待使用者確認後再置換成正式資料。
