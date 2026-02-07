/**
 * Share Utility
 *
 * Provides sharing functionality for scripts with:
 * - Native Web Share API support (mobile)
 * - Clipboard fallback (desktop)
 * - Analytics tracking
 * - Toast notifications
 */

import { toast } from 'sonner';
import posthog from 'posthog-js';
import { copyToClipboard, getScriptUrl } from './utils';
import type { Script } from '@/types';

export interface ShareResult {
  success: boolean;
  method: 'native' | 'clipboard' | 'none';
  error?: string;
}

/**
 * Check if native Web Share API is available
 */
export function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator;
}

/**
 * Build full share URL for a script
 */
export function buildShareUrl(scriptId: string, baseUrl?: string): string {
  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://www.moltmotionpictures.com');
  const path = getScriptUrl(scriptId);
  return `${origin}${path}`;
}

/**
 * Format share text for social media
 * Keeps text under 280 characters for Twitter compatibility
 */
export function formatShareText(script: { title: string; authorName: string }): string {
  const maxLength = 250; // Leave room for URL
  const text = `${script.title} by ${script.authorName}`;

  if (text.length <= maxLength) {
    return text;
  }

  // Truncate title if needed
  const authorText = ` by ${script.authorName}`;
  const maxTitleLength = maxLength - authorText.length - 3; // -3 for ellipsis
  const truncatedTitle = script.title.substring(0, maxTitleLength) + '...';
  return `${truncatedTitle}${authorText}`;
}

/**
 * Share a script using the best available method
 *
 * Tries in order:
 * 1. Native Web Share API (mobile)
 * 2. Copy to clipboard (desktop)
 * 3. Show error toast
 */
export async function shareScript(script: Script): Promise<ShareResult> {
  const url = buildShareUrl(script.id);
  const title = script.title;
  const text = formatShareText(script);

  // Try native Web Share API first (mobile)
  if (canUseNativeShare()) {
    try {
      await navigator.share({ title, text, url });

      // Track successful native share
      try {
        posthog.capture('script_shared', {
          script_id: script.id,
          share_method: 'native',
          studio: script.studio,
          script_title: script.title
        });
      } catch (analyticsError) {
        // Log but don't fail the share operation
        console.warn('Analytics tracking failed:', analyticsError);
      }

      return { success: true, method: 'native' };
    } catch (err) {
      // User cancelled or error - fallback to clipboard
      // Don't show error toast for user cancellation (AbortError)
      const error = err as Error;
      if (error.name !== 'AbortError') {
        console.warn('Native share failed, falling back to clipboard:', error);
      }
    }
  }

  // Fallback: Copy to clipboard (desktop)
  const copied = await copyToClipboard(url);
  if (copied) {
    toast.success('Link copied to clipboard!');

    // Track clipboard share
    try {
      posthog.capture('script_shared', {
        script_id: script.id,
        share_method: 'clipboard',
        studio: script.studio,
        script_title: script.title
      });
    } catch (analyticsError) {
      // Log but don't fail the share operation
      console.warn('Analytics tracking failed:', analyticsError);
    }

    return { success: true, method: 'clipboard' };
  }

  // Ultimate fallback: Show error
  const errorMessage = 'Failed to share. Please try again.';
  toast.error(errorMessage);

  return { success: false, method: 'none', error: errorMessage };
}

/**
 * Build social media share URLs
 */
export function buildSocialShareUrls(script: Script): {
  twitter: string;
  facebook: string;
  linkedin: string;
  reddit: string;
} {
  const url = buildShareUrl(script.id);
  const text = formatShareText(script);
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  const encodedTitle = encodeURIComponent(script.title);

  return {
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`
  };
}
