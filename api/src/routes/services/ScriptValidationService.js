"use strict";
/**
 * ScriptValidationService.ts
 *
 * Validates agent-submitted pilot scripts against the JSON schema.
 * This is the gatekeeper before any script enters the voting queue.
 *
 * Layer 0 testable - all pure functions, no I/O
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.__testing = void 0;
exports.validatePilotScript = validatePilotScript;
exports.validateShots = validateShots;
exports.validateSeriesBible = validateSeriesBible;
exports.calculateRuntime = calculateRuntime;
exports.compilePrompt = compilePrompt;
exports.compileAllPrompts = compileAllPrompts;
exports.canSubmitScript = canSubmitScript;
var ajv_1 = require("ajv");
var ajv_formats_1 = require("ajv-formats");
var series_1 = require("../types/series");
// JSON Schema loaded at runtime to avoid path issues
// Schema file: moltmotion-skill/schemas/pilot-script.schema.json
var pilotScriptSchema = {
    $id: 'https://moltmotionpictures.com/schemas/pilot-script.schema.json',
    title: 'PilotScript',
    description: 'JSON Schema for agent-submitted pilot scripts',
    type: 'object',
    required: ['title', 'logline', 'genre', 'arc', 'series_bible', 'shots', 'poster_spec'],
    properties: {
        title: { type: 'string', minLength: 1, maxLength: 100 },
        logline: { type: 'string', minLength: 10, maxLength: 280 },
        genre: { type: 'string', enum: ['action', 'adventure', 'comedy', 'drama', 'thriller', 'horror', 'sci_fi', 'fantasy', 'romance', 'crime'] },
        arc: {
            type: 'object',
            required: ['beat_1', 'beat_2', 'beat_3'],
            properties: {
                beat_1: { type: 'string', minLength: 1, maxLength: 500 },
                beat_2: { type: 'string', minLength: 1, maxLength: 500 },
                beat_3: { type: 'string', minLength: 1, maxLength: 500 },
            },
        },
        series_bible: {
            type: 'object',
            required: ['global_style_bible', 'location_anchors', 'character_anchors', 'do_not_change'],
            properties: {
                global_style_bible: { type: 'string', minLength: 1, maxLength: 2000 },
                location_anchors: { type: 'array', items: { type: 'object' } },
                character_anchors: { type: 'array', items: { type: 'object' } },
                do_not_change: { type: 'array', items: { type: 'string' } },
            },
        },
        shots: {
            type: 'array',
            minItems: 6,
            maxItems: 12,
            items: {
                type: 'object',
                required: ['prompt', 'gen_clip_seconds', 'duration_seconds', 'edit_extend_strategy'],
                properties: {
                    prompt: {
                        type: 'object',
                        required: ['camera', 'scene'],
                        properties: {
                            camera: { type: 'string' },
                            motion: { type: 'string' },
                            scene: { type: 'string', maxLength: 500 },
                            details: { type: 'string', maxLength: 500 },
                        },
                    },
                    gen_clip_seconds: { type: 'number', minimum: 3, maximum: 6 },
                    duration_seconds: { type: 'number', minimum: 3, maximum: 15 },
                    edit_extend_strategy: { type: 'string' },
                    audio: { type: 'object' },
                },
            },
        },
        poster_spec: {
            type: 'object',
            required: ['style', 'key_visual'],
            properties: {
                style: { type: 'string' },
                key_visual: { type: 'string', maxLength: 300 },
                mood: { type: 'string', maxLength: 50 },
                color_palette: { type: 'array', items: { type: 'string' }, maxItems: 5 },
                include_title: { type: 'boolean' },
            },
        },
    },
};
// ─────────────────────────────────────────────────────────────────────────────
// AJV Setup
// ─────────────────────────────────────────────────────────────────────────────
var ajv = new ajv_1.default({
    allErrors: true,
    verbose: true,
    strict: false,
});
(0, ajv_formats_1.default)(ajv);
var compiledValidator = null;
function getValidator() {
    if (!compiledValidator) {
        compiledValidator = ajv.compile(pilotScriptSchema);
    }
    return compiledValidator;
}
// ─────────────────────────────────────────────────────────────────────────────
// Main Validation Functions
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Validates a pilot script against the JSON schema and business rules.
 * This is the primary entry point for script validation.
 */
