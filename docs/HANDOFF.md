# 精五門專案交接（2026-11-04）

## 接續工作

本專案是精五門新版，使用者希望分階段開發和驗收。每次先讀本文件、git 狀態與相關程式，再依新需求執行；不要修改舊版 online-learning-platform。修改完成需測試，並依使用者既有要求同步 Pentaskill GitHub 與部署新版 Cloudflare Worker。

## 位置

- GitHub：https://github.com/Peywen514/Pentaskill
- 新版網站：https://pentaskill-v2.pey514514.workers.dev/
- Cloudflare Worker：pentaskill-v2；D1：pentaskill-members-v2-20261104。
- 本機安裝 Node.js 24 或更新版；npm install 後可用 npm run check、npm test、npm run build。npm run dev 會導向雲端網站。
- 雲端部署需在該電腦登入正確的 Cloudflare 帳號並具備權限；不要建立或覆蓋舊站資源，不要將密碼、token、會員資料或本機資料庫提交到 GitHub。
- GitHub 權限和 Cloudflare 登入不會隨 git clone 自動搬移。

## 產品與設計

品牌「精五門 PentaSkill」，淺色紫、藍、粉設計，文字易讀、響應式，主要受眾為上班族和銀髮族；課程不只 AI。主標「學得精 • 學得快 • 學得好」。保留課程商城、會員中心、影片學習、課程管理，規劃個教、方案、報價與付款；未來可用 Zoom。學習地圖包含分級、入門測驗及遊戲化。AI 助教與薪資結算延後。

頁面右下角有舊站 IG 和 LINE 連結，每次重新載入顯示「想領取專屬超值好禮包」提示，可關閉。不要將帳號建立規則放在公開登入畫面。

## 目前狀態與限制

- 會員、角色和登入工作階段使用新 Cloudflare D1；管理者 pey514514@gmail.com，可由登入後管理者中心檢閱會員。密碼由使用者本人保管，不要要求提供。
- 課程、價格、預約和部分課程管理仍為示範，學習進度與預約草稿等仍在瀏覽器本機，尚未跨裝置同步。真實付款、講師連動、影片授權、密碼重設等尚未完成，不應宣稱已上線。
- 原本功能與決策詳見 README.md、docs/requirements.md、docs/architecture.md、docs/authentication.md、docs/cloudflare-d1.md、docs/acceptance.md、docs/decisions.md 及 CHANGELOG.md；按需求查閱，避免一開始讀取所有文件。
- 最近一次完成：放大功能列、加入按鈕樣式，恢復舊站社群圖示和自動出現的提示。32 項既有測試通過；未完成手機版實機目視驗證。
