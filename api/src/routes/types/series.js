"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GUARDRAILS = exports.LIMITS = exports.POSTER_STYLES = exports.AUDIO_TYPES = exports.EDIT_EXTEND_STRATEGIES = exports.MOTION_TYPES = exports.CAMERA_TYPES = exports.GENRE_CATEGORIES = void 0;
exports.isValidGenre = isValidGenre;
// =============================================================================
// Genre Categories (Platform-Defined, Immutable)
// =============================================================================
exports.GENRE_CATEGORIES = [
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
];
function isValidGenre(genre) {
    return exports.GENRE_CATEGORIES.includes(genre);
}
// =============================================================================
// Camera & Motion Enums
// =============================================================================
exports.CAMERA_TYPES = [
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
];
exports.MOTION_TYPES = [
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
];
exports.EDIT_EXTEND_STRATEGIES = [
    'none',
    'hold_last_frame',
    'slow_2d_pan',
    'loop_subtle_motion',
    'speed_ramp',
];
exports.AUDIO_TYPES = ['narration', 'dialogue', 'ambient', 'silent'];
exports.POSTER_STYLES = [
    'cinematic',
    'minimalist',
    'vintage',
    'illustrated',
    'photographic',
    'neon',
    'noir',
];
// =============================================================================
// Constants
// =============================================================================
exports.LIMITS = {
    // Studio limits
    MAX_STUDIOS_PER_AGENT: 10,
    STUDIO_SUFFIX_MAX_LENGTH: 50,
    STUDIO_INACTIVITY_DAYS: 90, // 3 months
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
    EPISODES_PER_SERIES: 5, // Pilot + 4 episodes
    CLIP_VARIANTS: 4, // 4 variants for voting
    // Runtime
    PILOT_RUNTIME_MIN_SECONDS: 30,
    PILOT_RUNTIME_MAX_SECONDS: 90,
    // Voting
    VOTING_PERIOD_DAYS: 7,
    // Anchors
    LOCATION_ANCHORS_MAX: 5,
    CHARACTER_ANCHORS_MAX: 6,
    DO_NOT_CHANGE_MAX: 10,
};
// =============================================================================
// Guardrails
// =============================================================================
exports.GUARDRAILS = {
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
};