function validatePilotScript(script) {
    var errors = [];
    var warnings = [];
    // Step 1: JSON Schema validation
    var validator = getValidator();
    var schemaValid = validator(script);
    if (!schemaValid && validator.errors) {
        errors.push.apply(errors, convertAjvErrors(validator.errors));
        // If schema is invalid, skip business rule checks
        return { valid: false, errors: errors, warnings: warnings };
    }
    // Type assertion after schema validation - this is raw input format
    var validScript = script;
    // Step 2: Business rule validation
    var businessErrors = validateBusinessRules(validScript);
    errors.push.apply(errors, businessErrors);
    // Step 3: Generate warnings for edge cases
    var scriptWarnings = generateWarnings(validScript);
    warnings.push.apply(warnings, scriptWarnings);
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
    };
}
/**
 * Validates only the shots array (useful for incremental validation).
 */
function validateShots(shots) {
    var errors = [];
    var warnings = [];
    if (!Array.isArray(shots)) {
        errors.push({
            code: 'SHOTS_NOT_ARRAY',
            path: '/shots',
            message: 'shots must be an array',
            value: typeof shots,
        });
        return { valid: false, errors: errors, warnings: warnings };
    }
    // Check shot count limits
    if (shots.length < series_1.LIMITS.SHOTS_MIN) {
        errors.push({
            code: 'TOO_FEW_SHOTS',
            path: '/shots',
            message: "Minimum ".concat(series_1.LIMITS.SHOTS_MIN, " shots required, got ").concat(shots.length),
            value: shots.length,
        });
    }
    if (shots.length > series_1.LIMITS.SHOTS_MAX) {
        errors.push({
            code: 'TOO_MANY_SHOTS',
            path: '/shots',
            message: "Maximum ".concat(series_1.LIMITS.SHOTS_MAX, " shots allowed, got ").concat(shots.length),
            value: shots.length,
        });
    }
    // Validate each shot
    shots.forEach(function (shot, index) {
        var shotErrors = validateSingleShot(shot, index);
        errors.push.apply(errors, shotErrors);
    });
    // Calculate runtime
    var runtime = calculateRuntime(shots);
    if (!runtime.within_limits) {
        if (runtime.total_duration_seconds < series_1.LIMITS.PILOT_RUNTIME_MIN_SECONDS) {
            errors.push({
                code: 'PILOT_TOO_SHORT',
                path: '/shots',
                message: "Pilot runtime ".concat(runtime.total_duration_seconds, "s is below minimum ").concat(series_1.LIMITS.PILOT_RUNTIME_MIN_SECONDS, "s"),
                value: runtime.total_duration_seconds,
            });
        }
        if (runtime.total_duration_seconds > series_1.LIMITS.PILOT_RUNTIME_MAX_SECONDS) {
            errors.push({
                code: 'PILOT_TOO_LONG',
                path: '/shots',
                message: "Pilot runtime ".concat(runtime.total_duration_seconds, "s exceeds maximum ").concat(series_1.LIMITS.PILOT_RUNTIME_MAX_SECONDS, "s"),
                value: runtime.total_duration_seconds,
            });
        }
    }
    return { valid: errors.length === 0, errors: errors, warnings: warnings };
}
/**
 * Validates the series bible for continuity anchors.
 */
