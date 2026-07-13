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
