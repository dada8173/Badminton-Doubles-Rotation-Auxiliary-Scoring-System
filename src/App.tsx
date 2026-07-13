import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  applyRally,
  buildPositionSummary,
  createInitialPositions,
  createMatchState,
  syncServingAssignments,
  undoLastRally,
} from './logic/matchEngine';
import { clearAppState, hasSavedAppState, loadAppState, saveAppState } from './storage/matchStorage';
import type { AppScene, CourtPositions, MatchConfig, MatchState, Player } from './types/match';

type DraftState = {
  config: MatchConfig;
  players: Player[];
  positions: CourtPositions;
};

type RallyDraft = {
  reason: string;
  losingPlayerId: string;
  note: string;
};

const createEmptyRallyDraft = (): RallyDraft => ({
  reason: '',
  losingPlayerId: '',
  note: '',
});

const createDraftPlayers = (leftTeamName: string, rightTeamName: string): Player[] => [
  { id: 'left-a', name: `${leftTeamName} A`, team: 'left' },
  { id: 'left-b', name: `${leftTeamName} B`, team: 'left' },
  { id: 'right-a', name: `${rightTeamName} A`, team: 'right' },
  { id: 'right-b', name: `${rightTeamName} B`, team: 'right' },
];

const createDefaultConfig = (): MatchConfig => ({
  mode: 'doubles',
  targetScore: 21,
  enableDeuce: true,
  maxScore: 30,
  enableCourtChange: true,
  courtChangePoint: 11,
  leftTeamName: '左方',
  rightTeamName: '右方',
});

const createDefaultDraft = (): DraftState => {
  const config = createDefaultConfig();
  const players = createDraftPlayers(config.leftTeamName, config.rightTeamName);

  return {
    config,
    players,
    positions: createInitialPositions(players),
  };
};

const formatPositions = (positions: CourtPositions, players: Player[]) => {
  const playerMap = new Map(players.map((player) => [player.id, player.name]));
  return [
    { key: 'leftEvenCourt', label: '左方偶數區', id: positions.leftEvenCourt, name: playerMap.get(positions.leftEvenCourt) ?? '未指定' },
    { key: 'leftOddCourt', label: '左方奇數區', id: positions.leftOddCourt, name: playerMap.get(positions.leftOddCourt) ?? '未指定' },
    { key: 'rightEvenCourt', label: '右方偶數區', id: positions.rightEvenCourt, name: playerMap.get(positions.rightEvenCourt) ?? '未指定' },
    { key: 'rightOddCourt', label: '右方奇數區', id: positions.rightOddCourt, name: playerMap.get(positions.rightOddCourt) ?? '未指定' },
  ];
};

