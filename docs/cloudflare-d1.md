# 新版 Cloudflare D1 搬移與會員檢閱

日期：2026-11-04。此文件針對全新的 Pentaskill 儲存庫與雲端部署，沒有使用舊站資料庫。

## 新資源

| 項目 | 設定 |
| --- | --- |
| 網站 | https://pentaskill-v2.pey514514.workers.dev |
| 新 Worker | `pentaskill-v2` |
| 新 D1 | `pentaskill-members-v2-20261104` |
| D1 ID | `ce99a8e9-a19a-4a92-8494-5be318945f6a` |
| Worker 資料庫綁定 | `DB` |
| 區域 | APAC |

D1 是 Cloudflare 帳號層級的資料庫，透過 binding 給 Worker 使用，不是某個網站中的資料夾。舊站的 Worker、KV 與資料庫未被修改。

## 搬移與驗證結果

- 匯入 1 筆會員與 1 筆角色異動紀錄，原密碼雜湊與管理者身分保留。
- 在私有檔案中以全部欄位的 SHA-256 指紋比對，確認資料完全一致，未把雜湊內容列印到輸出。
- 舊 Session 不搬移；切換後需要重新登入。
- 雲端首頁、註冊、原密碼演算法登入、Secure Cookie、學員越權拒絕、跨站寫入拒絕及登出實測通過。測試用帳號已移除，不影響原會員。
- 原本 `.data/pentaskill.sqlite` 及搬移前備份保留在本機、未追蹤的 `.data/d1-migration/`。目前網站不使用這些本機檔案提供會員服務。
- 本機 `npm run dev` 只將舊預覽入口轉向雲端，不再於本機建立正式會員。

本次搬移的是會員、角色與角色異動。XP、學習進度、方案草稿與體驗預約仍為前端本機體驗資料，尚未搬移；正式訂單、付款、預約通知及 Zoom 串接也尚未啟用。

## 方法一：網站管理中心（建議日常使用）

1. 前往網站 `#login`，使用自己的管理者帳密登入。
2. 點管理中心的「檢閱會員資料」，或直接開啟 `#members`。
3. 可以搜尋姓名／Email、依學員／講師／管理者篩選、每頁 25 筆翻頁。
4. 清單只提供姓名、Email、身分、啟用狀態與註冊時間，不提供 password_hash、Session、密鑰。

清單由後端驗證 admin 角色，不只在前端隱藏按鈕。匿名回傳 401，學員／講師回傳 403。會員角色修改介面尚未提供。

## 方法二：Cloudflare 控制台（進階檢閱）

1. 登入 https://dash.cloudflare.com/ ，選擇自己的帳號。
2. 前往 Storage & databases／D1，或在控制台搜尋 D1。
3. 選擇 `pentaskill-members-v2-20261104`，開啟 Studio／Console。
4. 使用只讀查詢檢閱需要的欄位，例如：

```sql
SELECT name, email, role, active,
       datetime(created_at / 1000, 'unixepoch', '+8 hours') AS created_taipei
FROM users
ORDER BY created_at DESC
LIMIT 50;
```

不要把 password_hash 當作明文密碼，也不要自行改寫該欄位。`sessions` 與 `auth_limits` 是系統資料，日常檢閱會員不用操作它們。

## 開發與部署

```sh
npm ci
npm run check
npm test
npm run cloud:deploy
```

Cloudflare 設定在 `wrangler.jsonc`。部署前確認 database_id 仍是新版 D1，不得複製舊站設定。Wrangler OAuth 憑證由官方工具保存在使用者設定目錄，不放進 GitHub。

`npm run cloud:dev` 使用本機 D1 模擬環境；需先執行 `npx wrangler d1 migrations apply pentaskill-members-v2-20261104 --local`，這不會修改正式 D1。`npm run dev:sqlite` 是隔離測試用 Node／SQLite 服務，預設 `.data/local-dev.sqlite`，不是正式會員來源。

## 備份與回復

匯出檔包含會員及密碼雜湊，存於被 Git 忽略的 `.data/`，不應放到公開網站或儲存庫。原始備份目前保留供回復，不自動刪除。

不要直接將網站切回搬移前的本機資料庫，否則會遺失切換後新會員；回復前必須先凍結新寫入並匯出最新 D1。正式資料庫可另依 Cloudflare Time Travel／匯出功能規劃備份。

## 官方文件

- [D1 入門與 Worker binding](https://developers.cloudflare.com/d1/get-started/)
- [D1 匯入與匯出](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [D1 查詢與批次操作](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Workers Node Crypto 相容性](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/)
