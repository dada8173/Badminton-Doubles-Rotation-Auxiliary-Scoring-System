# 排場地功能研究與需求書（Court Scheduling / Queue Rotation）

## 0. 文件目的

本文件整理公開產品、社群討論與球會規則中常見的「羽球排場地 / 排隊輪轉」做法，並對照目前專案架構（React + Vite + TypeScript、前端 SPA、localStorage）提出可落地的需求規格。

> 本功能定位：從目前「單場雙打輪轉輔助計分器」擴充為「球局前的多人排場、候場、上場分配與場地管理」。計分器仍負責單場比分與雙打發球輪轉；排場地功能負責決定「誰上哪一面場地、打單打或雙打、誰休息、下一場候補順序」。

---

## 1. 外部做法研究摘要

### 1.1 常見產品 / 系統做法

| 來源 | 觀察到的做法 | 對本專案的啟發 |
|---|---|---|
| Qcourt App Store 說明 | 強調自動公平輪轉、記錄已打場次、快速新增姓名與等級、視覺化下一組、單打/雙打一鍵分配、多場地、費用分攤、Google Sheets / Excel 匯出、預排四人組、離線使用。<https://apps.apple.com/ph/app/qcourt/id6757377299> | MVP 可先做「玩家資料、狀態、等級、排隊序列、多場地、上場/完賽」。費用與匯出可列為 v2。 |
| Racket Social | 提供智慧雙打輪轉、公平休息、技能平衡、Elo 排名、分享連結、PWA、離線、多語系。<https://racketsocial.app/> | 本專案可先用手動等級 1-10；未來再以勝負紀錄更新動態評分。PWA / 離線與目前 localStorage 架構相容。 |
| QourtX | 主打自動排雙打/混雙/女雙/男雙、技能平衡、相同上場時間、即時 wallboard、skip counts / wait time、公用 kiosk check-in、場地利用率與 CSV 匯出。<https://qourtx.com/badminton-club-management> | 排場演算法不只看等級，也要追蹤等待時間、被跳過次數、已打場次，避免只挑最剛好的四人造成不公平。 |
| OpenSports 羽球 drop-in | 活動報名可用性別、程度與可用性篩選，額滿自動候補，RSVP 與付款狀態整合。<https://opensports.net/blog/run-your-badminton-facilityclubs-drop-in-play-on-opensports> | 「繳費狀況」應成為可排/不可排條件之一；候補名單與出席狀態也應分開。 |
| Seattle Badminton Club 開放打規則 | 場地輪轉採 20 分鐘間隔；等待者把卡片放入輪轉隊列；最多四人一組；時間到需讓給下一組。<https://seattlebadminton.com/sbc/how-to-play/> | 除了「完賽後換場」，也要支援「固定時間輪轉」。MVP 可先記錄開場時間與手動完賽；v2 加倒數計時與超時提醒。 |
| Holy Trinity Badminton Club | 會員繳費後產生標籤，標籤包含姓名、等級、性別；安排以等級與性別為依據，目標是多樣、有趣、公平上場時間；未在場地圖上的標籤就是下一輪休息。<https://www.htbc.club/play-system> | 對應使用者提到的「人員可填等級、性別、繳費」與「休息區」。UI 可用卡片/標籤拖放或點選狀態。 |
| BadmintonCentral 社群討論 | 社群常討論多場地、20-24 人如何輪轉、挑戰勝者、男女優先、勝者留場等規則。<https://www.badmintoncentral.com/forums/index.php?threads%2Fbadminton-group-player-shuffle-rotation.189347%2F=> | 必須把「排場策略」做成可設定，而不是寫死單一規則。 |
| Reddit 社群 | 有人自製 Android app 處理 court rotations、balanced playtime、減少重複搭檔、支援中途加入/離開、多場地、目前比賽卡片。<https://www.reddit.com/r/badminton/comments/1q47nht/how_do_other_clubs_handle_court_rotations_when/> | 本功能必須處理中途加入/離開，且 UI 上要清楚顯示目前場上、等待、下一場。 |

### 1.2 歸納出的業界共通規則