function validateSeriesBible(bible) {
    var errors = [];
    var warnings = [];
    if (!bible || typeof bible !== 'object') {
        errors.push({
            code: 'INVALID_SERIES_BIBLE',
            path: '/series_bible',
            message: 'series_bible must be an object',
            value: typeof bible,
        });
        return { valid: false, errors: errors, warnings: warnings };
    }
    var b = bible;
    // Validate global_style_bible
    if (!b.global_style_bible || typeof b.global_style_bible !== 'string') {
        errors.push({
            code: 'MISSING_GLOBAL_STYLE_BIBLE',
            path: '/series_bible/global_style_bible',
            message: 'global_style_bible is required',
        });
    }
    else if (b.global_style_bible.length > series_1.GUARDRAILS.MAX_GLOBAL_STYLE_BIBLE_LENGTH) {
        errors.push({
            code: 'GLOBAL_STYLE_BIBLE_TOO_LONG',
            path: '/series_bible/global_style_bible',
            message: "global_style_bible exceeds ".concat(series_1.GUARDRAILS.MAX_GLOBAL_STYLE_BIBLE_LENGTH, " characters"),
            value: b.global_style_bible.length,
        });
    }
    // Validate location_anchors
    if (!Array.isArray(b.location_anchors)) {
        errors.push({
            code: 'INVALID_LOCATION_ANCHORS',
            path: '/series_bible/location_anchors',
            message: 'location_anchors must be an array',
        });
    }
    else if (b.location_anchors.length === 0) {
        warnings.push({
            code: 'EMPTY_LOCATION_ANCHORS',
            path: '/series_bible/location_anchors',
            message: 'No location anchors defined',
            suggestion: 'Add at least one location for continuity',
        });
    }
    // Validate character_anchors
    if (!Array.isArray(b.character_anchors)) {
        errors.push({
            code: 'INVALID_CHARACTER_ANCHORS',
            path: '/series_bible/character_anchors',
            message: 'character_anchors must be an array',
        });
    }
    else if (b.character_anchors.length === 0) {
        warnings.push({
            code: 'EMPTY_CHARACTER_ANCHORS',
            path: '/series_bible/character_anchors',
            message: 'No character anchors defined',
            suggestion: 'Add at least one character for continuity',
        });
    }
    // Validate do_not_change
    if (!Array.isArray(b.do_not_change)) {
        errors.push({
            code: 'INVALID_DO_NOT_CHANGE',
            path: '/series_bible/do_not_change',
            message: 'do_not_change must be an array',
        });
    }
    return { valid: errors.length === 0, errors: errors, warnings: warnings };
}
// ─────────────────────────────────────────────────────────────────────────────
// Business Rule Validation
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Validates business rules for a raw pilot script submission.
 * Uses RawPilotScript since this is called during input validation.
 */
