import type { Court, CourtAssignment, CourtAssignmentRecommendation, CourtPlayMode, CourtSessionState, PlayerQueueStatus, SchedulingPolicy, SessionPlayer } from '../types/session';

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const iso = (now = new Date()) => now.toISOString();

export const createDefaultSchedulingPolicy = (): SchedulingPolicy => ({
  strategy: 'fairnessFirst',
  allowUnpaidPlayers: true,
  preferMixedDoubles: true,
  avoidRepeatPartner: true,
  fairnessWeight: 6,
  skillWeight: 4,
  waitTimeWeight: 3,
  repeatPenaltyWeight: 5,
});

export const createCourtSession = (name = '今日排場'): CourtSessionState => {
  const now = iso();
  return { schemaVersion: 1, id: id('session'), name, createdAt: now, updatedAt: now, players: [], courts: [], assignments: [], policy: createDefaultSchedulingPolicy() };
};

export const createSessionPlayer = (input: Partial<SessionPlayer> & { name: string }): SessionPlayer => ({
  id: input.id ?? id('player'),
  name: input.name.trim(),
  gender: input.gender ?? 'unspecified',
  level: Math.min(10, Math.max(1, input.level ?? 5)),
  paymentStatus: input.paymentStatus ?? 'paid',
  queueStatus: input.queueStatus ?? 'waiting',
  joinedAt: input.joinedAt ?? iso(),
  lastPlayedAt: input.lastPlayedAt,
  gamesPlayed: input.gamesPlayed ?? 0,
  gamesSatOut: input.gamesSatOut ?? 0,
  skipCount: input.skipCount ?? 0,
  note: input.note,
});

export const createCourt = (input: Partial<Court> & { name: string }): Court => ({
  id: input.id ?? id('court'), name: input.name.trim(), mode: input.mode ?? 'doubles', status: input.status ?? 'open', currentAssignmentId: input.currentAssignmentId, note: input.note,
});

export const getRequiredPlayers = (mode: CourtPlayMode): 2 | 4 => (mode === 'singles' ? 2 : 4);

export const getEligiblePlayers = (session: CourtSessionState): SessionPlayer[] => session.players.filter((p) => p.queueStatus === 'waiting' && (session.policy.allowUnpaidPlayers || (p.paymentStatus !== 'unpaid' && p.paymentStatus !== 'unknown')));

const combinations = <T,>(items: T[], size: number): T[][] => size === 0 ? [[]] : items.flatMap((item, index) => combinations(items.slice(index + 1), size - 1).map((rest) => [item, ...rest]));
const avg = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / Math.max(1, xs.length);
const minutesWaiting = (p: SessionPlayer, now: Date) => Math.max(0, (now.getTime() - new Date(p.lastPlayedAt ?? p.joinedAt).getTime()) / 60000);

const bestTeams = (players: SessionPlayer[]) => {
  if (players.length === 2) return { a: [players[0].id], b: [players[1].id], gap: Math.abs(players[0].level - players[1].level) };
  const [p1, p2, p3, p4] = players;
  const splits = [[[p1, p2], [p3, p4]], [[p1, p3], [p2, p4]], [[p1, p4], [p2, p3]]];
  return splits.map(([a, b]) => ({ a: a.map((p) => p.id), b: b.map((p) => p.id), gap: Math.abs(avg(a.map((p) => p.level)) - avg(b.map((p) => p.level))) })).sort((x, y) => x.gap - y.gap)[0];
};

const playedTogether = (assignment: CourtAssignment, playerIds: string[]) => playerIds.every((pid) => assignment.playerIds.includes(pid));