1. **玩家不是只有姓名**：通常至少要有等級、性別、出席/付款/休息/候場/上場狀態。
2. **公平性需要量化**：常見指標包含已打場次、等待時間、連續休息次數、被跳過次數、重複搭檔/對手次數。
3. **等級平衡與公平候場會衝突**：如果只追求等級接近，某些玩家可能一直被跳過；如果只追求先到先上，對戰品質可能變差。因此需要可調權重。
4. **需要支援多種排場模式**：自由雙打、混雙優先、同級優先、先到先上、完全隨機、教練/管理員手動指定。
5. **休息區應是顯式狀態**：被放入休息區的人不應被演算法自動排入，但仍保留出席與統計資料。
6. **場地有自己的能力與狀態**：場地可啟用/停用，可指定單打或雙打，可目前進行中、空場、保留、維修。
7. **現場管理重視大螢幕資訊**：要一眼看出目前哪幾面場地在打、候場多少人、下一組是誰、誰該準備。

---

## 1A. 反向提取：把現成產品拆成可實作需求

> 這一節不是只列靈感，而是把現成 App、球會制度、開源專案與賽程產生器拆成「我們應該具備的畫面、資料、規則、演算法與驗收」。

### 1A.1 產品 / 制度拆解矩陣

| 參考對象 | 它實際解決的場景 | 反向提取出的必要能力 | 我們的需求落點 |
|---|---|---|---|
| Qcourt | 多場地現場排隊，避免爭論誰下一場；支援單打/雙打、一鍵分配、玩家等級、已打場次、公平輪轉、預排四人組、費用拆分、離線、匯出。 | 需要「場地狀態」、「玩家狀態」、「下一組 buffer」、「費用/付款紀錄」、「離線持久化」、「一鍵完成與一鍵排下一場」。 | v1 必做玩家/場地/候場/休息/自動排場；費用拆分與匯出列 v2，但資料模型先保留 `paymentStatus` 與 future-friendly 欄位。 |
| QourtX | Club 管理場景，空場自動填入最佳平衡對戰；追蹤 waiting/playing/resting、skip counts、wait time、session analytics、court utilisation、CSV。 | 排場不能只看等級，要保留「等待時間、被跳過次數、已打場次、場地使用率」。管理員需要看出為什麼某組被推薦。 | v1 的 `scoreBreakdown` 必須可解釋；玩家統計至少包含 `gamesPlayed`、`skipCount`、`lastPlayedAt`。 |
| sylhare/Badminton 開源專案 | React/TypeScript court assignment；手動或 OCR 匯入名單；以 cost function 最小化不公平；自動 bench；避免重複搭檔/對手；雙打優先，奇數時可單打。 | 需求書要規定 cost function，而不是只寫「自動排」。也要規定永遠不能產生 3 人場，並支援 bench/休息自動歸類。 | v1 演算法採候選組合評分；雙打 4 人、單打 2 人，不允許 3 人 assignment；未上場者留在 waiting/resting。 |
| Seattle Badminton Club | 實體卡片輪轉板；20 分鐘一輪；最多四人一組排隊；時間到立即讓給下一組。 | 系統必須支援「以局結束」與「以時間輪轉」兩種現場制度；也要能把 2-4 人視為一個候場 group。 | v1 先支援手動完成；資料模型保留 `startedAt`；v2 加 `rotationIntervalMinutes`、倒數與超時提醒。 |
| Holy Trinity Badminton Club | 會員繳費後得到姓名/等級/性別標籤；管理員把標籤放到場地圖；未在場地圖者休息；目標是等級/性別多樣、上場時間公平。 | 最直覺 UI 是「玩家卡片 + 場地圖 + 休息區」。等級與性別不是備註，而是排場決策欄位。 | v1 用卡片式列表，不一定做拖放；每位玩家卡片顯示姓名、等級、性別、付款與狀態。 |
| PlayRez / Playpass 賽程產生器 | Round robin、固定雙打、輪換搭檔、混雙、排名與預估時間。 | 我們不是賽事產生器，但應借用「輪換搭檔」、「個人排名」、「單局 21 分較可控」、「人數/場地估時」概念。 | v2 可加 round-robin/event mode；v1 先保留 match result history，避免未來無法做排名與統計。 |
| OpenSports drop-in | RSVP、候補、付款、性別/程度篩選、額滿自動候補。 | 現場排場前還有「報名/到場/付款/候補」生命週期；未付款與未到場不應混在可排清單。 | v1 把 `paymentStatus` 與 `queueStatus` 分開；未付款是否可排由 policy 控制。 |
| Reddit / 社群白板經驗 | 人數增加後白板變混亂；需要多場地、join/leave、balanced playtime、減少重複配對、目前比賽卡片。 | 系統必須處理中途加入、離場、取消上場、重新排場；目前比賽卡片要比資料表更醒目。 | v1 每個 assignment 要可取消、完成；玩家可從任何狀態轉離場但需防止破壞進行中場地。 |

