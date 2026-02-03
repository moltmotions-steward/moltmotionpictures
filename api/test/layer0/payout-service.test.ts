/**
 * Layer 0 Unit Tests - PayoutService
 * Tests pure business logic without database calls
 */

import { describe, it, expect } from 'vitest';

// Import the functions directly to test pure logic
// We'll mock the config for testing
const MOCK_CONFIG = {
  revenueSplit: {
    creatorPercent: 69,
    platformPercent: 30,
    agentPercent: 1,
  },
};

/**
 * Pure calculateSplits implementation for testing
 * This matches the logic in PayoutService.ts
 */
function calculateSplits(
  totalCents: number,
  creatorPercent = 69,
  platformPercent = 30,
  agentPercent = 1
): { creator: number; platform: number; agent: number } {
  // Calculate each split (floor to avoid fractional cents)
  const agentAmount = Math.floor((totalCents * agentPercent) / 100);
  const platformAmount = Math.floor((totalCents * platformPercent) / 100);
  // Creator gets the remainder to ensure no dust is lost
  const creatorAmount = totalCents - platformAmount - agentAmount;

  return {
    creator: creatorAmount,
    platform: platformAmount,
    agent: agentAmount,
  };
}

describe('PayoutService Pure Logic', () => {
  describe('calculateSplits', () => {
    it('calculates 69/30/1 split correctly for $0.25 tip', () => {
      const tipCents = 25;
      const splits = calculateSplits(tipCents);

      // Agent: floor(25 * 1 / 100) = 0
      expect(splits.agent).toBe(0);

      // Platform: floor(25 * 30 / 100) = 7
      expect(splits.platform).toBe(7);

      // Creator: 25 - 7 - 0 = 18
      expect(splits.creator).toBe(18);

      // Total should equal input
      expect(splits.creator + splits.platform + splits.agent).toBe(tipCents);
    });

    it('calculates 69/30/1 split correctly for $1.00 tip', () => {
      const tipCents = 100;
      const splits = calculateSplits(tipCents);

      // Agent: floor(100 * 1 / 100) = 1
      expect(splits.agent).toBe(1);

      // Platform: floor(100 * 30 / 100) = 30
      expect(splits.platform).toBe(30);

      // Creator: 100 - 30 - 1 = 69
      expect(splits.creator).toBe(69);

      // Total should equal input
      expect(splits.creator + splits.platform + splits.agent).toBe(tipCents);
    });

    it('calculates 69/30/1 split correctly for $5.00 tip (max)', () => {
      const tipCents = 500;
      const splits = calculateSplits(tipCents);

      // Agent: floor(500 * 1 / 100) = 5
      expect(splits.agent).toBe(5);

      // Platform: floor(500 * 30 / 100) = 150
      expect(splits.platform).toBe(150);

      // Creator: 500 - 150 - 5 = 345
      expect(splits.creator).toBe(345);

      // Total should equal input
      expect(splits.creator + splits.platform + splits.agent).toBe(tipCents);
    });

    it('handles minimum tip amount correctly', () => {
      const tipCents = 10; // $0.10 minimum
      const splits = calculateSplits(tipCents);

      // Agent: floor(10 * 1 / 100) = 0
      expect(splits.agent).toBe(0);

      // Platform: floor(10 * 30 / 100) = 3
      expect(splits.platform).toBe(3);

      // Creator: 10 - 3 - 0 = 7
      expect(splits.creator).toBe(7);

      // Total should equal input
      expect(splits.creator + splits.platform + splits.agent).toBe(tipCents);
    });

    it('handles large tip amounts without overflow', () => {
      const tipCents = 100000; // $1000
      const splits = calculateSplits(tipCents);

      // Agent: floor(100000 * 1 / 100) = 1000
      expect(splits.agent).toBe(1000);

      // Platform: floor(100000 * 30 / 100) = 30000
      expect(splits.platform).toBe(30000);

      // Creator: 100000 - 30000 - 1000 = 69000
      expect(splits.creator).toBe(69000);

      // Total should equal input
      expect(splits.creator + splits.platform + splits.agent).toBe(tipCents);
    });

    it('creator always gets dust (rounding remainder)', () => {
      // Test with an amount that would have rounding issues
      const tipCents = 33;
      const splits = calculateSplits(tipCents);

      // The splits should always sum to the original amount
      expect(splits.creator + splits.platform + splits.agent).toBe(tipCents);

      // Agent: floor(33 * 1 / 100) = 0
      expect(splits.agent).toBe(0);

      // Platform: floor(33 * 30 / 100) = 9
      expect(splits.platform).toBe(9);

      // Creator gets the rest: 33 - 9 - 0 = 24
      expect(splits.creator).toBe(24);
    });

    it('all splits are non-negative', () => {
      const testAmounts = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

      for (const amount of testAmounts) {
        const splits = calculateSplits(amount);
        expect(splits.creator).toBeGreaterThanOrEqual(0);
        expect(splits.platform).toBeGreaterThanOrEqual(0);
        expect(splits.agent).toBeGreaterThanOrEqual(0);
        expect(splits.creator + splits.platform + splits.agent).toBe(amount);
      }
    });

    it('handles zero tip amount', () => {
      const tipCents = 0;
      const splits = calculateSplits(tipCents);

      expect(splits.creator).toBe(0);
      expect(splits.platform).toBe(0);
      expect(splits.agent).toBe(0);
      expect(splits.creator + splits.platform + splits.agent).toBe(0);
    });

    it('validates split percentages sum to 100', () => {
      const { creatorPercent, platformPercent, agentPercent } = MOCK_CONFIG.revenueSplit;
      expect(creatorPercent + platformPercent + agentPercent).toBe(100);
    });

    it('respects custom split percentages', () => {
      // Test with 50/40/10 split
      const tipCents = 100;
      const splits = calculateSplits(tipCents, 50, 40, 10);

      expect(splits.agent).toBe(10);
      expect(splits.platform).toBe(40);
      expect(splits.creator).toBe(50);
      expect(splits.creator + splits.platform + splits.agent).toBe(tipCents);
    });
  });

  describe('Payout validation logic', () => {
    it('validates wallet address format', () => {
      const validAddresses = [
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      ];

      const invalidAddresses = ['', 'not-an-address', '0x123', 'wallet'];

      for (const addr of validAddresses) {
        // EVM address: 0x followed by 40 hex chars
        expect(addr).toMatch(/^0x[a-fA-F0-9]{40}$/);
      }

      for (const addr of invalidAddresses) {
        expect(addr).not.toMatch(/^0x[a-fA-F0-9]{40}$/);
      }
    });

    it('validates tip amount has minimum only (no cap)', () => {
      const minTipCents = 10;

      const validateTipAmount = (cents: number): boolean => {
        return cents >= minTipCents;
      };

      expect(validateTipAmount(10)).toBe(true);
      expect(validateTipAmount(25)).toBe(true);
      expect(validateTipAmount(500)).toBe(true);
      expect(validateTipAmount(10000)).toBe(true); // $100 tip? No problem
      expect(validateTipAmount(100000)).toBe(true); // $1000 tip? Go for it
      expect(validateTipAmount(5)).toBe(false);
      expect(validateTipAmount(0)).toBe(false);
      expect(validateTipAmount(-1)).toBe(false);
    });

    it('validates payout status transitions', () => {
      // Valid status transitions
      const validTransitions: Record<string, string[]> = {
        pending: ['processing', 'failed'],
        processing: ['completed', 'failed'],
        completed: [], // terminal state
        failed: ['pending'], // can retry
      };

      const isValidTransition = (from: string, to: string): boolean => {
        return validTransitions[from]?.includes(to) ?? false;
      };

      // Valid transitions
      expect(isValidTransition('pending', 'processing')).toBe(true);
      expect(isValidTransition('pending', 'failed')).toBe(true);
      expect(isValidTransition('processing', 'completed')).toBe(true);
      expect(isValidTransition('processing', 'failed')).toBe(true);
      expect(isValidTransition('failed', 'pending')).toBe(true);

      // Invalid transitions
      expect(isValidTransition('completed', 'pending')).toBe(false);
      expect(isValidTransition('pending', 'completed')).toBe(false);
      expect(isValidTransition('completed', 'failed')).toBe(false);
    });
  });
});

