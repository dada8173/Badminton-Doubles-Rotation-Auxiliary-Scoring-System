# 排場地功能開發企劃（交付 Code Agent 版本）

## 0. 給 Code Agent 的任務摘要

請在現有「羽球雙打輪轉輔助計分器」中新增一個 **Session 層級的排場地功能**。目前專案是 React + Vite + TypeScript 的純前端 SPA，既有功能是單場雙打計分、發球輪轉、Undo 與 localStorage 保存。新增功能必須先獨立於既有單場計分模型，避免破壞目前計分流程。

本企劃是開發用規格，詳細研究背景請參考 `docs/COURT_SCHEDULING_REQUIREMENTS.md`。

### 0.1 最終目標

使用者可以：

1. 建立一個今天的排場 Session。
2. 建立 1-8 面場地，每面場地可設定單打或雙打。
3. 新增玩家，並設定姓名、等級、性別、付款狀態、候場/休息/離場狀態。
4. 看到場地牆、候場名單、休息區、不可排/未付款提示。
5. 點擊「排下一場」或「一鍵填滿空場」，系統自動推薦上場人選。
6. 自動排場要同時考慮等待時間、已打場次、等級平衡、重複搭配懲罰。
7. 管理員可以接受推薦、完成場地、取消場地、手動調整玩家狀態。
8. 雙打 assignment 可作為未來串接既有計分器的入口；第一版可以先不完成完整計分串接，但資料結構要能支援。

---

## 1. 現有架構與不可破壞事項

### 1.1 現有技術棧

- React 18
- Vite
- TypeScript
- 原生 CSS
- localStorage
- 無後端、無登入、無雲端同步

### 1.2 現有重要檔案

| 檔案 | 目前用途 | 開發注意事項 |
|---|---|---|
| `src/types/match.ts` | 單場計分型別：`MatchState`、`Player`、`CourtPositions` 等 | 不要直接把排場 Session 欄位塞進既有 `Player`；請新增 session 型別。 |
| `src/logic/matchEngine.ts` | 雙打得分、發球、站位輪轉核心邏輯 | 不要修改計分規則，除非是明確的串接工作。 |
| `src/storage/matchStorage.ts` | 既有 AppState localStorage 保存 | 排場 Session 請新增獨立 storage key。 |
| `src/App.tsx` | 目前所有畫面流程 | 可新增 scene，但要保留既有 home/setup/position/match 流程。 |
| `src/styles.css` | 目前全站樣式 | 可新增排場頁 CSS；注意手機橫向與桌面都要可讀。 |

### 1.3 不可回歸需求

- 既有「開始新比賽 → 設定 → 初始站位 → 計分」流程必須能繼續使用。
- 既有 Undo、發球輪轉、換場提示、localStorage 恢復不可壞掉。
- 新增排場 Session 不能清掉正在進行中的單場計分，除非使用者明確重設。
- build 必須通過：`npm run build`。

---

## 2. 建議開發策略

請分階段交付，不要一次做完所有想像功能。

### Phase 1：資料模型、排場演算法、儲存（優先）

目標：先讓排場功能有可靠的純邏輯基礎，即使 UI 還很簡單也能測。

#### 2.1.1 新增檔案

建議新增：

```txt
src/types/session.ts
src/logic/sessionScheduler.ts
src/storage/sessionStorage.ts
```

#### 2.1.2 `src/types/session.ts` 必要型別

