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

export type ModerationCategory = 
  | 'copyright'      // Copyrighted characters/franchises
  | 'trademark'      // Brand names, logos
  | 'real_person'    // Real celebrities, politicians
  | 'violence'       // Graphic violence
  | 'hate'           // Hate speech, slurs
  | 'adult'          // Sexual/explicit content
  | 'minor_safety'   // Content involving minors
  | 'illegal'        // Illegal activities
  | 'other';

// =============================================================================
// Blocklists
// =============================================================================

/**
 * Copyrighted characters and franchises
 * These would result in immediate legal issues if produced
 */
const COPYRIGHT_TERMS: Array<{ term: string; owner: string; severity: 'high' | 'critical' }> = [
  // Disney/Marvel
  { term: 'spider-man', owner: 'Marvel/Sony', severity: 'critical' },
  { term: 'spiderman', owner: 'Marvel/Sony', severity: 'critical' },
  { term: 'iron man', owner: 'Marvel', severity: 'critical' },
  { term: 'captain america', owner: 'Marvel', severity: 'critical' },
  { term: 'avengers', owner: 'Marvel', severity: 'critical' },
  { term: 'mickey mouse', owner: 'Disney', severity: 'critical' },
  { term: 'elsa', owner: 'Disney', severity: 'high' },
  { term: 'frozen', owner: 'Disney', severity: 'high' },
  { term: 'star wars', owner: 'Lucasfilm/Disney', severity: 'critical' },
  { term: 'darth vader', owner: 'Lucasfilm/Disney', severity: 'critical' },
  { term: 'jedi', owner: 'Lucasfilm/Disney', severity: 'high' },
  { term: 'lightsaber', owner: 'Lucasfilm/Disney', severity: 'high' },
  
  // DC Comics
  { term: 'batman', owner: 'DC/Warner Bros', severity: 'critical' },
  { term: 'superman', owner: 'DC/Warner Bros', severity: 'critical' },
  { term: 'wonder woman', owner: 'DC/Warner Bros', severity: 'critical' },
  { term: 'joker', owner: 'DC/Warner Bros', severity: 'high' },
  
  // Nintendo
  { term: 'mario', owner: 'Nintendo', severity: 'critical' },
  { term: 'pokemon', owner: 'Nintendo', severity: 'critical' },
  { term: 'pikachu', owner: 'Nintendo', severity: 'critical' },
  { term: 'zelda', owner: 'Nintendo', severity: 'critical' },
  { term: 'link', owner: 'Nintendo', severity: 'high' }, // Context-dependent
  
  // Other major franchises
  { term: 'harry potter', owner: 'Warner Bros', severity: 'critical' },
  { term: 'hogwarts', owner: 'Warner Bros', severity: 'critical' },
  { term: 'lord of the rings', owner: 'Warner Bros', severity: 'critical' },
  { term: 'gandalf', owner: 'Warner Bros', severity: 'high' },
  { term: 'spongebob', owner: 'Nickelodeon', severity: 'critical' },
  { term: 'transformers', owner: 'Hasbro', severity: 'critical' },
  { term: 'barbie', owner: 'Mattel', severity: 'critical' },
];

/**
 * Real people - celebrities, politicians, public figures
 * Deepfake/defamation concerns
 */
const REAL_PERSON_TERMS: Array<{ term: string; category: string; severity: 'medium' | 'high' }> = [
  // Politicians (especially high risk)
  { term: 'donald trump', category: 'politician', severity: 'high' },
  { term: 'joe biden', category: 'politician', severity: 'high' },
  { term: 'barack obama', category: 'politician', severity: 'high' },
  { term: 'elon musk', category: 'public_figure', severity: 'high' },
  
  // Celebrities (defamation risk)
  { term: 'taylor swift', category: 'celebrity', severity: 'high' },
  { term: 'beyonce', category: 'celebrity', severity: 'high' },
  { term: 'kanye west', category: 'celebrity', severity: 'high' },
  { term: 'kim kardashian', category: 'celebrity', severity: 'high' },
];

/**
 * Harmful content - violence, hate, adult
 */
const HARMFUL_TERMS: Array<{ term: string; category: ModerationCategory; severity: 'medium' | 'high' | 'critical' }> = [
  // Violence (context-dependent)
  { term: 'mass shooting', category: 'violence', severity: 'critical' },
  { term: 'school shooting', category: 'violence', severity: 'critical' },
  { term: 'terrorist attack', category: 'violence', severity: 'high' },
  { term: 'bomb making', category: 'illegal', severity: 'critical' },
  { term: 'how to kill', category: 'violence', severity: 'critical' },
  
  // Minor safety (zero tolerance)
  { term: 'child porn', category: 'minor_safety', severity: 'critical' },
  { term: 'underage sex', category: 'minor_safety', severity: 'critical' },
  { term: 'minor nude', category: 'minor_safety', severity: 'critical' },
  
  // Hate speech (slurs - abbreviated list)
  { term: 'n-word', category: 'hate', severity: 'high' },
  { term: 'kill all', category: 'hate', severity: 'high' },
  { term: 'genocide', category: 'hate', severity: 'high' },
];

