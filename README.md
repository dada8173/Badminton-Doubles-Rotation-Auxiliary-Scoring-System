# 羽球雙打輪轉輔助計分器

這是一個可部署到 GitHub Pages 的前端 MVP。它不只是記分器，還會在每球後自動計算：

- 比分更新
- 發球權切換
- 發球員與接發員判斷
- 雙打站位輪轉
- 換場提示
- Undo 復原
- localStorage 儲存

## 技術棧

- React
- Vite
- TypeScript
- 原生 CSS

## 功能流程

1. 開始新比賽
2. 設定隊名、球員與規則
3. 設定 0:0 初始站位
4. 進入主計分畫面
5. 每次點擊左右得分按鈕後，自動更新狀態

## 本機執行

先安裝相依套件：

```bash
npm install
```

啟動開發伺服器：

```bash
npm run dev
```

打包正式版本：

```bash
npm run build
```

預覽正式版本：

```bash
npm run preview
```

## GitHub Pages 部署

此專案已將 Vite base path 設定為：

`/Badminton-Doubles-Rotation-Auxiliary-Scoring-System/`

並已內建自動部署流程：

- Workflow 檔案：[.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml)
- 觸發條件：push 到 main
- 部署目標：GitHub Pages

### 一次設定後即可手機直接開

1. 到 GitHub Repository 的 Settings > Pages。
2. Build and deployment 的 Source 選 GitHub Actions。
3. push 到 main 後，等待 Actions 跑完。
4. 開啟網站網址：

https://dada8173.github.io/Badminton-Doubles-Rotation-Auxiliary-Scoring-System/

你可以把這個網址直接加到手機主畫面，之後點圖示即可使用。

## 使用方式

### 1. 開始新比賽

在首頁按下「開始新比賽」。

### 2. 填寫設定

輸入：

- 左方隊名
- 右方隊名
- 目標分數
- 換場分數
- 最大分數
- 是否啟用 deuce
- 是否啟用換場提示
- 四位球員名稱

### 3. 設定初始站位

為以下四個位置指定球員：

- 左方偶數區
- 左方奇數區
- 右方偶數區
- 右方奇數區

若有重複站位，系統會提示修正。

### 4. 開始計分

進入主畫面後：

- 點「左方得分」或「右方得分」
- 系統自動更新比分與輪轉
- 需要時按 Undo 回到上一球
- 下方會保留每球紀錄

## 輪轉規則摘要

- 發球方得分時，發球權不變，且發球方兩位球員交換站位。
- 接發方得分時，發球權轉給得分方，雙方站位不交換。
- 偶數分對應 even court，奇數分對應 odd court。

## 目前限制

- 這是 MVP，尚未包含帳號登入、後端同步與進階統計。
- 設定草稿不會持久保存，只有正式比賽進度會寫入 localStorage。

## 目錄

```txt
src/
├── logic/
├── storage/
├── types/
├── App.tsx
├── main.tsx
└── styles.css
```