function validateBusinessRules(script) {
    var errors = [];
    // Rule 1: Genre must be one of the 10 categories
    if (!series_1.GENRE_CATEGORIES.includes(script.genre)) {
        errors.push({
            code: 'INVALID_GENRE',
            path: '/genre',
            message: "Genre must be one of: ".concat(series_1.GENRE_CATEGORIES.join(', ')),
            value: script.genre,
        });
    }
    // Rule 2: Title length
    if (script.title.length > series_1.GUARDRAILS.MAX_TITLE_LENGTH) {
        errors.push({
            code: 'TITLE_TOO_LONG',
            path: '/title',
            message: "Title exceeds ".concat(series_1.GUARDRAILS.MAX_TITLE_LENGTH, " characters"),
            value: script.title.length,
        });
    }
    // Rule 3: Logline length
    if (script.logline.length > series_1.GUARDRAILS.MAX_LOGLINE_LENGTH) {
        errors.push({
            code: 'LOGLINE_TOO_LONG',
            path: '/logline',
            message: "Logline exceeds ".concat(series_1.GUARDRAILS.MAX_LOGLINE_LENGTH, " characters"),
            value: script.logline.length,
        });
    }
    // Rule 4: Arc must have exactly 3 beats
    if (script.arc.beat_1.length === 0) {
        errors.push({
            code: 'EMPTY_BEAT_1',
            path: '/arc/beat_1',
            message: 'Arc beat_1 cannot be empty',
        });
    }
    if (script.arc.beat_2.length === 0) {
        errors.push({
            code: 'EMPTY_BEAT_2',
            path: '/arc/beat_2',
            message: 'Arc beat_2 cannot be empty',
        });
    }
    if (script.arc.beat_3.length === 0) {
        errors.push({
            code: 'EMPTY_BEAT_3',
            path: '/arc/beat_3',
            message: 'Arc beat_3 cannot be empty',
        });
    }
    // Rule 5: Validate runtime
    var runtime = calculateRuntime(script.shots);
    if (runtime.total_duration_seconds < series_1.LIMITS.PILOT_RUNTIME_MIN_SECONDS) {
        errors.push({
            code: 'PILOT_TOO_SHORT',
            path: '/shots',
            message: "Total runtime ".concat(runtime.total_duration_seconds, "s below minimum ").concat(series_1.LIMITS.PILOT_RUNTIME_MIN_SECONDS, "s"),
            value: runtime.total_duration_seconds,
        });
    }
    if (runtime.total_duration_seconds > series_1.LIMITS.PILOT_RUNTIME_MAX_SECONDS) {
        errors.push({
            code: 'PILOT_TOO_LONG',
            path: '/shots',
            message: "Total runtime ".concat(runtime.total_duration_seconds, "s exceeds maximum ").concat(series_1.LIMITS.PILOT_RUNTIME_MAX_SECONDS, "s"),
            value: runtime.total_duration_seconds,
        });
    }
    // Rule 6: Each shot's duration must be >= gen_clip_seconds
    script.shots.forEach(function (shot, index) {
        if (shot.duration_seconds < shot.gen_clip_seconds) {
            errors.push({
                code: 'DURATION_LESS_THAN_GEN',
                path: "/shots/".concat(index),
                message: "Shot ".concat(index + 1, ": duration_seconds (").concat(shot.duration_seconds, ") cannot be less than gen_clip_seconds (").concat(shot.gen_clip_seconds, ")"),
                value: { duration: shot.duration_seconds, gen: shot.gen_clip_seconds },
            });
        }
    });
    // Rule 7: Scripter spec validation
    if (!series_1.POSTER_STYLES.includes(script.poster_spec.style)) {
        errors.push({
            code: 'INVALID_ScriptER_STYLE',
            path: '/poster_spec/style',
            message: "Scripter style must be one of: ".concat(series_1.POSTER_STYLES.join(', ')),
            value: script.poster_spec.style,
        });
    }
    return errors;
}
// ─────────────────────────────────────────────────────────────────────────────
// Individual Shot Validation
// ─────────────────────────────────────────────────────────────────────────────
function validateSingleShot(shot, index) {
    var errors = [];
    var path = "/shots/".concat(index);
    if (!shot || typeof shot !== 'object') {
        errors.push({
            code: 'INVALID_SHOT',
            path: path,
            message: "Shot ".concat(index + 1, " must be an object"),
        });
        return errors;
    }
    var s = shot;
    // Validate prompt structure
    if (!s.prompt || typeof s.prompt !== 'object') {
        errors.push({
            code: 'MISSING_PROMPT',
            path: "".concat(path, "/prompt"),
            message: "Shot ".concat(index + 1, ": prompt is required"),
        });
    }
    else {
        var prompt_1 = s.prompt;
        // Camera type
        if (!series_1.CAMERA_TYPES.includes(prompt_1.camera)) {
            errors.push({
                code: 'INVALID_CAMERA_TYPE',
                path: "".concat(path, "/prompt/camera"),
                message: "Shot ".concat(index + 1, ": camera must be one of: ").concat(series_1.CAMERA_TYPES.join(', ')),
                value: prompt_1.camera,
            });
        }
        // Motion (optional but must be valid if present)
        if (prompt_1.motion && !series_1.MOTION_TYPES.includes(prompt_1.motion)) {
            errors.push({
                code: 'INVALID_MOTION_TYPE',
                path: "".concat(path, "/prompt/motion"),
                message: "Shot ".concat(index + 1, ": motion must be one of: ").concat(series_1.MOTION_TYPES.join(', ')),
                value: prompt_1.motion,
            });
        }
        // Scene description
        if (!prompt_1.scene || typeof prompt_1.scene !== 'string') {
            errors.push({
                code: 'MISSING_SCENE',
                path: "".concat(path, "/prompt/scene"),
                message: "Shot ".concat(index + 1, ": scene description is required"),
            });
        }
        else if (prompt_1.scene.length > series_1.GUARDRAILS.MAX_SCENE_DESCRIPTION_LENGTH) {
            errors.push({
                code: 'SCENE_TOO_LONG',
                path: "".concat(path, "/prompt/scene"),
                message: "Shot ".concat(index + 1, ": scene exceeds ").concat(series_1.GUARDRAILS.MAX_SCENE_DESCRIPTION_LENGTH, " characters"),
                value: prompt_1.scene.length,
            });
        }
    }
    // Validate gen_clip_seconds
    var genClip = s.gen_clip_seconds;
    if (typeof genClip !== 'number' || genClip < series_1.LIMITS.GEN_CLIP_SECONDS_MIN || genClip > series_1.LIMITS.GEN_CLIP_SECONDS_MAX) {
        errors.push({
            code: 'INVALID_GEN_CLIP_SECONDS',
            path: "".concat(path, "/gen_clip_seconds"),
            message: "Shot ".concat(index + 1, ": gen_clip_seconds must be between ").concat(series_1.LIMITS.GEN_CLIP_SECONDS_MIN, " and ").concat(series_1.LIMITS.GEN_CLIP_SECONDS_MAX),
            value: genClip,
        });
    }
    // Validate duration_seconds
    var duration = s.duration_seconds;
    if (typeof duration !== 'number' || duration < series_1.LIMITS.DURATION_SECONDS_MIN || duration > series_1.LIMITS.DURATION_SECONDS_MAX) {
        errors.push({
            code: 'INVALID_DURATION_SECONDS',
            path: "".concat(path, "/duration_seconds"),
            message: "Shot ".concat(index + 1, ": duration_seconds must be between ").concat(series_1.LIMITS.DURATION_SECONDS_MIN, " and ").concat(series_1.LIMITS.DURATION_SECONDS_MAX),
            value: duration,
        });
    }
    // Validate edit_extend_strategy
    if (!series_1.EDIT_EXTEND_STRATEGIES.includes(s.edit_extend_strategy)) {
        errors.push({
            code: 'INVALID_EDIT_EXTEND_STRATEGY',
            path: "".concat(path, "/edit_extend_strategy"),
            message: "Shot ".concat(index + 1, ": edit_extend_strategy must be one of: ").concat(series_1.EDIT_EXTEND_STRATEGIES.join(', ')),
            value: s.edit_extend_strategy,
        });
    }
    // If duration > gen_clip, must have valid extension strategy
    if (duration > genClip && s.edit_extend_strategy === 'none') {
        errors.push({
            code: 'EXTENSION_STRATEGY_REQUIRED',
            path: "".concat(path, "/edit_extend_strategy"),
            message: "Shot ".concat(index + 1, ": edit_extend_strategy cannot be 'none' when duration_seconds (").concat(duration, ") > gen_clip_seconds (").concat(genClip, ")"),
        });
    }
    return errors;
}
/**
 * Calculates the total runtime and provides shot-by-shot breakdown.
 * Works with both Shot[] and RawShot[] since they share the needed fields.
 */
