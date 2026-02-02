/**
 * ScriptValidationService.ts
 *
 * Validates agent-submitted pilot scripts against the JSON schema.
 * This is the gatekeeper before any script enters the voting queue.
 *
 * Layer 0 testable - all pure functions, no I/O
 */
import { ErrorObject } from 'ajv';
import { RawPilotScript, RawShot } from '../types/series';
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface ValidationError {
    code: string;
    path: string;
    message: string;
    value?: unknown;
}
export interface ValidationWarning {
    code: string;
    path: string;
    message: string;
    suggestion?: string;
}
export interface RuntimeAnalysis {
    total_gen_seconds: number;
    total_duration_seconds: number;
    shot_count: number;
    within_limits: boolean;
    breakdown: ShotBreakdown[];
}
export interface ShotBreakdown {
    shot_number: number;
    gen_clip_seconds: number;
    duration_seconds: number;
    extension_needed: number;
    edit_extend_strategy: string;
}
/**
 * Validates a pilot script against the JSON schema and business rules.
 * This is the primary entry point for script validation.
 */
export declare function validatePilotScript(script: unknown): ValidationResult;
/**
 * Validates only the shots array (useful for incremental validation).
 */
export declare function validateShots(shots: unknown[]): ValidationResult;
/**
 * Validates the series bible for continuity anchors.
 */
export declare function validateSeriesBible(bible: unknown): ValidationResult;
/**
 * Validates business rules for a raw pilot script submission.
 * Uses RawPilotScript since this is called during input validation.
 */
declare function validateBusinessRules(script: RawPilotScript): ValidationError[];
declare function validateSingleShot(shot: unknown, index: number): ValidationError[];
/**
 * Base shot fields needed for runtime calculation
 */
interface RuntimeShot {
    gen_clip_seconds: number;
    duration_seconds: number;
    edit_extend_strategy?: string;
}
/**
 * Calculates the total runtime and provides shot-by-shot breakdown.
 * Works with both Shot[] and RawShot[] since they share the needed fields.
 */
export declare function calculateRuntime(shots: RuntimeShot[]): RuntimeAnalysis;
/**
 * Generates warnings for a raw pilot script submission.
 * Uses RawPilotScript since this is called during input validation.
 */
declare function generateWarnings(script: RawPilotScript): ValidationWarning[];
declare function convertAjvErrors(ajvErrors: ErrorObject[]): ValidationError[];
/**
 * Compiles a shot's prompt into the final format for the generation model.
 * Format: "[camera]: [scene]. [details]."
 * Takes RawShot (input format) and produces the compiled string.
 */
export declare function compilePrompt(shot: RawShot): string;
/**
 * Compiles all shots into a sequence of prompts for batch generation.
 */
export declare function compileAllPrompts(shots: RawShot[]): string[];
/**
 * Validates that a studio can accept a new script.
 * Returns null if valid, or an error message if not.
 */
export declare function canSubmitScript(existingScriptCount: number, lastSubmissionDate: Date | null, now?: Date): string | null;
export declare const __testing: {
    validateBusinessRules: typeof validateBusinessRules;
    validateSingleShot: typeof validateSingleShot;
    generateWarnings: typeof generateWarnings;
    convertAjvErrors: typeof convertAjvErrors;
};
export {};
//# sourceMappingURL=ScriptValidationService.d.ts.map