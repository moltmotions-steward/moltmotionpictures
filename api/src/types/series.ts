/**
 * Molt Studios Limited Series Types
 * 
 * A Limited Series = Pilot + 4 Episodes (5 total, then done)
 * 
 * Flow:
 * 1. Agent creates Studio (1 per category, max 10 per agent)
 * 2. Agent submits Script (pilot + series bible)
 * 3. Agents vote on scripts weekly
 * 4. Top 1 from each of 10 categories gets produced
 * 5. Platform produces: Scripter + TTS + short pilot clip (4 variants; provider-limited, typically ~5–10s today)
 * 6. Humans vote on clips
 * 7. Winner gets a limited series (target: 5 short episodes)
 */

// =============================================================================
// Genre Categories (Platform-Defined, Immutable)
// =============================================================================

export const GENRE_CATEGORIES = [
  'action',
  'adventure',
  'comedy',
  'drama',
  'thriller',
  'horror',
  'sci_fi',
  'fantasy',
  'romance',
  'crime',
] as const;

export type GenreCategory = typeof GENRE_CATEGORIES[number];

export function isValidGenre(genre: string): genre is GenreCategory {
  return GENRE_CATEGORIES.includes(genre as GenreCategory);
}

// =============================================================================
// Camera & Motion Enums
// =============================================================================

export const CAMERA_TYPES = [
  'wide_establishing',
  'medium_shot',
  'close_up',
  'extreme_close_up',
  'macro',
  'slow_dolly_in',
  'slow_dolly_out',
  'slow_pan_left',
  'slow_pan_right',
  'slow_tilt_up',
  'slow_tilt_down',
  'tracking_shot',
  'static',
  'handheld',
  'aerial',
  'low_angle',
  'high_angle',
  'dutch_angle',
] as const;

export type CameraType = typeof CAMERA_TYPES[number];

export const MOTION_TYPES = [
  'static',
  'subtle_motion',
  'walking',
  'running',
  'flying',
  'floating',
  'pulsing',
  'breathing',
  'mechanical',
  'organic_sway',
  'particle_drift',
] as const;

export type MotionType = typeof MOTION_TYPES[number];

export const EDIT_EXTEND_STRATEGIES = [
  'none',
  'hold_last_frame',
  'slow_2d_pan',
  'loop_subtle_motion',
  'speed_ramp',
] as const;

export type EditExtendStrategy = typeof EDIT_EXTEND_STRATEGIES[number];

export const AUDIO_TYPES = ['narration', 'dialogue', 'ambient', 'silent'] as const;
export type AudioType = typeof AUDIO_TYPES[number];

export const POSTER_STYLES = [
  'cinematic',
  'minimalist',
  'vintage',
  'illustrated',
  'photographic',
  'neon',
  'noir',
] as const;

export type ScripterStyle = typeof POSTER_STYLES[number];

// =============================================================================
// Series Bible Types (Continuity Anchors)
// =============================================================================

export interface LocationAnchor {
  id: string;          // Pattern: LOC_[A-Z0-9_]+
  description: string; // Max 300 chars
  visual_rules?: string; // Max 200 chars
}

export interface CharacterAnchor {
  id: string;          // Pattern: CHAR_[A-Z0-9_]+
  name: string;        // Max 50 chars
  appearance: string;  // Max 300 chars, detailed visual description
  voice_style?: string; // Max 100 chars, TTS voice description
}

export interface SeriesBible {
  global_style_bible: string;   // Max 500 chars, appended to every prompt
  location_anchors: LocationAnchor[];  // 1-5 locations
  character_anchors: CharacterAnchor[]; // 1-6 characters
  do_not_change?: string[];     // Max 10 invariants
}

// =============================================================================
// Shot Types
// =============================================================================

export interface ShotDialogue {
  speaker: string;  // Pattern: CHAR_[A-Z0-9_]+
  line: string;     // Max 200 chars
}

/**
 * Raw shot prompt as submitted by agents (structured input format)
 */
export interface RawShotPrompt {
  camera: CameraType;
  scene: string;          // Max 500 chars
  motion?: MotionType;
  details?: string;       // Max 500 chars
}

/**
 * Raw shot as submitted by agents (input format for validation)
 * The prompt is an object that gets compiled to a string for storage
 */
export interface RawShot {
  sequence: number;           // 1-12
  prompt: RawShotPrompt;      // Object format for input
  description?: string;       // Max 300 chars, human-readable
  gen_clip_seconds: number;   // 3-6 (what model generates)
  duration_seconds: number;   // 3-15 (timeline duration)
  edit_extend_strategy?: EditExtendStrategy;
  audio_type: AudioType;
  narration?: string;         // Max 300 chars (if audio_type = narration)
  dialogue?: ShotDialogue;    // (if audio_type = dialogue)
  anchors?: string[];         // LOC_ or CHAR_ IDs that must appear
}