```ts
export type Gender = 'male' | 'female' | 'other' | 'unspecified';
export type PaymentStatus = 'paid' | 'unpaid' | 'waived' | 'unknown';
export type PlayerQueueStatus = 'waiting' | 'playing' | 'resting' | 'left' | 'blocked';
export type CourtPlayMode = 'singles' | 'doubles';
export type CourtStatus = 'open' | 'playing' | 'disabled' | 'reserved';
export type SchedulingStrategy = 'fairnessFirst' | 'skillBalanced' | 'firstComeFirstServed' | 'randomBalanced' | 'manual';

export type SessionPlayer = {
  id: string;
  name: string;
  gender: Gender;
  level: number;
  paymentStatus: PaymentStatus;
  queueStatus: PlayerQueueStatus;
  joinedAt: string;
  lastPlayedAt?: string;
  gamesPlayed: number;
  gamesSatOut: number;
  skipCount: number;
  note?: string;
};

export type Court = {
  id: string;
  name: string;
  mode: CourtPlayMode;
  status: CourtStatus;
  currentAssignmentId?: string;
  note?: string;
};

export type AssignmentScoreBreakdown = {
  fairness: number;
  skillBalance: number;
  waitingTime: number;
  repeatPenalty: number;
  mixedDoublesBonus: number;
  total: number;
};

export type CourtAssignment = {
  id: string;
  courtId: string;
  mode: CourtPlayMode;
  playerIds: string[];
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  source: 'auto' | 'manual';
  scoreBreakdown: AssignmentScoreBreakdown;
  warnings: string[];
};

export type SchedulingPolicy = {
  strategy: SchedulingStrategy;
  allowUnpaidPlayers: boolean;
  maxLevelGap?: number;
  preferMixedDoubles: boolean;
  avoidRepeatPartner: boolean;
  fairnessWeight: number;
  skillWeight: number;
  waitTimeWeight: number;
  repeatPenaltyWeight: number;
};

export type CourtAssignmentRecommendation = {
  courtId: string;
  assignment: CourtAssignment;
  reason: string;
  warnings: string[];
};

export type CourtSessionState = {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  players: SessionPlayer[];
  courts: Court[];
  assignments: CourtAssignment[];
  policy: SchedulingPolicy;
};
```

#### 2.1.3 `src/logic/sessionScheduler.ts` 必要函式

至少實作下列純函式：

```ts
createDefaultSchedulingPolicy(): SchedulingPolicy
createCourtSession(name?: string): CourtSessionState
createSessionPlayer(input: Partial<SessionPlayer> & { name: string }): SessionPlayer
createCourt(input: Partial<Court> & { name: string }): Court
getRequiredPlayers(mode: CourtPlayMode): 2 | 4
getEligiblePlayers(session: CourtSessionState): SessionPlayer[]
recommendAssignment(session: CourtSessionState, courtId: string, now?: Date): CourtAssignmentRecommendation | { error: string }
recommendAssignmentsForOpenCourts(session: CourtSessionState, now?: Date): CourtAssignmentRecommendation[]
acceptAssignment(session: CourtSessionState, recommendation: CourtAssignmentRecommendation, now?: Date): CourtSessionState
completeAssignment(session: CourtSessionState, assignmentId: string, now?: Date): CourtSessionState
cancelAssignment(session: CourtSessionState, assignmentId: string): CourtSessionState
updatePlayerQueueStatus(session: CourtSessionState, playerId: string, status: PlayerQueueStatus): CourtSessionState
```

#### 2.1.4 演算法規則

`recommendAssignment` 必須符合：

1. 只從 `queueStatus === 'waiting'` 的玩家挑人。
2. 若 `policy.allowUnpaidPlayers === false`，排除 `paymentStatus === 'unpaid'` 與 `unknown`。
3. `singles` 只產生 2 人 assignment；`doubles` 只產生 4 人 assignment。
4. 不可以產生 3 人場。
5. 若 `maxLevelGap` 有值，候選組合最高等級與最低等級差距不可超過限制；如果排不出，要回傳 error。
6. 雙打 4 人要嘗試 3 種分隊方式，選兩隊平均等級最接近的分隊。
7. 分數要可解釋，包含：
   - `waitingTime`
   - `fairness`
   - `skillBalance`
   - `repeatPenalty`
   - `mixedDoublesBonus`
   - `total`
8. 如果候選不足，回傳 error，不要丟例外、不直接 `alert`。

#### 2.1.5 Phase 1 驗收

- 可以在純函式層建立 session、玩家、場地。
- 可以對單打場地產生 2 人推薦。
- 可以對雙打場地產生 4 人推薦與兩隊分隊。
- 休息、離場、場上、不可排玩家不會被推薦。
- 未付款玩家在 policy 不允許時不會被推薦。
- 接受 assignment 後，玩家變 `playing`，場地變 `playing`。
- 完成 assignment 後，玩家回到 `waiting`，`gamesPlayed + 1`，場地回到 `open`。

---

### Phase 2：排場主控台 UI（MVP 可用）

目標：使用者能在畫面上建立 Session、場地、玩家，並完成基本排場。

#### 2.2.1 AppScene 建議

在既有 `AppScene` 外新增：

```ts
type AppScene = 'home' | 'setup' | 'position' | 'match' | 'sessionSetup' | 'courtScheduler';
```

