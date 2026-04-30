import type { CourtPositions, MatchConfig, MatchSnapshot, MatchState, Player, RallyRecord } from '../types/match';

const createPlayerIndex = (players: Player[]) =>
  new Map(players.map((player) => [player.id, player]));

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const opponentSide = (side: 'left' | 'right') => (side === 'left' ? 'right' : 'left');

const scoreKey = (side: 'left' | 'right') => (side === 'left' ? 'leftScore' : 'rightScore');

const courtKey = (side: 'left' | 'right', parity: 'even' | 'odd') => `${side}${parity === 'even' ? 'EvenCourt' : 'OddCourt'}` as const;

const isEven = (value: number) => value % 2 === 0;

export const createPlayers = (leftTeamName: string, rightTeamName: string): Player[] => [
  { id: 'left-a', name: '左隊 A', team: 'left' },
  { id: 'left-b', name: '左隊 B', team: 'left' },
  { id: 'right-a', name: '右隊 A', team: 'right' },
  { id: 'right-b', name: '右隊 B', team: 'right' },
].map((player, index) => ({
  ...player,
  name:
    index === 0 ? `${leftTeamName} 1` : index === 1 ? `${leftTeamName} 2` : index === 2 ? `${rightTeamName} 1` : `${rightTeamName} 2`,
})) as Player[];

export const createInitialPositions = (players: Player[]): CourtPositions => ({
  leftEvenCourt: players[0]?.id ?? '',
  leftOddCourt: players[1]?.id ?? '',
  rightEvenCourt: players[2]?.id ?? '',
  rightOddCourt: players[3]?.id ?? '',
});

export const createMatchState = (config: MatchConfig, players: Player[], positions?: CourtPositions): MatchState => {
  const nextPositions = positions ?? createInitialPositions(players);
  const servingSide: 'left' | 'right' = 'left';
  const state: MatchState = {
    config,
    players,
    leftScore: 0,
    rightScore: 0,
    servingSide,
    positions: nextPositions,
    currentServerId: nextPositions.leftEvenCourt,
    currentReceiverId: nextPositions.rightEvenCourt,
    rallies: [],
    snapshots: [],
    isGameOver: false,
    courtChangeApplied: false,
    courtChangeAnnounced: false,
  };

  syncServingAssignments(state);
  return state;
};

export const createSnapshot = (state: MatchState): MatchSnapshot => {
  const { snapshots: _snapshots, ...rest } = state;
  return clone(rest);
};

export const syncServingAssignments = (state: MatchState): MatchState => {
  const servingScore = state.servingSide === 'left' ? state.leftScore : state.rightScore;
  const receivingSide = opponentSide(state.servingSide);
  const receiverScore = receivingSide === 'left' ? state.leftScore : state.rightScore;
  const servingParity = isEven(servingScore) ? 'even' : 'odd';
  const receiverParity = isEven(receiverScore) ? 'even' : 'odd';

  state.currentServerId = state.positions[courtKey(state.servingSide, servingParity)];
  state.currentReceiverId = state.positions[courtKey(receivingSide, receiverParity)];
  return state;
};

const swapTeamPositions = (positions: CourtPositions, side: 'left' | 'right'): CourtPositions => {
  if (side === 'left') {
    return {
      ...positions,
      leftEvenCourt: positions.leftOddCourt,
      leftOddCourt: positions.leftEvenCourt,
    };
  }

  return {
    ...positions,
    rightEvenCourt: positions.rightOddCourt,
    rightOddCourt: positions.rightEvenCourt,
  };
};

const determineGameOver = (state: MatchState) => {
  const { targetScore, maxScore, enableDeuce } = state.config;
  const leftScore = state.leftScore;
  const rightScore = state.rightScore;

  if (leftScore < targetScore && rightScore < targetScore) {
    return false;
  }

  const lead = Math.abs(leftScore - rightScore);
  const reachedMax = leftScore === maxScore || rightScore === maxScore;
  const hasWinMargin = enableDeuce ? lead >= 2 : true;

  return reachedMax || hasWinMargin;
};

const determineWinner = (state: MatchState): 'left' | 'right' | undefined => {
  if (!state.isGameOver) {
    return undefined;
  }

  if (state.leftScore === state.rightScore) {
    return undefined;
  }

  return state.leftScore > state.rightScore ? 'left' : 'right';
};

export const applyRally = (
  state: MatchState,
  scoringSide: 'left' | 'right',
  note?: string,
): MatchState => {
  if (state.isGameOver) {
    return state;
  }

  const next = clone(state);
  next.snapshots.push(createSnapshot(state));
  next.rallies = clone(state.rallies);
  next.positions = clone(state.positions);

  next[scoreKey(scoringSide)] += 1;

  if (next.servingSide === scoringSide) {
    next.positions = swapTeamPositions(next.positions, scoringSide);
  } else {
    next.servingSide = scoringSide;
  }

  syncServingAssignments(next);

  if (next.config.enableCourtChange && !next.courtChangeApplied) {
    const shouldAnnounce = Math.max(next.leftScore, next.rightScore) === next.config.courtChangePoint;
    if (shouldAnnounce) {
      next.courtChangeAnnounced = true;
      next.courtChangeApplied = true;
    }
  }

  next.isGameOver = determineGameOver(next);
  next.winner = determineWinner(next);

  const rallyNumber = next.rallies.length + 1;
  const serverId = next.currentServerId;
  const receiverId = next.currentReceiverId;

  const record: RallyRecord = {
    rallyNumber,
    scoringSide,
    scoreAfter: { left: next.leftScore, right: next.rightScore },
    servingSideAfter: next.servingSide,
    serverId,
    receiverId,
    positionsAfter: clone(next.positions),
    reason: next.courtChangeAnnounced ? '達到換場點' : next.servingSide === scoringSide ? '發球方得分，交換站位' : '接發方得分，發球權轉移',
    note,
    timestamp: new Date().toISOString(),
  };

  next.rallies.push(record);
  return next;
};

export const undoLastRally = (state: MatchState): MatchState => {
  const snapshot = state.snapshots.at(-1);
  if (!snapshot) {
    return state;
  }

  return {
    ...clone(snapshot),
    snapshots: state.snapshots.slice(0, -1),
  };
};

export const buildPositionSummary = (state: MatchState) => {
  const playerMap = createPlayerIndex(state.players);
  return [
    { label: `${state.config.leftTeamName} 偶數區`, id: state.positions.leftEvenCourt, player: playerMap.get(state.positions.leftEvenCourt)?.name ?? '未設定' },
    { label: `${state.config.leftTeamName} 奇數區`, id: state.positions.leftOddCourt, player: playerMap.get(state.positions.leftOddCourt)?.name ?? '未設定' },
    { label: `${state.config.rightTeamName} 偶數區`, id: state.positions.rightEvenCourt, player: playerMap.get(state.positions.rightEvenCourt)?.name ?? '未設定' },
    { label: `${state.config.rightTeamName} 奇數區`, id: state.positions.rightOddCourt, player: playerMap.get(state.positions.rightOddCourt)?.name ?? '未設定' },
  ];
};
