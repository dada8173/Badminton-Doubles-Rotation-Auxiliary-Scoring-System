# 羽球雙打輪轉輔助計分器
## 工程開發需求、對接與檢核文件（Engineer Version v1.0）

## 0. 文件定位
本文件提供工程團隊可直接實作的需求基線（MVP-first），包含：
- 功能範圍與非範圍
- 狀態模型與核心規則
- 頁面與互動契約
- 驗收條件與分階段交付

---

## 1. 專案目標（Problem / Outcome）
### 1.1 問題定義
裁判需要在**手機橫向**快速記分，並且即時確認雙打發球輪轉正確性。

### 1.2 產品結果
交付一個可部署於 **GitHub Pages** 的前端網頁，主裁判只需點擊「左方得分 / 右方得分」，系統自動完成：
1. 比分更新
2. 發球權判斷
3. 發球/接發球員判斷
4. 雙打站位輪轉
5. 必要提示（輪轉、換場、比賽結束）

> 核心價值：**輪轉檢核工具**（不是單純計分器）。

---

## 2. 範圍定義
## 2.1 MVP In-Scope
- 手機瀏覽器可用（橫向優先）
- 單場比賽建立、記分、恢復
- 雙打輪轉規則（發球方得分才交換）
- Undo（上一球復原）
- localStorage 持久化

## 2.2 Out-of-Scope（v1 不做）
- 帳號登入與多使用者
- 後端 API / 雲端資料庫
- 多場賽事雲端同步
- 進階統計儀表板

---

## 3. 技術決策
- Framework: **React + Vite + TypeScript**
- Hosting: **GitHub Pages**
- Persistence: **localStorage**
- Architecture: 前端單頁應用（SPA），無後端

---

## 4. 使用者流程（User Journey）
1. 首頁（新比賽 / 繼續上場）
2. 比賽設定
3. 初始站位設定（0:0）
4. 主計分頁
5. 每球更新狀態（可選填 rally 記錄）
6. 比賽結束與結果保存

---

## 5. 頁面需求（UI Contract）
## 5.1 HomePage
- CTA: `開始新比賽`
- CTA: `繼續上一場比賽`

## 5.2 MatchSetupPage
欄位（含預設）：
- mode = doubles（固定）
- targetScore = 21
- enableDeuce = true
- maxScore = 30
- enableCourtChange = true
- courtChangePoint = 11
- leftTeamName / rightTeamName
- leftPlayerA / leftPlayerB / rightPlayerA / rightPlayerB

## 5.3 InitialPositionPage
設定 0:0 初始站位：
- leftEvenCourt / leftOddCourt
- rightEvenCourt / rightOddCourt

## 5.4 MatchPage（橫向優先）
必顯示：
- 左右比分
- 發球方、發球員、接發員
- 左得分按鈕、右得分按鈕（最大點擊區）
- 四人站位圖
- 輪轉提示/動畫
- Undo
- Rally 記錄入口

---

## 6. 核心邏輯規格
## 6.1 每球處理 Pipeline（同步完成）
每次得分事件觸發：
1. 保存 snapshot（for undo）
2. 更新分數
3. 判斷發球權是否轉移
4. 判斷是否輪轉
5. 更新 server / receiver
6. 更新 CourtPositions
7. 寫入 RallyRecord
8. 檢查換場提示
9. 檢查比賽結束
10. 持久化到 localStorage

## 6.2 雙打輪轉規則
### 規則 A：發球方得分
- 發球權不變
- 發球方兩位球員交換 even/odd court
- 接發方不變
- 觸發輪轉動畫

### 規則 B：接發方得分
- 發球權轉移給得分方
- 雙方站位皆不交換
- 不觸發輪轉動畫
- 依得分方目前分數奇偶決定發球區

### 發球區對應
- 偶數分 → even court（右發球區）
- 奇數分 → odd court（左發球區）

## 6.3 Undo 規格
Undo 必須完整回復：
- 比分
- servingSide
- currentServerId / currentReceiverId
- positions
- rallies
- isGameOver / winner
- 換場狀態

---

## 7. 資料模型（TypeScript）
```ts
type MatchConfig = {
  mode: 'doubles'
  targetScore: number
  enableDeuce: boolean
  maxScore: number
  enableCourtChange: boolean
  courtChangePoint: number
  leftTeamName: string
  rightTeamName: string
}

type Player = {
  id: string
  name: string
  team: 'left' | 'right'
}

type CourtPositions = {
  leftEvenCourt: string
  leftOddCourt: string
  rightEvenCourt: string
  rightOddCourt: string
}

type MatchState = {
  config: MatchConfig
  players: Player[]
  leftScore: number
  rightScore: number
  servingSide: 'left' | 'right'
  positions: CourtPositions
  currentServerId: string
  currentReceiverId: string
  rallies: RallyRecord[]
  snapshots: MatchSnapshot[]
  isGameOver: boolean
  winner?: 'left' | 'right'
}

type RallyRecord = {
  rallyNumber: number
  scoringSide: 'left' | 'right'
  scoreAfter: { left: number; right: number }
  servingSideAfter: 'left' | 'right'
  serverId: string
  receiverId: string
  positionsAfter: CourtPositions
  reason?: string
  losingPlayerId?: string
  note?: string
  timestamp: string
}
```

---

## 8. 建議目錄
```txt
badminton-scoreboard/
├── public/
├── src/
│   ├── components/
│   ├── pages/
│   ├── logic/
│   ├── storage/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── vite.config.ts
└── README.md
```

---

## 9. PM ↔ Engineering 對接清單
## 9.1 PM 提供（輸入）
- 規則定義：發球方得分才交換站位
- 頁面流程：首頁 → 設定 → 初始站位 → 計分
- UI 優先序：得分按鈕 > 比分資訊 > 站位清晰
- MVP 邊界：無登入、無後端

## 9.2 Engineering 回覆（確認）
- [ ] React + Vite + TypeScript
- [ ] GitHub Pages 部署方案
- [ ] localStorage schema
- [ ] 輪轉規則理解與測試案例
- [ ] 橫向 UI 版型與操作性
- [ ] MVP 與後續功能切分

---

## 10. 分階段交付與驗收
## Phase 1：框架與頁面骨架
交付：專案初始化、部署、Home/Setup/InitialPosition。

## Phase 2：計分與狀態管理
交付：左右得分、state 更新、localStorage、Undo。

## Phase 3：雙打輪轉引擎
交付：servingSide/server/receiver、輪轉與換發球。

## Phase 4：視覺化與動效
交付：站位圖、server/receiver 標示、輪轉動畫、換場提示。

## Phase 5：Rally 記錄
交付：每球記錄、選填原因/失分者/備註、查閱列表。

---

## 11. 驗收重點（E2E）
1. 可公開部署且手機可用
2. 橫向畫面可穩定操作
3. 設定/站位可完成輸入
4. 記分與輪轉結果正確
5. Undo 可完整回復
6. 重新整理可恢復同場狀態
7. 比賽結束與換場提示正確

---

## 12. MVP 最小交付（DoD）
1. GitHub Pages 上線
2. 手機橫向操作
3. 比賽與四位球員設定
4. 初始站位設定
5. 左右得分操作
6. 自動更新比分
7. 自動判斷雙打輪轉
8. 顯示正確站位
9. 支援 Undo
10. localStorage 保存單場資料

---

## 13. 一句話需求（for issue/prd）
開發一個可免費部署於 GitHub Pages 的手機橫向羽球雙打計分網頁，讓主審以最少點擊完成記分，並由系統自動檢核發球輪轉、顯示正確站位與每球記錄。
