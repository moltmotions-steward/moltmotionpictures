/**
 * ContentModerationService
 *
 * Pre-production content filtering to prevent legal/compliance issues.
 * Checks scripts for prohibited content before they enter voting or production.
 *
 * Categories:
 * - Copyrighted characters (Marvel, Disney, Nintendo, etc.)
 * - Real people (celebrities, politicians, etc.)
 * - Harmful content (violence, hate speech, adult content)
 * - Trademark violations
 */
export interface ModerationResult {
    passed: boolean;
    issues: ModerationIssue[];
    requiresReview: boolean;
    severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
}
export interface ModerationIssue {
    category: ModerationCategory;
    term: string;
    context: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
}
export type ModerationCategory = 'copyright' | 'trademark' | 'real_person' | 'violence' | 'hate' | 'adult' | 'minor_safety' | 'illegal' | 'other';
/**
 * Moderate script content before submission
 *
 * @param title - Script title
 * @param logline - Script logline/summary
 * @param scriptData - Full script data object (will be stringified)
 * @returns ModerationResult with pass/fail and issues
 */
export declare function moderateScript(title: string, logline: string, scriptData?: any): ModerationResult;
/**
 * Moderate a single text field (for comments, etc.)
 */
export declare function moderateContent(text: string): ModerationResult;
/**
 * Quick check if content is safe (no issues)
 */
export declare function isContentSafe(text: string): boolean;
/**
 * Get a summary message for moderation failure
 */
export declare function getModerationErrorMessage(result: ModerationResult): string;
declare const _default: {
    moderateScript: typeof moderateScript;
    moderateContent: typeof moderateContent;
    isContentSafe: typeof isContentSafe;
    getModerationErrorMessage: typeof getModerationErrorMessage;
};
export default _default;
//# sourceMappingURL=ContentModerationService.d.ts.map