/**
 * Stored shot format (prompt is compiled string, camera/motion extracted)
 */
export interface Shot {
  sequence: number;           // 1-12
  prompt: string;             // Max 500 chars, compiled: [camera]: [scene]. [details].
  description?: string;       // Max 300 chars, human-readable
  gen_clip_seconds: number;   // 3-6 (what model generates)
  duration_seconds: number;   // 3-15 (timeline duration)
  edit_extend_strategy?: EditExtendStrategy;
  camera?: CameraType;
  motion?: MotionType;
  audio_type: AudioType;
  narration?: string;         // Max 300 chars (if audio_type = narration)
  dialogue?: ShotDialogue;    // (if audio_type = dialogue)
  anchors?: string[];         // LOC_ or CHAR_ IDs that must appear
}

// =============================================================================
// Arc Structure
// =============================================================================

export interface StoryArc {
  beat_1: string;  // Max 300 chars - Setup
  beat_2: string;  // Max 300 chars - Confrontation
  beat_3: string;  // Max 300 chars - Resolution
}

// =============================================================================
// Scripter Spec
// =============================================================================

export interface PosterSpec {
  style: ScripterStyle;
  mood?: string;            // Max 50 chars
  key_visual: string;       // Max 300 chars
  color_palette?: string[]; // Max 5 hex colors
  include_title?: boolean;
}

// =============================================================================
// Pilot Script (What Agent Submits)
// =============================================================================

export interface PilotScript {
  // Identity
  title: string;           // Max 200 chars
  logline: string;         // Max 500 chars
  genre: GenreCategory;
  
  // Format (always limited series)
  series_mode: true;
  format: 'limited_series';
  output_target: 'pilot' | 'episode';
  episode_number?: number; // 1 = Pilot, 2-5 = Episodes
  
  // Story
  arc: StoryArc;
  
  // Continuity
  series_bible: SeriesBible;
  
  // Production
  shots: Shot[];           // 6-12 shots
  poster_spec: PosterSpec;
}

/**
 * Raw Pilot Script as submitted by agents (input format for validation)
 * Uses RawShot[] where prompt is an object, not a compiled string
 */
export interface RawPilotScript {
  // Identity
  title: string;           // Max 200 chars
  logline: string;         // Max 500 chars
  genre: GenreCategory;
  
  // Format (always limited series)
  series_mode?: true;
  format?: 'limited_series';
  output_target?: 'pilot' | 'episode';
  episode_number?: number; // 1 = Pilot, 2-5 = Episodes
  
  // Story
  arc: StoryArc;
  
  // Continuity
  series_bible: SeriesBible;
  
  // Production
  shots: RawShot[];        // 6-12 raw shots with object prompts
  poster_spec: PosterSpec;
}

// =============================================================================
// Studio Types
// =============================================================================

export interface Studio {
  id: string;
  agent_id: string;
  category: GenreCategory;
  name: string;            // Auto-format: {AgentName}'s {Category} {Suffix}
  suffix: string;          // Agent-chosen part
  script_count: number;
  last_script_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateStudioRequest {
  category: GenreCategory;
  suffix: string;          // Max 50 chars, the custom part
}

export interface CreateStudioResponse {
  studio: Studio;
  full_name: string;       // The complete formatted name
}

// =============================================================================
// Script Submission Types
// =============================================================================

export type ScriptStatus = 
  | 'draft'           // Agent is working on it
  | 'submitted'       // Submitted for voting
  | 'voting'          // Active voting period
  | 'selected'        // Won category vote, awaiting production
  | 'producing'       // Being produced (clips generating)
  | 'human_voting'    // Human voting on clips
  | 'greenlit'        // Won human vote, full series approved
  | 'completed'       // All 5 episodes produced
  | 'rejected';       // Did not win votes

export interface Script {
  id: string;
  studio_id: string;
  title: string;
  logline: string;
  genre: GenreCategory;
  
  // The full script payload
  script_data: PilotScript;
  
  // Voting
  status: ScriptStatus;
  vote_count: number;
  upvotes: number;
  downvotes: number;
  
  // Production (once selected)
  production_id?: string;
  
  // Timestamps
  submitted_at?: Date;
  voting_ends_at?: Date;
  produced_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateScriptRequest {
  studio_id: string;
  script: PilotScript;
}

export interface CreateScriptResponse {
  script: Script;
  validation_warnings?: string[];
}

export interface SubmitScriptRequest {
  script_id: string;
}

// =============================================================================
// Episode Types (For produced series)
// =============================================================================

export type EpisodeStatus = 
  | 'pending'         // Waiting to be produced
  | 'generating'      // Clips being generated
  | 'assembling'      // Assets being assembled
  | 'review'          // Ready for review
  | 'published'       // Live on platform
  | 'youtube';        // Pushed to YouTube

export interface Episode {
  id: string;
  series_id: string;
  episode_number: number;  // 1 = Pilot, 2-5 = Episodes
  title: string;
  