### 1A.2 從現成做法萃取出的「硬需求」

以下項目若缺少，排場功能會變成空泛的名單工具，而不是可在現場使用的系統：

1. **狀態機明確**：玩家必須只有一個主狀態：候場、場上、休息、已離場、不可排。不能同時出現在兩面場地或同時在候場與休息。
2. **場地牆是核心畫面**：管理員第一眼要看到每面場地誰在打、打多久、下一步可做什麼。
3. **推薦必須可解釋**：每次自動排場需顯示「為什麼是這幾人」，至少列出等待、已打、等級平衡、重複配對懲罰。
4. **演算法必須可被人工覆寫**：現場總會有熟人、傷兵、教練安排、程度誤差；系統要能手動換人，但仍保留紀錄。
5. **不能只做單一公平定義**：公平有至少三種：等待公平、場次公平、對戰品質公平；需求必須允許權重調整。
6. **中途加入/離開是常態**：玩家不會一次全部到齊，也不會同時離開；新增、離場、休息、回到候場都要即時更新候選池。
7. **單打/雙打要在場地層級決定**：同一個 Session 可能某些場地打單打、某些打雙打；排場需要依場地需要的人數產生 assignment。
8. **資料要能支撐未來統計**：即使 v1 不做報表，也要記錄 assignment history、開始/完成時間、來源、分隊、結果欄位。

### 1A.3 反向使用者故事（Reverse-engineered User Stories）

| 角色 | 使用者故事 | 驗收重點 |
|---|---|---|
| 現場管理員 | 我想快速把 20 位玩家加入今天的 Session，並標記誰已付款、誰休息、誰離場。 | 新增玩家不超過 3 個必要欄位；付款與休息不需進入編輯頁即可切換。 |
| 現場管理員 | 我想建立 1-8 面場地，並指定每面打單打或雙打。 | 空場可產生建議；進行中場地不會被二次排入。 |
| 現場管理員 | 我想按一個按鈕填滿所有空場，但在接受前看到每場推薦原因。 | 顯示每面場地建議組合、分隊、分數拆解與警告。 |
| 現場管理員 | 我想把某位玩家放入休息區，直到他自己說可以回來。 | `resting` 玩家不進入任何自動候選；可一鍵回候場。 |
| 一般玩家 | 我想知道自己是不是下一場、還要等幾組、目前有多少人在候場。 | 候場序列與 next-up 區塊清楚顯示，且能按等待優先級排序。 |
| 財務/主揪 | 我想知道未付款者是否被排上場，並能選擇允許或禁止。 | policy 可設定 `allowUnpaidPlayers`；未付款者有清楚標記。 |
| 教練/高手場管理員 | 我想讓等級接近的人打在一起，避免新手被排進高手場。 | 可設定 `maxLevelGap` 或策略為 `skillBalanced`。 |
| 歡樂團管理員 | 我想讓大家都差不多有上場時間，不要有人一直被跳過。 | `gamesPlayed` 少、等待久、`skipCount` 高者優先。 |
| 混雙活動管理員 | 我想盡量每隊一男一女，但人數不夠時可退回一般雙打。 | `preferMixedDoubles` 是加分/偏好，不是硬性失敗，除非未來設為 strict。 |
| 計分使用者 | 我想從已排好的雙打直接進入既有計分器，不用重打四個名字。 | assignment 能轉成既有 match draft，並保留回到排場 Session 的入口。 |

