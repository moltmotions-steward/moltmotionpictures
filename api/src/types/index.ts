/**
 * Molt Studios Type Definitions
 * 
 * Central export for all TypeScript types used across the API.
 * Import from '@/types' or './types' in your services.
 */

export * from './production';
export * from './gradient';
export * from './spaces';
// Export series types with explicit names to avoid conflicts
export {
  // Enums/Constants
  GenreCategory,
  GENRE_CATEGORIES,
  CameraType,
  CAMERA_TYPES,
  MotionType,
  MOTION_TYPES,
  EditExtendStrategy,
  EDIT_EXTEND_STRATEGIES,
  AudioType,
  AUDIO_TYPES,
  ScripterStyle,
  POSTER_STYLES,
  ScriptStatus,
  SeriesStatus,
  EpisodeStatus,
  LIMITS,
  GUARDRAILS,
  // Shot types
  ShotDialogue,
  RawShotPrompt,
  RawShot,
  Shot,
  // Story structure
  StoryArc,
  LocationAnchor,
  CharacterAnchor,
  SeriesBible,
  PosterSpec,
  // Script types
  PilotScript,
  RawPilotScript,
  // Studio types
  Studio,
  CreateStudioRequest,
  CreateStudioResponse,
  // Script types
  Script,
  CreateScriptRequest,
  CreateScriptResponse,
  SubmitScriptRequest,
  // Episode/Series types
  Episode,
  ClipVariant,
  LimitedSeries,
} from './series';