export type MatchConfig = {
  mode: 'doubles';
  targetScore: number;
  enableDeuce: boolean;
  maxScore: number;
  enableCourtChange: boolean;
  courtChangePoint: number;
  leftTeamName: string;
  rightTeamName: string;
};

export type Player = {
  id: string;
  name: string;
  team: 'left' | 'right';
};

export type CourtPositions = {
  leftEvenCourt: string;
  leftOddCourt: string;
  rightEvenCourt: string;
  rightOddCourt: string;
};

export type RallyRecord = {
  rallyNumber: number;
  scoringSide: 'left' | 'right';
  scoreAfter: { left: number; right: number };
  servingSideAfter: 'left' | 'right';
  serverId: string;
  receiverId: string;
  positionsAfter: CourtPositions;
  reason?: string;
  losingPlayerId?: string;
  note?: string;
  timestamp: string;
};

export type MatchState = {
  config: MatchConfig;
  players: Player[];
  leftScore: number;
  rightScore: number;
  servingSide: 'left' | 'right';
  positions: CourtPositions;
  currentServerId: string;
  currentReceiverId: string;
  rallies: RallyRecord[];
  snapshots: MatchSnapshot[];
  isGameOver: boolean;
  winner?: 'left' | 'right';
  courtChangeApplied: boolean;
  courtChangeAnnounced: boolean;
};

export type MatchSnapshot = Omit<MatchState, 'snapshots'>;

export type AppScene = 'home' | 'setup' | 'position' | 'match';

export type AppState = {
  scene: AppScene;
  match?: MatchState;
};

export type SetupDraft = {
  config: MatchConfig;
  players: Player[];
};