注意：如果型別定義在 `src/types/match.ts`，可先放在原檔，但更乾淨做法是日後拆 `app.ts`；MVP 不強制。

#### 2.2.2 首頁入口

首頁新增三個主要入口：

1. `開始新比賽`：沿用既有單場計分。
2. `開始排場地`：建立新的 Court Session。
3. `繼續排場地`：如果 localStorage 有 Court Session 才可用。

#### 2.2.3 Session 設定頁

必要欄位：

- Session 名稱，預設：`今日排場`
- 場地數，預設：4，範圍 1-8
- 預設場地模式：雙打
- 是否允許未付款上場
- 排場策略：第一版可只做 `fairnessFirst`

按下「建立」後自動產生 Court 1、Court 2...。

#### 2.2.4 排場主控台區塊

主控台至少包含：

1. 場地牆
   - 每面場地一張卡片。
   - 顯示名稱、模式、狀態、目前玩家、已開始時間。
   - 空場按鈕：`排下一場`。
   - 進行中按鈕：`完成此場`、`取消此場`。

2. 玩家新增表單
   - 姓名必填。
   - 等級 1-10，預設 5。
   - 性別，預設 unspecified。
   - 付款狀態，預設 paid 或 unknown；建議 MVP 預設 paid 降低操作成本。

3. 候場名單
   - 顯示 waiting 玩家。
   - 欄位：姓名、等級、性別、付款、已打場次、狀態操作。
   - 操作：休息、離場、標記付款/未付款。

4. 休息區
   - 顯示 resting 玩家。
   - 操作：回候場、離場。

5. 不可排 / 已離場區
   - 顯示 blocked / left 玩家。
   - 操作：回候場。

6. 下一場推薦
   - 點擊排下一場後，顯示推薦組合、分隊、推薦原因、score breakdown。
   - MVP 可直接接受推薦，不一定要做拖拉換人。

#### 2.2.5 Phase 2 驗收

- 使用者可從首頁進入排場功能。
- 使用者可建立 1-8 面場地。
- 使用者可新增至少 20 位玩家。
- 使用者可將玩家切到休息、離場、回候場。
- 使用者可對空場排下一場。
- 接受推薦後，場地牆顯示上場玩家。
- 完成場地後，玩家回候場且已打場次增加。
- 重新整理頁面後，排場 Session 仍存在。

---

### Phase 3：與既有計分器的最小串接

目標：讓排好的雙打 assignment 可以進入既有計分器。

#### 2.3.1 MVP 串接規則

- 只有 `mode === 'doubles'` 的 assignment 顯示 `進入計分器`。
- 進入計分器時，把 `teamAPlayerIds` 轉成左方兩位球員，把 `teamBPlayerIds` 轉成右方兩位球員。
- 仍進入既有初始站位設定頁，讓使用者確認左右方 even/odd court。
- 計分完成後若尚未實作回寫，可以先讓使用者手動回排場主控台完成場地。

#### 2.3.2 中期串接規則

- 計分結束自動回寫 assignment result。
- 回到排場主控台時可自動完成該場地。
- assignment 增加比分、勝方欄位。

---

## 3. 儲存規格

### 3.1 localStorage keys

請使用獨立 key，避免與既有單場計分互相覆蓋：

```ts
const COURT_SESSION_STORAGE_KEY = 'badminton-court-session-state';
```

### 3.2 storage 函式

`src/storage/sessionStorage.ts` 至少提供：

```ts
loadCourtSession(): CourtSessionState | undefined
saveCourtSession(session: CourtSessionState): void
clearCourtSession(): void
hasSavedCourtSession(): boolean
```

### 3.3 讀取防呆

- JSON parse 失敗時回傳 `undefined`。
- `schemaVersion !== 1` 時回傳 `undefined`。
- 不要讓壞資料造成 App crash。

---

## 4. UI 文案建議

### 4.1 首頁

- `開始新比賽`
- `繼續上一場比賽`
- `開始排場地`
- `繼續排場地`

### 4.2 場地牆

- `空場`
- `進行中`
- `停用`
- `保留`
- `排下一場`
- `完成此場`
- `取消此場`
- `進入計分器`

### 4.3 玩家狀態

- `候場`
- `場上`
- `休息`
- `已離場`
- `不可排`

### 4.4 錯誤訊息