### 1A.4 現場流程藍圖（Service Blueprint）

1. **開場前**
   - 建立 Session。
   - 建立場地：例如 Court 1-4，Court 1-3 雙打，Court 4 單打。
   - 匯入或新增玩家，標記付款與等級。
2. **開始輪轉**
   - 管理員按「一鍵填滿空場」。
   - 系統對每面空場產生候選 assignment。
   - 管理員接受或手動換人。
   - 玩家狀態由 `waiting` 變 `playing`，場地狀態變 `playing`。
3. **進行中**
   - 場地卡片顯示已打時間。
   - 中途加入者進入候場尾端，但可因等待/場次分數在下一輪被選中。
   - 想休息者轉入休息區，不影響歷史統計。
4. **完成一場**
   - 管理員按「完成」。
   - 系統寫入完成時間、可選比分、更新玩家 `gamesPlayed` / `lastPlayedAt`。
   - 玩家回到候場或依管理員選擇進休息。
   - 場地回到 open，可立即產生下一場。
5. **收尾**
   - Session 可保存，下次回來繼續。
   - v2 可匯出出席、付款、場次與場地利用率。


---

## 2. 與使用者想法的對照分析

| 使用者想法 | 研究結論 | 建議規格 |
|---|---|---|
| 可以填寫人員：等級、性別、繳費狀況等 | 外部系統普遍支援 skill/gender/payment/check-in。 | 建立 `SessionPlayer` 資料模型，包含姓名、等級、性別、付款狀態、狀態、到場時間、備註。 |
| 場地可自己建立：幾面場地、打單打/雙打 | 多場地是標準需求，且場地可有不同模式。 | 建立 `Court` 資料模型，支援名稱、模式、啟用狀態、目前比賽、下一場候補。 |
| 自動排場地：等級相近或其他方法 | 成熟系統會同時考慮公平上場、等待、等級、避免重複搭配。 | 建立可調策略：`fairnessFirst`、`skillBalanced`、`firstComeFirstServed`、`randomBalanced`、`manual`。MVP 先實作 fairness + skill score。 |
| 休息區：這些人不要排進去 | 休息區是必要狀態，不只是從名單刪除。 | 玩家狀態加入 `resting`，演算法只從 `waiting` 選人；管理員可一鍵休息/回到候場。 |
| 目前排隊名單或排隊序列 | 現場管理需要可視化 queue 與 next up。 | UI 分區：場地牆、下一場建議、候場序列、休息區、未付款/不可排清單。 |

---

## 3. 產品範圍建議

### 3.1 v1 MVP In-Scope

1. **建立排場 Session**
   - Session 名稱、日期、預設模式（雙打/單打）、預設每場分數或時間備註。
   - 仍採 localStorage 儲存，不需登入與雲端同步。

2. **人員管理**
   - 新增/編輯/刪除玩家。
   - 欄位：姓名、性別、等級、付款狀態、狀態、備註。
   - 狀態：`waiting` 候場、`playing` 場上、`resting` 休息、`left` 已離場、`blocked` 不可排。

3. **場地管理**
   - 新增/編輯/刪除場地。
   - 欄位：場地名稱、模式（單打/雙打）、啟用狀態、備註。
   - 每面場地可顯示目前上場玩家與開始時間。

4. **候場與休息區**
   - 候場列表顯示目前可排人數、等待順序、等級、性別、已打場次、等待時間。
   - 休息區顯示不參與排場的人，可一鍵回到候場。

5. **自動排場地**
   - 點擊「為空場排下一場」或「一鍵填滿所有空場」。
   - 雙打需要 4 人，單打需要 2 人。
   - 預設策略：公平優先 + 等級平衡。
   - 排入後玩家狀態轉為 `playing`。

6. **完成/釋放場地**
   - 管理員按「完成此場」後，玩家回到候場或休息，場地變空。
   - 更新玩家統計：已打場次、最後上場時間、累計等待相關資料。
   - 若從排場產生一場雙打比賽，可選擇「進入計分器」。