export const recommendAssignment = (session: CourtSessionState, courtId: string, now = new Date()): CourtAssignmentRecommendation | { error: string } => {
  const court = session.courts.find((item) => item.id === courtId);
  if (!court) return { error: '找不到指定場地。' };
  if (court.status !== 'open') return { error: '場地不是空場，不能自動排場。' };
  const required = getRequiredPlayers(court.mode);
  const eligible = getEligiblePlayers(session);
  if (eligible.length < required) return { error: `可排玩家不足，${court.mode === 'doubles' ? '雙打' : '單打'}需要 ${required} 人。` };

  const candidates = combinations(eligible, required).filter((group) => !session.policy.maxLevelGap || Math.max(...group.map((p) => p.level)) - Math.min(...group.map((p) => p.level)) <= session.policy.maxLevelGap!);
  if (!candidates.length) return { error: '沒有符合等級差限制的候選組合。' };

  const scored = candidates.map((group) => {
    const team = bestTeams(group);
    const wait = avg(group.map((p) => minutesWaiting(p, now)));
    const fairness = avg(group.map((p) => Math.max(0, 10 - p.gamesPlayed * 2 + p.skipCount)));
    const skillBalance = Math.max(0, 10 - team.gap * 2);
    const repeatPenalty = session.policy.avoidRepeatPartner ? session.assignments.filter((a) => playedTogether(a, group.map((p) => p.id))).length : 0;
    const mixedDoublesBonus = session.policy.preferMixedDoubles && group.length === 4 && group.some((p) => p.gender === 'male') && group.some((p) => p.gender === 'female') ? 2 : 0;
    const total = fairness * session.policy.fairnessWeight + skillBalance * session.policy.skillWeight + wait * session.policy.waitTimeWeight - repeatPenalty * session.policy.repeatPenaltyWeight + mixedDoublesBonus;
    return { group, team, score: { fairness, skillBalance, waitingTime: wait, repeatPenalty, mixedDoublesBonus, total } };
  }).sort((a, b) => b.score.total - a.score.total)[0];

  const assignment: CourtAssignment = { id: id('assignment'), courtId, mode: court.mode, playerIds: scored.group.map((p) => p.id), teamAPlayerIds: scored.team.a, teamBPlayerIds: scored.team.b, createdAt: iso(now), source: 'auto', scoreBreakdown: scored.score, warnings: [] };
  return { courtId, assignment, warnings: [], reason: `推薦 ${scored.group.map((p) => p.name).join('、')}；等待/公平/等級平衡綜合分 ${scored.score.total.toFixed(1)}。` };
};

export const recommendAssignmentsForOpenCourts = (session: CourtSessionState, now = new Date()) => session.courts.filter((c) => c.status === 'open').map((c) => recommendAssignment(session, c.id, now)).filter((r): r is CourtAssignmentRecommendation => !('error' in r));

export const acceptAssignment = (session: CourtSessionState, recommendation: CourtAssignmentRecommendation, now = new Date()): CourtSessionState => ({
  ...session,
  updatedAt: iso(now),
  players: session.players.map((p) => recommendation.assignment.playerIds.includes(p.id) ? { ...p, queueStatus: 'playing' } : p.queueStatus === 'waiting' ? { ...p, gamesSatOut: p.gamesSatOut + 1, skipCount: p.skipCount + 1 } : p),
  courts: session.courts.map((c) => c.id === recommendation.courtId ? { ...c, status: 'playing', currentAssignmentId: recommendation.assignment.id } : c),
  assignments: [...session.assignments, { ...recommendation.assignment, startedAt: iso(now) }],
});

export const completeAssignment = (session: CourtSessionState, assignmentId: string, now = new Date()): CourtSessionState => {
  const assignment = session.assignments.find((item) => item.id === assignmentId);
  if (!assignment) return session;
  return { ...session, updatedAt: iso(now), players: session.players.map((p) => assignment.playerIds.includes(p.id) ? { ...p, queueStatus: 'waiting', gamesPlayed: p.gamesPlayed + 1, skipCount: 0, lastPlayedAt: iso(now) } : p), courts: session.courts.map((c) => c.currentAssignmentId === assignmentId ? { ...c, status: 'open', currentAssignmentId: undefined } : c), assignments: session.assignments.map((a) => a.id === assignmentId ? { ...a, completedAt: iso(now) } : a) };
};

export const cancelAssignment = (session: CourtSessionState, assignmentId: string): CourtSessionState => {
  const assignment = session.assignments.find((item) => item.id === assignmentId);
  if (!assignment) return session;
  return { ...session, updatedAt: iso(), players: session.players.map((p) => assignment.playerIds.includes(p.id) ? { ...p, queueStatus: 'waiting' } : p), courts: session.courts.map((c) => c.currentAssignmentId === assignmentId ? { ...c, status: 'open', currentAssignmentId: undefined } : c), assignments: session.assignments.filter((a) => a.id !== assignmentId) };
};

export const updatePlayerQueueStatus = (session: CourtSessionState, playerId: string, status: PlayerQueueStatus): CourtSessionState => ({ ...session, updatedAt: iso(), players: session.players.map((p) => p.id === playerId ? { ...p, queueStatus: status } : p) });