const App = () => {
  const [scene, setScene] = useState<AppScene>('home');
  const [match, setMatch] = useState<MatchState | undefined>();
  const [draft, setDraft] = useState<DraftState>(() => createDefaultDraft());
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState('');
  const [rallyDraft, setRallyDraft] = useState<RallyDraft>(() => createEmptyRallyDraft());

  useEffect(() => {
    const saved = loadAppState();
    if (saved?.match) {
      setScene('match');
      setMatch(saved.match);
      setDraft({
        config: saved.match.config,
        players: saved.match.players,
        positions: saved.match.positions,
      });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (scene === 'match' && match) {
      saveAppState({ scene, match });
      return;
    }

    clearAppState();
  }, [hydrated, match, scene]);

  const savedAvailable = hydrated && hasSavedAppState();

  const positionSummary = useMemo(() => {
    if (!match) {
      return [];
    }

    return buildPositionSummary(match);
  }, [match]);

  const startNewMatch = () => {
    const nextDraft = createDefaultDraft();
    setDraft(nextDraft);
    setMatch(undefined);
    setScene('setup');
    setMessage('');
  };

  const continueMatch = () => {
    const saved = loadAppState();
    if (!saved?.match) {
      return;
    }

    setScene('match');
    setMatch(saved.match);
    setDraft({
      config: saved.match.config,
      players: saved.match.players,
      positions: saved.match.positions,
    });
    setMessage('');
  };

  const resetAll = () => {
    clearAppState();
    setDraft(createDefaultDraft());
    setMatch(undefined);
    setScene('home');
    setMessage('');
  };

  const updateConfig = <K extends keyof MatchConfig>(key: K, value: MatchConfig[K]) => {
    setDraft((current) => ({
      ...current,
      config: {
        ...current.config,
        [key]: value,
      },
    }));
  };

  const updatePlayerName = (playerId: string, name: string) => {
    setDraft((current) => ({
      ...current,
      players: current.players.map((player) => (player.id === playerId ? { ...player, name } : player)),
    }));
  };

  const submitSetup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const players = createDraftPlayers(draft.config.leftTeamName, draft.config.rightTeamName).map((player) => {
      const overridden = draft.players.find((current) => current.id === player.id);
      return overridden ? { ...player, name: overridden.name || player.name } : player;
    });

    const nextDraft: DraftState = {
      config: {
        ...draft.config,
        leftTeamName: draft.config.leftTeamName.trim() || '左方',
        rightTeamName: draft.config.rightTeamName.trim() || '右方',
      },
      players,
      positions: createInitialPositions(players),
    };

    setDraft(nextDraft);
    setScene('position');
    setMessage('');
  };

  const assignPosition = (key: keyof CourtPositions, playerId: string) => {
    setDraft((current) => {
      const nextPositions = {
        ...current.positions,
        [key]: playerId,
      };

      return {
        ...current,
        positions: nextPositions,
      };
    });
  };

  const beginMatch = () => {
    const nextMatch = createMatchState(draft.config, draft.players, draft.positions);
    syncServingAssignments(nextMatch);
    setMatch(nextMatch);
    setScene('match');
    setMessage('');
  };

  const scorePoint = (side: 'left' | 'right') => {
    if (!match) {
      return;
    }

    setMatch((current) => (current ? applyRally(current, side, rallyDraft) : current));
    setRallyDraft(createEmptyRallyDraft());
  };

  const undoPoint = () => {
    setMatch((current) => (current ? undoLastRally(current) : current));
  };

  const goBackToHome = () => {
    setScene('home');
    setMessage('');
  };

  const editPositions = () => {
    if (!match) {
      return;
    }

    setDraft({
      config: match.config,
      players: match.players,
      positions: match.positions,
    });
    setScene('position');
    setMessage('');
  };

  const duplicatePosition = (() => {
    const values = Object.values(draft.positions);
    return new Set(values).size !== values.length;
  })();

  const losingPlayerOptions = match?.players ?? [];

  const playerName = (playerId?: string) => match?.players.find((player) => player.id === playerId)?.name ?? '';

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="hero">
          <div>
            <p className="eyebrow">羽球雙打輪轉輔助計分器</p>
            <h1>主裁判只要點分數，系統就會跟上輪轉。</h1>
            <p className="hero-copy">
              以手機橫向優先設計，提供比分、發球權、接發球員、站位與 Undo，一場比賽只保留最需要的操作。
            </p>
          </div>
          <div className="hero-card">
            <span className="status-dot" />
            <div>
              <strong>{match ? '比賽進行中' : '待建立新比賽'}</strong>
              <p>{savedAvailable ? '可繼續上一場比賽' : '目前沒有可恢復的比賽'}</p>
            </div>
          </div>
        </header>

        {message ? <div className="banner">{message}</div> : null}

        {scene === 'home' ? (
          <section className="panel home-panel">
            <button className="primary-btn" type="button" onClick={startNewMatch}>
              開始新比賽
            </button>
            <button className="secondary-btn" type="button" onClick={continueMatch} disabled={!savedAvailable}>
              繼續上一場比賽
            </button>
          </section>
        ) : null}

        {scene === 'setup' ? (
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="section-kicker">比賽設定</p>
                <h2>先建立比賽基本資料</h2>
              </div>
              <button className="ghost-btn" type="button" onClick={() => setScene('home')}>
                返回首頁
              </button>
            </div>

            <form className="form-grid" onSubmit={submitSetup}>
              <label>
                左方隊名
                <input
                  value={draft.config.leftTeamName}
                  onChange={(event) => updateConfig('leftTeamName', event.target.value)}
                  required
                />
              </label>
              <label>
                右方隊名
                <input
                  value={draft.config.rightTeamName}
                  onChange={(event) => updateConfig('rightTeamName', event.target.value)}
                  required
                />
              </label>
              <label>
                目標分數
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={draft.config.targetScore}
                  onChange={(event) => updateConfig('targetScore', Number(event.target.value))}
                />
              </label>
              <label>
                換場分數
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={draft.config.courtChangePoint}
                  onChange={(event) => updateConfig('courtChangePoint', Number(event.target.value))}
                />
              </label>
              <label>
                最大分數
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={draft.config.maxScore}
                  onChange={(event) => updateConfig('maxScore', Number(event.target.value))}
                />
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={draft.config.enableDeuce}
                  onChange={(event) => updateConfig('enableDeuce', event.target.checked)}
                />
                啟用 deuce
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={draft.config.enableCourtChange}
                  onChange={(event) => updateConfig('enableCourtChange', event.target.checked)}
                />
                啟用換場提示
              </label>

              <label>
                左方球員 A
                <input
                  value={draft.players[0]?.name ?? ''}
                  onChange={(event) => updatePlayerName('left-a', event.target.value)}
                  required
                />
              </label>
              <label>
                左方球員 B
                <input
                  value={draft.players[1]?.name ?? ''}
                  onChange={(event) => updatePlayerName('left-b', event.target.value)}
                  required
                />
              </label>
              <label>
                右方球員 A
                <input
                  value={draft.players[2]?.name ?? ''}
                  onChange={(event) => updatePlayerName('right-a', event.target.value)}
                  required
                />
              </label>
              <label>
                右方球員 B
                <input
                  value={draft.players[3]?.name ?? ''}
                  onChange={(event) => updatePlayerName('right-b', event.target.value)}
                  required
                />
              </label>

              <div className="form-actions">
                <button className="ghost-btn" type="button" onClick={goBackToHome}>
                  返回
                </button>
                <button className="primary-btn" type="submit">
                  前往初始站位
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {scene === 'position' ? (
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="section-kicker">初始站位</p>
                <h2>設定 0:0 的四個站位</h2>
              </div>
              <button className="ghost-btn" type="button" onClick={() => setScene('setup')}>
                返回設定
              </button>
            </div>

            <div className="position-grid">
              {formatPositions(draft.positions, draft.players).map((slot) => (
                <label key={slot.key}>
                  {slot.label}
                  <select
                    value={slot.id}
                    onChange={(event) => assignPosition(slot.key as keyof CourtPositions, event.target.value)}
                  >
                    {draft.players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            {duplicatePosition ? <p className="notice warning">目前有重複站位，請確認每位球員只出現在一個位置。</p> : null}

            <div className="form-actions">
              <button className="ghost-btn" type="button" onClick={() => setScene('setup')}>
                回上一步
              </button>
              <button className="primary-btn" type="button" onClick={beginMatch} disabled={duplicatePosition}>
                開始計分
              </button>
            </div>
          </section>
        ) : null}

        {scene === 'match' && match ? (
          <main className="match-layout">
            <section className="scoreboard panel panel-tight">
              <div className="score-card left">
                <span>{match.config.leftTeamName}</span>
                <strong>{match.leftScore}</strong>
              </div>
              <div className="score-card center">
                <span>發球方</span>
                <strong>{match.servingSide === 'left' ? match.config.leftTeamName : match.config.rightTeamName}</strong>
              </div>
              <div className="score-card right">
                <span>{match.config.rightTeamName}</span>
                <strong>{match.rightScore}</strong>
              </div>
            </section>

            <section className="panel match-panel">
              <div className="panel-head">
                <div>
                  <p className="section-kicker">比賽主畫面</p>
                  <h2>{match.isGameOver ? '比賽結束' : '請依輪轉規則記分'}</h2>
                </div>
                <div className="inline-actions">
                  <button className="ghost-btn" type="button" onClick={undoPoint} disabled={match.snapshots.length === 0}>
                    Undo
                  </button>
                  <button className="ghost-btn" type="button" onClick={resetAll}>
                    結束並清除
                  </button>
                </div>
              </div>

              <div className="match-status-grid">
                <div className="status-pill">
                  <span>發球員</span>
                  <strong>{match.players.find((player) => player.id === match.currentServerId)?.name ?? '未設定'}</strong>
                </div>
                <div className="status-pill">
                  <span>接發員</span>
                  <strong>{match.players.find((player) => player.id === match.currentReceiverId)?.name ?? '未設定'}</strong>
                </div>
                <div className="status-pill">
                  <span>輪轉提示</span>
                  <strong>{match.courtChangeAnnounced ? '已達換場點' : '正常進行中'}</strong>
                </div>
                <div className="status-pill">
                  <span>比賽結果</span>
                  <strong>{match.isGameOver ? `${match.winner === 'left' ? match.config.leftTeamName : match.config.rightTeamName} 獲勝` : '尚未結束'}</strong>
                </div>
              </div>

              <div className="rally-entry">
                <label>
                  本球原因（選填）
                  <input
                    value={rallyDraft.reason}
                    placeholder="例如：殺球得分、出界、觸網"
                    onChange={(event) => setRallyDraft((current) => ({ ...current, reason: event.target.value }))}
                  />
                </label>
                <label>
                  失分者（選填）
                  <select
                    value={rallyDraft.losingPlayerId}
                    onChange={(event) => setRallyDraft((current) => ({ ...current, losingPlayerId: event.target.value }))}
                  >
                    <option value="">不指定</option>
                    {losingPlayerOptions.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rally-note">
                  備註（選填）
                  <textarea
                    value={rallyDraft.note}
                    placeholder="補充判決、戰術或特殊狀況"
                    onChange={(event) => setRallyDraft((current) => ({ ...current, note: event.target.value }))}
                  />
                </label>
              </div>

              <div className="big-actions">
                <button className="score-btn left" type="button" onClick={() => scorePoint('left')} disabled={match.isGameOver}>
                  左方得分
                </button>
                <button className="score-btn right" type="button" onClick={() => scorePoint('right')} disabled={match.isGameOver}>
                  右方得分
                </button>
              </div>

              <div className="court-map">
                {positionSummary.map((slot) => (
                  <article key={slot.label} className="court-slot">
                    <span>{slot.label}</span>
                    <strong>{slot.player}</strong>
                  </article>
                ))}
              </div>

              <div className="match-footer">
                <button className="ghost-btn" type="button" onClick={editPositions}>
                  調整站位
                </button>
                <p>
                  每球都會自動處理比分、發球權、輪轉與記錄。{match.isGameOver ? '此場比賽已完成。' : '若點錯，可立即 Undo。'}
                </p>
              </div>
            </section>

            <aside className="panel rally-panel">
              <div className="panel-head">
                <div>
                  <p className="section-kicker">每球紀錄</p>
                  <h2>Rally Log</h2>
                </div>
              </div>

              <div className="rally-list">
                {match.rallies.length === 0 ? <p className="empty-state">尚未有任何球。</p> : null}
                {match.rallies.slice().reverse().map((rally) => (
                  <article key={rally.rallyNumber} className="rally-item">
                    <div>
                      <strong>#{rally.rallyNumber} {rally.scoringSide === 'left' ? '左方' : '右方'}得分</strong>
                      <p>{rally.reason}</p>
                      {rally.losingPlayerId ? <p>失分者：{playerName(rally.losingPlayerId)}</p> : null}
                      {rally.note ? <p>備註：{rally.note}</p> : null}
                    </div>
                    <small>
                      {rally.scoreAfter.left} : {rally.scoreAfter.right}
                    </small>
                  </article>
                ))}
              </div>
            </aside>
          </main>
        ) : null}
      </div>
    </div>
  );
};

export default App;