7. **下一場預覽**
   - 顯示每面空場的建議人選。
   - 管理員可接受建議、重新產生、手動換人。

### 3.2 v1 Out-of-Scope

- 帳號、多人即時同步、雲端資料庫。
- 付款金流，只記錄付款狀態。
- 複雜賽制（瑞士制、淘汰賽、循環賽）。
- 自動 Elo 更新；v1 只使用手動等級。
- 拖放 UI；v1 可先用按鈕與 select 實作。
- Excel / Google Sheets 匯出；可列 v2。

### 3.3 v2 / v3 候選功能

- PWA 離線安裝與大螢幕 wallboard 模式。
- CSV/XLSX 匯出出席、費用、場次紀錄。
- 依勝負紀錄更新 Elo 或內部 rating。
- 混雙/男雙/女雙偏好、避免同隊友連續搭配。
- 固定時間輪轉倒數與超時提醒。
- 掃 QR code 自助 check-in。
- 後端同步與多管理員共同操作。

---

## 4. 資料模型草案

目前專案已有 `MatchState`、`Player`、`CourtPositions` 等單場計分模型。建議新增 session 層級模型，不直接改動既有計分模型，避免把多人排場邏輯塞進單場比分狀態。

```ts
type Gender = 'male' | 'female' | 'other' | 'unspecified';
type PaymentStatus = 'paid' | 'unpaid' | 'waived' | 'unknown';
type PlayerQueueStatus = 'waiting' | 'playing' | 'resting' | 'left' | 'blocked';
type CourtPlayMode = 'singles' | 'doubles';
type CourtStatus = 'open' | 'playing' | 'disabled' | 'reserved';

type SessionPlayer = {
  id: string;
  name: string;
  gender: Gender;
  level: number; // 建議 1-10，或未來改成 A/B/C/D 對應分數
  paymentStatus: PaymentStatus;
  queueStatus: PlayerQueueStatus;
  joinedAt: string;
  lastPlayedAt?: string;
  gamesPlayed: number;
  gamesSatOut: number;
  skipCount: number;
  note?: string;
};

type Court = {
  id: string;
  name: string;
  mode: CourtPlayMode;
  status: CourtStatus;
  currentAssignmentId?: string;
  note?: string;
};

type CourtAssignment = {
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
  scoreBreakdown: {
    fairness: number;
    skillBalance: number;
    waitingTime: number;
    repeatPenalty: number;
    total: number;
  };
};

type SchedulingPolicy = {
  strategy: 'fairnessFirst' | 'skillBalanced' | 'firstComeFirstServed' | 'randomBalanced' | 'manual';
  allowUnpaidPlayers: boolean;
  maxLevelGap?: number;
  preferMixedDoubles: boolean;
  avoidRepeatPartner: boolean;
  fairnessWeight: number;
  skillWeight: number;
  waitTimeWeight: number;
  repeatPenaltyWeight: number;
};

type CourtSessionState = {
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

---

## 5. 自動排場演算法規格

### 5.1 候選人過濾

排場前先從 `players` 過濾出可用玩家：

1. `queueStatus === 'waiting'`。
2. 若 `allowUnpaidPlayers === false`，則 `paymentStatus === 'paid' || paymentStatus === 'waived'`。
3. 人數符合場地模式：單打 2 人、雙打 4 人。
4. 若設定 `maxLevelGap`，候選組合中最高等級與最低等級差距不可超過該值。

### 5.2 候選組合評分

對每個候選組合產生分數，總分越高越優先：

```txt
totalScore =
  waitTimeScore * waitTimeWeight