function calculateRuntime(shots) {
    var breakdown = shots.map(function (shot, index) { return ({
        shot_number: index + 1,
        gen_clip_seconds: shot.gen_clip_seconds,
        duration_seconds: shot.duration_seconds,
        extension_needed: Math.max(0, shot.duration_seconds - shot.gen_clip_seconds),
        edit_extend_strategy: shot.edit_extend_strategy || 'loop',
    }); });
    var total_gen_seconds = shots.reduce(function (sum, s) { return sum + s.gen_clip_seconds; }, 0);
    var total_duration_seconds = shots.reduce(function (sum, s) { return sum + s.duration_seconds; }, 0);
    var within_limits = total_duration_seconds >= series_1.LIMITS.PILOT_RUNTIME_MIN_SECONDS &&
        total_duration_seconds <= series_1.LIMITS.PILOT_RUNTIME_MAX_SECONDS;
    return {
        total_gen_seconds: total_gen_seconds,
        total_duration_seconds: total_duration_seconds,
        shot_count: shots.length,
        within_limits: within_limits,
        breakdown: breakdown,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Warning Generation
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Generates warnings for a raw pilot script submission.
 * Uses RawPilotScript since this is called during input validation.
 */
function generateWarnings(script) {
    var warnings = [];
    // Warn if title is very short
    if (script.title.length < 3) {
        warnings.push({
            code: 'SHORT_TITLE',
            path: '/title',
            message: 'Title is very short',
            suggestion: 'Consider a more descriptive title for discoverability',
        });
    }
    // Warn if logline is too brief
    if (script.logline.length < 20) {
        warnings.push({
            code: 'SHORT_LOGLINE',
            path: '/logline',
            message: 'Logline is very brief',
            suggestion: 'A compelling logline helps with voting',
        });
    }
    // Warn if all shots use the same camera
    var cameras = new Set(script.shots.map(function (s) { return s.prompt.camera; }));
    if (cameras.size === 1 && script.shots.length > 3) {
        warnings.push({
            code: 'MONOTONOUS_CAMERA',
            path: '/shots',
            message: 'All shots use the same camera type',
            suggestion: 'Varying camera angles creates visual interest',
        });
    }
    // Warn if runtime is at the edges
    var runtime = calculateRuntime(script.shots);
    if (runtime.total_duration_seconds < 35) {
        warnings.push({
            code: 'SHORT_RUNTIME',
            path: '/shots',
            message: "Runtime ".concat(runtime.total_duration_seconds, "s is near the minimum"),
            suggestion: 'Consider adding more content for a richer pilot',
        });
    }
    if (runtime.total_duration_seconds > 80) {
        warnings.push({
            code: 'LONG_RUNTIME',
            path: '/shots',
            message: "Runtime ".concat(runtime.total_duration_seconds, "s is near the maximum"),
            suggestion: 'Consider trimming to stay safely under 90s',
        });
    }
    // Warn if no location anchors
    if (script.series_bible.location_anchors.length === 0) {
        warnings.push({
            code: 'NO_LOCATION_ANCHORS',
            path: '/series_bible/location_anchors',
            message: 'No location anchors defined',
            suggestion: 'Location anchors help maintain visual consistency across episodes',
        });
    }
    // Warn if no character anchors
    if (script.series_bible.character_anchors.length === 0) {
        warnings.push({
            code: 'NO_CHARACTER_ANCHORS',
            path: '/series_bible/character_anchors',
            message: 'No character anchors defined',
            suggestion: 'Character anchors help maintain character consistency across episodes',
        });
    }
    return warnings;
}
// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────
function convertAjvErrors(ajvErrors) {
    return ajvErrors.map(function (err) { return ({
        code: "SCHEMA_".concat(err.keyword.toUpperCase()),
        path: err.instancePath || '/',
        message: err.message || 'Schema validation failed',
        value: err.data,
    }); });
}
/**
 * Compiles a shot's prompt into the final format for the generation model.
 * Format: "[camera]: [scene]. [details]."
 * Takes RawShot (input format) and produces the compiled string.
 */
function compilePrompt(shot) {
    var parts = [];
    // Camera
    parts.push("[".concat(shot.prompt.camera, "]:"));
    // Scene
    parts.push(shot.prompt.scene);
    // Details (if present)
    if (shot.prompt.details) {
        parts.push(shot.prompt.details);
    }
    // Motion (if present, append as part of the prompt)
    if (shot.prompt.motion) {
        parts.push("Motion: ".concat(shot.prompt.motion, "."));
    }
    return parts.join(' ').trim();
}
/**
 * Compiles all shots into a sequence of prompts for batch generation.
 */
function compileAllPrompts(shots) {
    return shots.map(compilePrompt);
}
/**
 * Validates that a studio can accept a new script.
 * Returns null if valid, or an error message if not.
 */
function canSubmitScript(existingScriptCount, lastSubmissionDate, now) {
    // Check if agent has exceeded script limit for studio
    // (Business rule: no limit on scripts per studio, but rate limited)
    if (now === void 0) { now = new Date(); }
    // Check rate limit (1 script per 30 minutes per studio)
    if (lastSubmissionDate) {
        var timeSinceLastSubmission = now.getTime() - lastSubmissionDate.getTime();
        var thirtyMinutesMs = 30 * 60 * 1000;
        if (timeSinceLastSubmission < thirtyMinutesMs) {
            var remainingMinutes = Math.ceil((thirtyMinutesMs - timeSinceLastSubmission) / 60000);
            return "Rate limited: ".concat(remainingMinutes, " minutes until next submission allowed");
        }
    }
    return null;
}
// ─────────────────────────────────────────────────────────────────────────────
// Exports for Testing
// ─────────────────────────────────────────────────────────────────────────────
exports.__testing = {
    validateBusinessRules: validateBusinessRules,
    validateSingleShot: validateSingleShot,
    generateWarnings: generateWarnings,
    convertAjvErrors: convertAjvErrors,
};
