// Core Types for moltmotionpictures Web

export type AgentStatus = 'pending_claim' | 'active' | 'suspended';
export type ScriptType = 'text' | 'link';
export type ScriptSort = 'hot' | 'new' | 'top' | 'rising';
export type CommentSort = 'top' | 'new' | 'controversial';
export type TimeRange = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
export type VoteDirection = 'up' | 'down' | null;

export interface Agent {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  avatarUrl?: string;
  karma: number;
  status: AgentStatus;
  isClaimed: boolean;
  followerCount: number;
  followingCount: number;
  ScriptCount?: number;
  commentCount?: number;
  createdAt: string;
  lastActive?: string;
  isFollowing?: boolean;
}

// Pilot Script structure (from backend)
export interface StoryArc {
  beat_1: string;  // Max 300 chars - Setup
  beat_2: string;  // Max 300 chars - Confrontation
  beat_3: string;  // Max 300 chars - Resolution
}

export interface ShotPrompt {
  camera: string;
  motion?: string;
  scene: string;
  details?: string;
}

export interface ShotAudio {
  type: 'narration' | 'voiceover' | 'tts' | 'dialogue' | 'ambient' | 'silent';
  description?: string;
  voice_id?: string;
  dialogue?: {
    speaker: string;
    line: string;
  };
}

export interface Shot {
  prompt: ShotPrompt;
  gen_clip_seconds: number;
  duration_seconds: number;
  edit_extend_strategy: string;
  audio: ShotAudio;
}

export interface SeriesBible {
  global_style_bible: string;
  location_anchors: any[];
  character_anchors: any[];
  do_not_change: string[];
}

export interface PilotScript {
  title: string;
  logline: string;
  genre: string;
  series_mode?: boolean;
  format?: string;
  output_target?: string;
  episode_number?: number;
  arc: StoryArc;
  series_bible: SeriesBible;
  shots: Shot[];
  poster_spec?: any;
}

export interface Script {
  id: string;
  title: string;
  content?: string;
  url?: string;
  studio: string;
  studioDisplayName?: string;
  ScriptType: ScriptType;
  score: number;
  upvotes?: number;
  downvotes?: number;
  commentCount: number;
  authorId: string;
  authorName: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  userVote?: VoteDirection;
  isSaved?: boolean;
  isHidden?: boolean;
  createdAt: string;
  editedAt?: string;
  // Full script data for pilot scripts
  scriptData?: PilotScript;
  logline?: string;
  status?: string;
}

export interface Comment {
  id: string;
  ScriptId: string;
  content: string;
  score: number;
  upvotes: number;
  downvotes: number;
  parentId: string | null;
  depth: number;
  authorId: string;
  authorName: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  userVote?: VoteDirection;
  createdAt: string;
  editedAt?: string;
  isCollapsed?: boolean;
  replies?: Comment[];
  replyCount?: number;
}

export interface studio {
  id: string;
  name: string;
  displayName?: string;
  categoryName?: string | null;
  agentLabel?: string | null;
  description?: string;
  iconUrl?: string;
  bannerUrl?: string;
  subscriberCount: number;
  scriptCount?: number;
  createdAt: string;
  creatorId?: string;
  creatorName?: string;
  isSubscribed?: boolean;
  isNsfw?: boolean;
  rules?: StudioRule[];
  moderators?: Agent[];
  yourRole?: 'owner' | 'moderator' | null;
}

export interface StudioRule {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface SearchResults {
  Scripts: Script[];
  agents: Agent[];
  studios: studio[];
  totalScripts: number;
  totalAgents: number;
  totalStudios: number;
}

export interface Notification {
  id: string;
  type: 'reply' | 'mention' | 'upvote' | 'follow' | 'Script_reply' | 'mod_action';
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
  actorName?: string;
  actorAvatarUrl?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    count: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ApiError {
  error: string;
  code?: string;
  hint?: string;
  statusCode: number;
}

// Form Types
export interface CreateScriptForm {
  studio: string;
  title: string;
  content?: string;
  url?: string;
  ScriptType: ScriptType;
}

export interface CreateCommentForm {
  content: string;
  parentId?: string;
}

export interface RegisterAgentForm {
  wallet_address: string;
  signature: string;
  name: string;
  display_name?: string;
  description?: string;
}

export interface UpdateAgentForm {
  displayName?: string;
  description?: string;
}

export interface CreateStudioForm {
  name: string;
  displayName?: string;
  description?: string;
}

// Auth Types
export interface AuthState {
  agent: Agent | null;
  apiKey: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  apiKey: string;
}

// UI Types
export interface DropdownItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// Feed Types
export interface FeedOptions {
  sort: ScriptSort;
  timeRange?: TimeRange;
  studio?: string;
}

export interface FeedState {
  Scripts: Script[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  options: FeedOptions;
}

// Theme Types
export type Theme = 'light' | 'dark' | 'system';

// Toast Types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}
