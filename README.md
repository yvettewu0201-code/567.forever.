# 567.forever — 三個人的私人回憶網站

## 功能
- 保留原始封面美編，中央 `memory ♡` 按鈕。
- 三人專屬 Email 登入（無公開註冊），後端資料表與私人圖片儲存桶均啟用 RLS。
- 每篇回憶可附 1–12 張照片、標題、說明、日期；新增貼文不會覆蓋舊貼文，沒有提供編輯或刪除功能。
- 三人共用的即時聊天留言牆；所有登入裝置共享相同內容。
- 響應式版面，支援手機。

## 部署步驟（必做）
1. 註冊 Supabase，建立一個 Project。
2. 在 **SQL Editor** 執行 `setup.sql`（新專案執行一次；重複執行 policies/realtime 會報 already exists）。
3. 到 **Authentication → Providers → Email** 開啟 Email 驗證登入；請關閉 **Allow new users to sign up**，避免陌生人自行建立帳號。
4. 到 **Authentication → Users** 使用 **Invite user** 邀請三位朋友的 Email（包含你自己），並確認三人完成邀請流程。複製三位帳號的 User UID。
5. 回到 SQL Editor，執行（將 UID 改成實際的值）：
   ```sql
   insert into public.members(id,display_name) values
   ('第一位使用者的 UUID','朋友一'),
   ('第二位使用者的 UUID','朋友二'),
   ('第三位使用者的 UUID','朋友三');
   ```
6. 在 **Project Settings → API**（或專案 Connect 頁）找到 Project URL 與 publishable/anon key，貼到 `config.js`。**絕對不要填 service_role / secret key。**
7. 在 **Authentication → URL Configuration** 把你的 GitHub Pages 網址設為 Site URL，並加到 Redirect URLs，例如 `https://USERNAME.github.io/567-forever/`。本機測試可另加 `http://localhost:8000/**`。
8. 將整個資料夾內容上傳到 GitHub Repository 根目錄（`index.html` 必須在根目錄），到 **Settings → Pages → Build and deployment** 選 **Deploy from a branch → main → /(root)**，儲存。
9. 三位朋友各自以受邀 Email 點擊「寄送登入連結」，從信箱打開登入信。只有 `members` 表內的三個帳號能讀取、上傳或聊天。

## 本機預覽
在本資料夾開終端機執行 `python -m http.server 8000`，用瀏覽器開啟 `http://localhost:8000`。不要直接用 `file://` 開啟，因為 ES Modules 可能被瀏覽器限制。

## 安全與保存注意
- **GitHub Pages 只負責前端靜態網頁；Supabase 負責登入、資料庫、照片儲存和即時聊天。** 沒有設定 Supabase 前，網站不能真的多人共享。
- 封面 `assets/cover.jpg` 隨 GitHub Pages 公開提供；若照片本身也需要完全保密，請換成不涉及隱私的封面，或改用登入後才顯示的私人圖片。
- 私人貼文照片透過短效簽名 URL 讀取；已登入的成員可看到所有回憶。成員仍可自行截圖或另存，無法防止。
- 程式沒有刪除或覆寫貼文的操作，資料庫也沒有開放對貼文的 UPDATE / DELETE 政策；但 Supabase 專案管理員仍有資料管理權限。
- 請在 Supabase 管理介面設定定期備份；免費方案的限制、圖片儲存與信件發送配額依當時方案為準。
- 若 SQL 編輯器提示 publication 已存在，略過對應 `alter publication` 重複語句即可。
