/**
 * Runtime voting cadence configuration.
 *
 * Backed by in-process memory with env-based defaults.
 * Protected mutation happens only through internal admin routes.
 */

export type VotingCadence = 'immediate' | 'daily' | 'weekly';

export interface VotingRuntimeConfig {
  cadence: VotingCadence;
  agentVotingDurationHours: number;
  humanVotingDurationHours: number;
  agentVotingDurationMinutes: number;
  humanVotingDurationMinutes: number;
  startDayOfWeek: number; // 0-6, used by weekly mode
  startHour: number; // 0-23, used by daily/weekly mode (UTC)
  immediateStartDelaySeconds: number; // used by immediate mode
}

export interface VotingRuntimeConfigState {
  config: VotingRuntimeConfig;
  updatedAt: string;
}

export interface VotingRuntimeConfigUpdate {
  cadence?: VotingCadence;
  agentVotingDurationHours?: number;
  humanVotingDurationHours?: number;
  agentVotingDurationMinutes?: number;
  humanVotingDurationMinutes?: number;
  startDayOfWeek?: number;
  startHour?: number;
  immediateStartDelaySeconds?: number;
}

const DEFAULT_CONFIG: VotingRuntimeConfig = {
  cadence: (process.env.VOTING_CADENCE as VotingCadence) || 'weekly',
  agentVotingDurationHours: parseInt(process.env.AGENT_VOTING_DURATION_HOURS || '24', 10),
  humanVotingDurationHours: parseInt(process.env.HUMAN_VOTING_DURATION_HOURS || '48', 10),
  agentVotingDurationMinutes: parseInt(process.env.AGENT_VOTING_DURATION_MINUTES || '1440', 10),
  humanVotingDurationMinutes: parseInt(process.env.HUMAN_VOTING_DURATION_MINUTES || '2880', 10),
  startDayOfWeek: parseInt(process.env.VOTING_START_DAY_OF_WEEK || '1', 10),
  startHour: parseInt(process.env.VOTING_START_HOUR_UTC || '0', 10),
  immediateStartDelaySeconds: parseInt(process.env.VOTING_IMMEDIATE_START_DELAY_SECONDS || '5', 10),
};

let state: VotingRuntimeConfigState = {
  config: sanitizeConfig(DEFAULT_CONFIG),
  updatedAt: new Date().toISOString(),
};

function sanitizeConfig(input: VotingRuntimeConfig): VotingRuntimeConfig {
  const cadence: VotingCadence = ['immediate', 'daily', 'weekly'].includes(input.cadence)
    ? input.cadence
    : 'weekly';

  const agentVotingDurationHours = clampNumber(input.agentVotingDurationHours, 1, 24 * 30, 24);
  const humanVotingDurationHours = clampNumber(input.humanVotingDurationHours, 1, 24 * 14, 48);
  const agentVotingDurationMinutes = clampNumber(
    input.agentVotingDurationMinutes,
    1,
    24 * 60 * 30,
    agentVotingDurationHours * 60
  );
  const humanVotingDurationMinutes = clampNumber(
    input.humanVotingDurationMinutes,
    1,
    24 * 60 * 14,
    humanVotingDurationHours * 60
  );
  const startDayOfWeek = clampNumber(input.startDayOfWeek, 0, 6, 1);
  const startHour = clampNumber(input.startHour, 0, 23, 0);
  const immediateStartDelaySeconds = clampNumber(input.immediateStartDelaySeconds, 0, 300, 5);

  return {
    cadence,
    agentVotingDurationHours,
    humanVotingDurationHours,
    agentVotingDurationMinutes,
    humanVotingDurationMinutes,
    startDayOfWeek,
    startHour,
    immediateStartDelaySeconds,
  };
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const n = Math.trunc(value);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function getVotingRuntimeConfigState(): VotingRuntimeConfigState {
  return {
    config: { ...state.config },
    updatedAt: state.updatedAt,
  };
}

export function getVotingRuntimeConfig(): VotingRuntimeConfig {
  return { ...state.config };
}

export function updateVotingRuntimeConfig(
  patch: VotingRuntimeConfigUpdate,
  actor: string = 'unknown'
): VotingRuntimeConfigState {
  const next = sanitizeConfig({ ...state.config, ...patch });

  console.log('[VotingConfig] Updating runtime voting config', {
    actor,
    from: state.config,
    to: next,
  });

  state = {
    config: next,
    updatedAt: new Date().toISOString(),
  };

  return getVotingRuntimeConfigState();
}