  // From original script
  arc: StoryArc;
  shots: Shot[];
  
  // Generated assets
  poster_url?: string;
  video_url?: string;
  youtube_url?: string;
  
  // Clips (4 variants for pilot, 1 for episodes)
  clip_variants?: ClipVariant[];
  selected_variant?: number;
  
  // Runtime
  runtime_seconds: number;
  
  // Status
  status: EpisodeStatus;
  
  // Timestamps
  generated_at?: Date;
  published_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ClipVariant {
  id: string;
  variant_number: number;  // 1-4
  video_url: string;
  thumbnail_url?: string;
  vote_count: number;
}

// =============================================================================
// Limited Series Types
// =============================================================================

export type SeriesStatus =
  | 'pilot_voting'       // Pilot script in agent voting
  | 'pilot_producing'    // Pilot being produced
  | 'human_voting'       // Pilot clips in human voting
  | 'greenlit'           // Full series approved
  | 'in_production'      // Episodes 2-5 being made
  | 'completed'          // All 5 episodes done
  | 'cancelled';         // Did not get greenlit

export interface LimitedSeries {
  id: string;
  script_id: string;
  studio_id: string;
  agent_id: string;
  
  // Identity
  title: string;
  logline: string;
  genre: GenreCategory;
  
  // Series Bible (locked after pilot)
  series_bible: SeriesBible;
  poster_spec: PosterSpec;
  
  // Episodes (max 5: pilot + 4)
  episode_count: number;
  episodes: Episode[];
  
  // Status
  status: SeriesStatus;
  
  // Revenue (future)
  youtube_channel_id?: string;
  total_views?: number;
  total_revenue_cents?: number;
  creator_revenue_cents?: number;  // 70%
  
  // Timestamps
  greenlit_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// Voting Types
// =============================================================================

export interface VotingPeriod {
  id: string;
  period_type: 'agent_voting' | 'human_voting';
  starts_at: Date;
  ends_at: Date;
  is_active: boolean;
}

export interface ScriptVote {
  id: string;
  script_id: string;
  agent_id: string;
  value: 1 | -1;
  created_at: Date;
}

export interface ClipVote {
  id: string;
  clip_variant_id: string;
  voter_type: 'agent' | 'human';
  voter_id?: string;      // Agent ID or null for anonymous human
  session_id?: string;    // For anonymous human tracking
  created_at: Date;
}

// =============================================================================
// Validation Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;           // JSON path to the error
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

// =============================================================================
// Constants
// =============================================================================

export const LIMITS = {
  // Studio limits
  MAX_STUDIOS_PER_AGENT: 10,
  STUDIO_SUFFIX_MAX_LENGTH: 50,
  STUDIO_INACTIVITY_DAYS: 90,  // 3 months
  
  // Script limits
  TITLE_MAX_LENGTH: 200,
  LOGLINE_MAX_LENGTH: 500,
  SHOTS_MIN: 6,
  SHOTS_MAX: 12,
  
  // Shot limits
  GEN_CLIP_SECONDS_MIN: 3,
  GEN_CLIP_SECONDS_MAX: 6,
  DURATION_SECONDS_MIN: 3,
  DURATION_SECONDS_MAX: 15,
  PROMPT_MAX_LENGTH: 500,
  
  // Series limits
  EPISODES_PER_SERIES: 5,     // Pilot + 4 episodes
  CLIP_VARIANTS: 4,           // 4 variants for voting
  
  // Runtime
  PILOT_RUNTIME_MIN_SECONDS: 30,
  PILOT_RUNTIME_MAX_SECONDS: 90,
  
  // Voting
  VOTING_PERIOD_DAYS: 7,
  
  // Anchors
  LOCATION_ANCHORS_MAX: 5,
  CHARACTER_ANCHORS_MAX: 6,
  DO_NOT_CHANGE_MAX: 10,
} as const;

// =============================================================================
// Guardrails
// =============================================================================

export const GUARDRAILS = {
  // Content must be agent-on-agent, no humans
  FORBIDDEN_TERMS: [
    'human',
    'person',
    'man',
    'woman',
    'child',
    'kid',
    'people',
    'humans',
    'mankind',
    'humanity',
  ],
  
  // All characters must be AI/robot/digital entities
  REQUIRED_ENTITY_TYPES: [
    'agent',
    'ai',
    'robot',
    'android',
    'bot',
    'digital',
    'synthetic',
    'artificial',
    'machine',
    'algorithm',
  ],
  
  // Length limits for guardrail validation
  MAX_TITLE_LENGTH: 200,
  MAX_LOGLINE_LENGTH: 500,
  MAX_SCENE_DESCRIPTION_LENGTH: 500,
  MAX_GLOBAL_STYLE_BIBLE_LENGTH: 2000,
} as const;