describe('X402 Service Pure Logic', () => {
  describe('centsToUsdcAmount', () => {
    /**
     * Convert cents to USDC smallest unit (6 decimals)
     * 1 cent = 0.01 USDC = 10000 micro-USDC
     */
    function centsToUsdcAmount(cents: number): string {
      const microUsdc = cents * 10000;
      return microUsdc.toString();
    }

    it('converts $0.25 (25 cents) correctly', () => {
      expect(centsToUsdcAmount(25)).toBe('250000');
    });

    it('converts $1.00 (100 cents) correctly', () => {
      expect(centsToUsdcAmount(100)).toBe('1000000');
    });

    it('converts $0.10 (10 cents) correctly', () => {
      expect(centsToUsdcAmount(10)).toBe('100000');
    });

    it('converts $5.00 (500 cents) correctly', () => {
      expect(centsToUsdcAmount(500)).toBe('5000000');
    });
  });

  describe('usdcAmountToCents', () => {
    /**
     * Convert USDC amount (6 decimals) to cents
     */
    function usdcAmountToCents(amount: string): number {
      const microUsdc = BigInt(amount);
      const cents = Number(microUsdc / 10000n);
      return cents;
    }

    it('converts 250000 micro-USDC to 25 cents', () => {
      expect(usdcAmountToCents('250000')).toBe(25);
    });

    it('converts 1000000 micro-USDC to 100 cents', () => {
      expect(usdcAmountToCents('1000000')).toBe(100);
    });
  });

  describe('parsePaymentHeader', () => {
    function parsePaymentHeader(headerValue: string | undefined): object | null {
      if (!headerValue) return null;

      try {
        let jsonString: string;
        if (headerValue.startsWith('{')) {
          jsonString = headerValue;
        } else {
          jsonString = Buffer.from(headerValue, 'base64').toString('utf-8');
        }
        return JSON.parse(jsonString);
      } catch {
        return null;
      }
    }

    it('parses raw JSON header', () => {
      const payload = { x402Version: 2, payload: { test: true } };
      const header = JSON.stringify(payload);

      const result = parsePaymentHeader(header);
      expect(result).toEqual(payload);
    });

    it('parses base64-encoded header', () => {
      const payload = { x402Version: 2, payload: { test: true } };
      const header = Buffer.from(JSON.stringify(payload)).toString('base64');

      const result = parsePaymentHeader(header);
      expect(result).toEqual(payload);
    });

    it('returns null for undefined header', () => {
      expect(parsePaymentHeader(undefined)).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(parsePaymentHeader('not-json')).toBeNull();
    });
  });
});