- `候場人數不足，雙打需要 4 人。`
- `候場人數不足，單打需要 2 人。`
- `目前等級差限制過嚴，無法產生建議。請放寬等級差或手動排場。`
- `這位玩家正在場上，請先完成或取消該場地。`

---

## 5. 測試企劃

目前專案沒有測試框架，因此最低要求是每個階段都必須跑：

```bash
npm run build
```

如果要新增測試框架，建議使用 Vitest，並新增：

```txt
src/logic/sessionScheduler.test.ts
```

### 5.1 建議測試案例

1. `getEligiblePlayers` 排除 resting / playing / left / blocked。
2. `getEligiblePlayers` 在不允許未付款時排除 unpaid / unknown。
3. `recommendAssignment` 對雙打回傳 4 人。
4. `recommendAssignment` 對單打回傳 2 人。
5. 候選不足時回傳 error。
6. `maxLevelGap` 太小時回傳 error。
7. 雙打分隊會選擇平均等級最接近的組合。
8. `acceptAssignment` 會更新玩家與場地狀態。
9. `completeAssignment` 會更新 `gamesPlayed`、`lastPlayedAt` 並釋放場地。
10. 一鍵填滿多場地時，同一玩家不會被排到兩面場地。

---

## 6. 建議開發順序與 commit 切分

### Commit 1：新增 session 型別與 storage

- 新增 `src/types/session.ts`。
- 新增 `src/storage/sessionStorage.ts`。
- build 通過。

### Commit 2：新增排場演算法純函式

- 新增 `src/logic/sessionScheduler.ts`。
- 實作建立資料、候選過濾、推薦、接受、完成、取消。
- build 通過。

### Commit 3：首頁與 Session 設定頁

- 更新 `AppScene`。
- 首頁新增排場入口。
- 新增 Session 設定 UI。
- build 通過。

### Commit 4：排場主控台 MVP

- 場地牆。
- 玩家新增表單。
- 候場名單。
- 休息區。
- 排下一場 / 完成此場。
- build 通過。

### Commit 5：體驗修整與防呆

- 錯誤訊息。
- 未付款提示。
- 空場不足、候選不足提示。
- 手機 / 桌面 CSS 調整。
- build 通過。

### Commit 6：可選，計分器最小串接

- 雙打 assignment 轉既有 Match draft。
- 進入初始站位設定頁。
- build 通過。

---

## 7. Definition of Done

第一版排場地功能完成時，必須符合：

- [ ] 不破壞既有單場計分流程。
- [ ] 可建立 / 保存 / 恢復排場 Session。
- [ ] 可新增玩家並設定等級、性別、付款、狀態。
- [ ] 可建立 1-8 面場地並設定單打 / 雙打。
- [ ] 可從候場玩家自動推薦單打 2 人、雙打 4 人。
- [ ] resting / playing / left / blocked 玩家不會被自動推薦。
- [ ] 未付款玩家會依 policy 決定是否可排。
- [ ] 接受推薦後玩家與場地狀態正確更新。
- [ ] 完成場地後玩家統計與場地狀態正確更新。
- [ ] 推薦結果顯示原因與分數拆解。
- [ ] localStorage 壞資料不會讓 App crash。
- [ ] `npm run build` 通過。

---

## 8. 不要做的事

第一版請不要做：

- 不要做登入 / 後端 / 雲端同步。
- 不要做付款金流。
- 不要做 Excel / Google Sheets 匯出。
- 不要做拖放 UI，除非所有 MVP 都完成。
- 不要做完整 Elo / 排名系統。
- 不要做完整賽事循環賽 / 淘汰賽。
- 不要把 session 玩家型別直接混進既有單場 `Player`。
- 不要改寫既有 matchEngine 的雙打輪轉規則。

---

## 9. 交付給 Code Agent 的短 Prompt

如果要把本企劃交給另一個 code agent，可以直接貼以下任務：

```txt
請依照 docs/COURT_SCHEDULING_DEVELOPMENT_PLAN.md 實作排場地 MVP。
請先完成 Phase 1 與 Phase 2：新增 session 型別、sessionStorage、sessionScheduler 純函式，並在 App 中新增「開始排場地 / 繼續排場地」入口、Session 設定頁與排場主控台。
請不要破壞既有單場計分流程，也不要把排場 Session 欄位塞進既有 MatchState。
完成後請執行 npm run build，並用中文說明修改內容、影響與測試結果。
```
