# 課程影片規劃

影片尚未提供；目前不建立雲端影片資源或啟用付費播放。建議未來採用 Cloudflare Stream，並為付費影片開啟 `requireSignedURLs`，避免只憑影片 ID 就能公開播放。

課程章節應有獨立的章節 ID，關聯課程 ID、播放順序、標題與 Stream 影片 ID。學員請求播放時，伺服器先驗證登入、該課程未撤銷的有效授權及章節可用狀態，再發放短效簽章播放憑證。播放器不得直接公開私有影片 ID 作為權限依據；課程下架、退款及封鎖帳號等情況也要檢查。

學習進度與成就需以會員 ID 和章節 ID 儲存；正式完成條件應在章節內容與播放方案確認後定義並測試，不能以示範影片播放進度當成已完成付費課程。串接前要確認 Stream 費用、播放域名、安全上傳方式、影片處理完成狀態、使用者與多裝置測試，以及資料備份和存取憑證設定。

參考：[Cloudflare Stream 私有影片與簽章播放](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/)、[直接上傳](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/)。