+ fairnessScore * fairnessWeight
+ skillBalanceScore * skillWeight
- repeatPenalty * repeatPenaltyWeight
+ mixedDoublesBonus
```

建議 v1 指標：

- `waitTimeScore`：等待越久越高，可用 `now - lastPlayedAt` 或 `joinedAt`。
- `fairnessScore`：已打場次越少越高，避免少數人一直上場。
- `skillBalanceScore`：雙打時比較兩隊平均等級差；差距越小越高。
- `repeatPenalty`：近期搭檔或對手重複越多扣越多。
- `mixedDoublesBonus`：若啟用混雙優先，每隊一男一女加分。

### 5.3 雙打分隊方式

同一組 4 人可有 3 種分隊方式。系統應選擇等級差最小、且符合混雙偏好的分隊：

1. A+B vs C+D
2. A+C vs B+D
3. A+D vs B+C

### 5.4 公平性防呆

- 若候場人數不足，不產生建議並顯示缺少幾人。
- 若所有最佳組合都因等級限制不成立，提示管理員放寬等級差或手動排場。
- 若某玩家連續被跳過，增加 `skipCount`，下一輪給予更高優先權。
- 管理員手動改動後，仍要寫入 assignment history，以便避免下一輪重複搭配。

---

## 6. UI / 頁面需求

### 6.1 導覽結構建議

目前 `AppScene` 為 `home | setup | position | match`。建議新增：

```ts
type AppScene = 'home' | 'setup' | 'position' | 'match' | 'sessionSetup' | 'courtScheduler';
```

使用者流程：

1. 首頁
   - `開始單場計分`
   - `開始排場地 Session`
   - `繼續上一個 Session`
2. Session 設定
   - 設定 Session 名稱、場地數、預設模式、排場策略。
3. 排場主控台
   - 場地牆
   - 候場序列
   - 休息區
   - 人員管理抽屜 / 區塊
4. 可選：從某個雙打 assignment 進入既有計分器。

### 6.2 排場主控台資訊架構

1. **場地牆**
   - 每面場地卡片：場地名稱、模式、狀態、目前球員、開始時間、完成按鈕。
   - 空場顯示「排下一場」。

2. **下一場建議**
   - 顯示推薦組合、分隊、推薦原因（等待久、等級平衡、少打場次）。
   - 操作：接受、重抽、手動調整。

3. **候場序列**
   - 顯示候場人數。
   - 欄位：姓名、等級、性別、付款、已打、等待時間、操作。
   - 操作：移到休息、標記離場、編輯。

4. **休息區**
   - 顯示休息人員。
   - 操作：回到候場、離場。

5. **不可排 / 未付款提醒**
   - 若政策不允許未付款，未付款者應清楚顯示但不進入候選。

---

## 7. 與既有計分功能整合

### 7.1 最小整合

- 排場功能先獨立為 session 模組。
- 當雙打場地 assignment 已產生時，提供「進入計分」按鈕。
- 系統用 assignment 的 4 位玩家建立既有 `MatchState`：
  - teamA 對應左方，teamB 對應右方。
  - 初始站位仍可沿用現有 position 頁面讓使用者確認。

### 7.2 中期整合

- 計分結束後回寫 assignment：完成時間、比分、勝方。
- 回到排場主控台時，自動釋放場地並更新玩家統計。
- 若使用者不需要計分，也可直接在排場頁按「完成此場」。

### 7.3 風險

- 現有 `Player` 型別只服務單場左右隊伍，不適合直接加性別、付款、候場狀態。建議新增 `SessionPlayer`，進入計分時再轉成既有 `Player`。
- 現有 localStorage 只保存 `AppState`，需要版本化，避免舊資料讀取失敗。
- 如果同時保存單場 match 與 court session，首頁需能分辨「繼續上一場比賽」與「繼續排場 session」。

---

## 8. 驗收條件（Acceptance Criteria）

### 8.1 人員與狀態

- 可以新增至少 20 位玩家並保存到 localStorage。
- 玩家可設定姓名、等級、性別、付款狀態。
- 玩家可在候場、休息、已離場之間切換。
- 休息與離場玩家不會被自動排入場地。

### 8.2 場地

- 可以建立至少 1-8 面場地。
- 每面場地可設定單打或雙打。
- 空場可產生下一場建議。
- 場地進行中時，不會被一鍵填場重複排入。

### 8.3 自動排場

- 雙打場地會選 4 位候場玩家，單打場地會選 2 位。
- 預設策略會優先照顧等待久、已打較少的人。
- 產生雙打時會自動分隊，並盡量讓兩隊等級平均接近。
- 不足人數時會顯示明確提示，不會產生不完整 assignment。

### 8.4 視覺化

- 主控台可一眼看到：目前各場地上場者、候場人數、休息區、下一場建議。
- 每位玩家不可同時出現在兩面場地。
- 完成場地後，玩家狀態與場地狀態會正確更新。

### 8.5 既有功能不回歸

- 目前單場雙打計分流程仍可獨立使用。
- Undo、發球輪轉、localStorage 恢復不受排場功能影響。

---

## 9. 建議開發切分

### Phase 1：純資料與演算法

- 新增 `src/types/session.ts`。
- 新增 `src/logic/sessionScheduler.ts`。
- 新增 `src/storage/sessionStorage.ts`。
- 單元或純函式測試：候選過濾、雙打分隊、評分排序、狀態轉移。

### Phase 2：排場主控台 UI

- 新增 session setup / scheduler scene。
- 實作人員、場地、候場、休息區 UI。
- 實作「排下一場」、「完成此場」、「一鍵填滿空場」。

### Phase 3：與計分器串接

- assignment 轉 match draft。
- 計分完成回寫 assignment。
- 首頁支援繼續 match 或 session。

### Phase 4：進階現場營運

- wallboard 模式。
- 匯出報表。
- 固定時間輪轉。
- PWA / 離線安裝。

---

## 9A. 功能需求細目（可直接轉 Issue）

### 9A.1 Session 與儲存

- `CourtSessionState` 需要版本欄位，例如 `schemaVersion: 1`，避免未來 localStorage 結構升級時讀取失敗。
- localStorage key 應與既有單場計分分開，例如：
  - `badminton-scoreboard-app-state`：既有單場計分。
  - `badminton-court-session-state`：排場 Session。
- 首頁需分成三個入口：開始單場計分、開始排場 Session、繼續排場 Session。

### 9A.2 玩家管理

- 必填欄位：姓名。
- 建議欄位：等級、性別、付款狀態、備註。
- 快捷操作：付款/未付款切換、休息/回候場、離場。
- 防呆：若玩家正在場上，不能直接刪除；需先完成或取消該場 assignment。

### 9A.3 場地管理

- 場地必須有名稱、模式、狀態。
- 場地模式決定每場需要人數：`singles = 2`、`doubles = 4`。
- `disabled` 或 `reserved` 場地不參與一鍵填場。
- 場地卡片需提供：排下一場、完成此場、取消此場、進入計分器。

### 9A.4 自動排場

- 輸入：目前 session、目標 courtId、policy。
- 輸出：`CourtAssignmentRecommendation`，包含 assignment 草案、總分、分數拆解、警告。
- 如果候選人不足，回傳 typed error，不直接 alert 字串。
- 一鍵填滿多場地時，已被前一面場地選中的玩家不可再被後續場地選中。

### 9A.5 手動覆寫

- 管理員可在推薦名單中移除/替換玩家。
- 手動建立 assignment 仍需檢查人數、玩家狀態、付款政策。
- 手動覆寫後 `source = 'manual'`，但仍更新配對歷史，避免下輪演算法失真。

### 9A.6 與計分器串接

- 雙打 assignment 才顯示「進入計分器」。單打先不串接既有雙打輪轉計分器。
- 進入計分器前需要確認左右隊與初始站位。
- 從計分器返回排場時，不可遺失 session state。

### 9A.7 例外情境

- 場上玩家臨時離開：提供「取消此場」或「替換玩家」，並記錄為 manual change。
- 未付款玩家被允許上場：需要在 assignment 上保留 warning，方便主揪確認。
- 等級差限制導致排不出：提示「放寬等級差 / 改手動 / 等更多玩家」。
- 候場人數很多：列表需可排序或分區，至少支援依等待優先級排序。


---

## 10. 初版優先級建議

1. **必做**：人員資料、付款狀態、休息區、場地清單、候場序列。
2. **必做**：自動排雙打/單打且不重複排同一人。
3. **必做**：公平優先 + 等級平衡的可解釋推薦。
4. **應做**：完成場地後更新統計，避免少數玩家一直上場。
5. **可延後**：拖放、匯出、Elo、即時同步、付款金流。
