# 登入與身分管理

版本：0.2.0，2026-11-04。此階段新增可運作的 Email／密碼登入後端；尚未完成正式上線驗收。

## 試用

1. 使用 Node.js 24 或以上，在專案目錄執行 `npm run dev`。
2. 開啟 `http://127.0.0.1:4173/#register`，建立自己的學員帳號。
3. 登入入口為 `#login`；右上方可前往對應專區或登出。
4. 帳號與 Session 存在本機 `.data/pentaskill.sqlite`，重啟伺服器後保留。該目錄已被 Git 忽略，不會上傳會員資料。

不要用 `dist/` 的純靜態服務取代 Node 後端；靜態檔案本身不能處理登入。

## 角色

| 身分 | 建立方式 | 專區與目前範圍 |
| --- | --- | --- |
| student 學員 | 公開註冊 | `#member`；個人基本資料及帳號分開的本機學習體驗紀錄 |
| instructor 講師 | 伺服器操作人員建立 | `#instructor`；講師專區入口，預約同步仍未開放 |
| admin 管理者 | 伺服器操作人員建立 | `#admin`；後端驗證角色後才進入課程管理預覽，課程修改仍是本機示範資料 |

公開註冊永遠建立 student，忽略前端傳入的 role、餘額及購課欄位。管理者與講師沒有預設帳密。

## 建立講師或管理者

在持有正式後端主機權限的終端執行：

```sh
npm run account:create
```

依序填寫 Email、顯示名稱、角色、密碼及確認密碼。密碼輸入不顯示，不接受命令列密碼參數。不需在對話或 GitHub 貼出密碼。此命令會建立新帳號，已存在的 Email 不會被覆寫或自動升權。

此管理工具以後端主機存取權為信任邊界，不開放到公開 HTTP。正式多人營運前還需管理者邀請、稽核、角色異動與帳號停用操作介面。

## 已實作的保護

- Node scrypt：N=32768、r=8、p=3，16 bytes 隨機 Salt；密碼長度 12–128 字元，不自動 trim 密碼。
- 隨機 32 bytes Session Token，資料庫只存 SHA-256 摘要；絕對有效期 8 小時。
- Cookie：HttpOnly、SameSite=Strict、Path=/；HTTPS 加 Secure 與 `__Host-` 前綴。
- 成功登入更換 Session，登出立即刪除伺服器端憑證。
- 修改請求要求精確 Origin、JSON 與自訂 Header，拒絕跨站請求；不提供跨來源 CORS。
- 登入限流：來源每 15 分鐘 30 次、帳號 10 次；註冊每來源 5 次。密碼運算同時最多 2 筆。
- 角色由資料庫決定；受保護 API 每次驗證；登入憑證不寫 localStorage。
- 各帳號的本機體驗草稿使用不同 Key，與訪客資料分開；這是前端體驗隔離，不是正式跨裝置資料服務。

## API

| Method／路徑 | 說明 |
| --- | --- |
| POST `/api/auth/register` | 學員註冊並建立 Session |
| POST `/api/auth/login` | 驗證帳密並建立新 Session |
| POST `/api/auth/logout` | 撤銷目前 Session |
| GET `/api/auth/session` | 回傳目前會員安全欄位或 null |
| GET `/api/workspace` | 需登入；回傳本人的身分與專區狀態 |
| GET `/api/admin/status` | 只限管理者 |
| GET `/api/instructor/status` | 講師或管理者 |

## 部署條件與限制

- `AUTH_DB_PATH` 可指定 SQLite 檔案路徑；正式環境須使用持久磁碟、備份與受限檔案權限。
- `NODE_ENV=production` 必須設定 HTTPS `APP_ORIGIN`（無尾斜線），並在 HTTPS 反向代理後部署；不是單純 GitHub Pages。
- `HOST` 預設 `127.0.0.1`。反向代理需保留正確 Host；目前不信任任意 X-Forwarded-For，限流來源視實際代理情況調整，部署前需驗證。
- 信箱驗證及忘記密碼郵件尚未串接，`emailVerified` 為 false；未驗證信箱不授予講師或管理者權限。
- 尚未實作 MFA、會員資料修改、密碼重設、正式訂單／學習同步、預約同步、Email 通知與 Zoom。
- 瀏覽器自動驗收服務仍不可用；後端整合測試通過不代表已完成真實瀏覽器／手機上線驗收。

## 技術依據

- [Node Crypto：scrypt 與隨機 Salt](https://nodejs.org/api/crypto.html)
- [Node 24 SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