// =============================================================================
// Core Moderation Functions
// =============================================================================

/**
 * Normalize text for matching (lowercase, remove extra spaces)
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Check text against a blocklist
 */
function checkBlocklist<T extends { term: string }>(
  text: string,
  blocklist: T[]
): Array<T & { matchedText: string }> {
  const normalizedText = normalizeText(text);
  const matches: Array<T & { matchedText: string }> = [];
  
  for (const item of blocklist) {
    const normalizedTerm = normalizeText(item.term);
    if (normalizedText.includes(normalizedTerm)) {
      // Find the actual matched text for context
      const regex = new RegExp(item.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const match = text.match(regex);
      matches.push({
        ...item,
        matchedText: match ? match[0] : item.term
      });
    }
  }
  
  return matches;
}

/**
 * Get surrounding context for a match
 */
function getContext(text: string, term: string, windowSize = 50): string {
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const index = lowerText.indexOf(lowerTerm);
  
  if (index === -1) return '';
  
  const start = Math.max(0, index - windowSize);
  const end = Math.min(text.length, index + term.length + windowSize);
  
  let context = text.slice(start, end);
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';
  
  return context;
}

/**
 * Moderate a single text field
 */
function moderateText(text: string): ModerationIssue[] {
  const issues: ModerationIssue[] = [];
  
  // Check copyright
  const copyrightMatches = checkBlocklist(text, COPYRIGHT_TERMS);
  for (const match of copyrightMatches) {
    issues.push({
      category: 'copyright',
      term: match.matchedText,
      context: getContext(text, match.term),
      severity: match.severity,
      message: `Copyrighted character/franchise "${match.term}" (owned by ${match.owner}) detected. Cannot produce content with this IP.`
    });
  }
  
  // Check real people
  const personMatches = checkBlocklist(text, REAL_PERSON_TERMS);
  for (const match of personMatches) {
    issues.push({
      category: 'real_person',
      term: match.matchedText,
      context: getContext(text, match.term),
      severity: match.severity,
      message: `Real person "${match.term}" (${match.category}) detected. Deepfake/defamation risk.`
    });
  }
  
  // Check harmful content
  const harmfulMatches = checkBlocklist(text, HARMFUL_TERMS);
  for (const match of harmfulMatches) {
    issues.push({
      category: match.category,
      term: match.matchedText,
      context: getContext(text, match.term),
      severity: match.severity,
      message: `Prohibited content detected: "${match.term}". Category: ${match.category}.`
    });
  }
  
  return issues;
}

/**
 * Calculate overall severity from issues
 */
function calculateSeverity(issues: ModerationIssue[]): ModerationResult['severity'] {
  if (issues.length === 0) return 'none';
  
  const severities = issues.map(i => i.severity);
  if (severities.includes('critical')) return 'critical';
  if (severities.includes('high')) return 'high';
  if (severities.includes('medium')) return 'medium';
  return 'low';
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Moderate script content before submission
 * 
 * @param title - Script title
 * @param logline - Script logline/summary
 * @param scriptData - Full script data object (will be stringified)
 * @returns ModerationResult with pass/fail and issues
 */
export function moderateScript(
  title: string,
  logline: string,
  scriptData?: any
): ModerationResult {
  const allIssues: ModerationIssue[] = [];
  
  // Moderate title
  const titleIssues = moderateText(title);
  allIssues.push(...titleIssues);
  
  // Moderate logline
  const loglineIssues = moderateText(logline);
  allIssues.push(...loglineIssues);
  
  // Moderate script data (stringify if object)
  if (scriptData) {
    const scriptText = typeof scriptData === 'string' 
      ? scriptData 
      : JSON.stringify(scriptData);
    const scriptIssues = moderateText(scriptText);
    allIssues.push(...scriptIssues);
  }
  
  const severity = calculateSeverity(allIssues);
  
  return {
    passed: allIssues.length === 0,
    issues: allIssues,
    requiresReview: severity === 'medium' || severity === 'low',
    severity
  };
}

/**
 * Moderate a single text field (for comments, etc.)
 */
export function moderateContent(text: string): ModerationResult {
  const issues = moderateText(text);
  const severity = calculateSeverity(issues);
  
  return {
    passed: issues.length === 0,
    issues,
    requiresReview: severity === 'medium' || severity === 'low',
    severity
  };
}

/**
 * Quick check if content is safe (no issues)
 */
export function isContentSafe(text: string): boolean {
  const issues = moderateText(text);
  return issues.length === 0;
}

/**
 * Get a summary message for moderation failure
 */
export function getModerationErrorMessage(result: ModerationResult): string {
  if (result.passed) return '';
  
  const criticalIssues = result.issues.filter(i => i.severity === 'critical');
  const highIssues = result.issues.filter(i => i.severity === 'high');
  
  if (criticalIssues.length > 0) {
    return `Content blocked: ${criticalIssues[0].message}`;
  }
  
  if (highIssues.length > 0) {
    return `Content flagged: ${highIssues[0].message}`;
  }
  
  return `Content requires review: ${result.issues.length} issue(s) found.`;
}

export default {
  moderateScript,
  moderateContent,
  isContentSafe,
  getModerationErrorMessage
};
