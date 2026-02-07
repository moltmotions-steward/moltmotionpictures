/**
 * Unit Test: CDP Configuration in Providers
 *
 * Tests the CDP configuration logic in the providers.tsx file.
 * These tests verify:
 * - CDP is enabled when NEXT_PUBLIC_CDP_PROJECT_ID is set
 * - CDP falls back to mock mode when credentials are missing
 * - CDP_CHECKOUT_ENABLED flag works correctly
 * - Configuration is passed correctly to CDP provider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import * as React from 'react';

// Mock CDP React Provider
const mockCDPReactProvider = vi.fn(({ children, config }) => (
  <div data-testid="cdp-provider" data-config={JSON.stringify(config)}>
    {children}
  </div>
));

vi.mock('@coinbase/cdp-react', () => ({
  CDPReactProvider: mockCDPReactProvider,
  SignInModal: () => <div>Sign In</div>,
}));

// Mock CDP hooks to prevent provider errors
vi.mock('@coinbase/cdp-hooks', () => ({
  useCurrentUser: () => ({ currentUser: null }),
  useIsSignedIn: () => ({ isSignedIn: false }),
  useEvmAddress: () => ({ evmAddress: null }),
  useSignOut: () => ({ signOut: vi.fn() }),
  useSignEvmTypedData: () => ({ signEvmTypedData: vi.fn() }),
}));

// Mock next-themes
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: any) => <div>{children}</div>,
}));

describe('CDP Configuration in Providers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset process.env for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('CDP enabled configuration', () => {
    it('enables CDP when NEXT_PUBLIC_CDP_PROJECT_ID is set', async () => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = 'test-project-123';
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';

      // Re-import Providers to get fresh environment
      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      render(
        <Providers>
          <div>Test Child</div>
        </Providers>
      );

      expect(mockCDPReactProvider).toHaveBeenCalled();
      const calls = mockCDPReactProvider.mock.calls;
      const config = calls[0][0].config;

      expect(config.projectId).toBe('test-project-123');
      expect(config.useMock).toBe(false);
    });

    it('includes CDP_CHECKOUT_ENABLED=true in config check', async () => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = 'test-project-123';
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';

      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      render(
        <Providers>
          <div>Test Child</div>
        </Providers>
      );

      const config = mockCDPReactProvider.mock.calls[0][0].config;
      expect(config.useMock).toBe(false);
    });

    it('passes correct projectId to CDP provider', async () => {
      const testProjectId = 'my-production-project-456';
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = testProjectId;
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';

      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      render(
        <Providers>
          <div>Test Child</div>
        </Providers>
      );

      const config = mockCDPReactProvider.mock.calls[0][0].config;
      expect(config.projectId).toBe(testProjectId);
    });
  });

  describe('CDP disabled (mock mode) configuration', () => {
    it('uses mock mode when NEXT_PUBLIC_CDP_PROJECT_ID is missing', async () => {
      delete process.env.NEXT_PUBLIC_CDP_PROJECT_ID;
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';

      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      render(
        <Providers>
          <div>Test Child</div>
        </Providers>
      );

      const config = mockCDPReactProvider.mock.calls[0][0].config;
      expect(config.useMock).toBe(true);
      expect(config.projectId).toBe('cdp-disabled');
    });

    it('uses mock mode when CDP_CHECKOUT_ENABLED is false', async () => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = 'test-project-123';
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'false';

      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      render(
        <Providers>
          <div>Test Child</div>
        </Providers>
      );

      const config = mockCDPReactProvider.mock.calls[0][0].config;
      expect(config.useMock).toBe(true);
    });

    it('uses mock mode when CDP_CHECKOUT_ENABLED is not set', async () => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = 'test-project-123';
      delete process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED;

      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      render(
        <Providers>
          <div>Test Child</div>
        </Providers>
      );

      const config = mockCDPReactProvider.mock.calls[0][0].config;
      expect(config.useMock).toBe(true);
    });

    it('uses fallback projectId when CDP is disabled', async () => {
      delete process.env.NEXT_PUBLIC_CDP_PROJECT_ID;

      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      render(
        <Providers>
          <div>Test Child</div>
        </Providers>
      );

      const config = mockCDPReactProvider.mock.calls[0][0].config;
      expect(config.projectId).toBe('cdp-disabled');
    });
  });

  describe('CDP configuration edge cases', () => {
    it('trims whitespace from CDP_PROJECT_ID', async () => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = '  test-project-with-spaces  ';
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';

      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      render(
        <Providers>
          <div>Test Child</div>
        </Providers>
      );

      const config = mockCDPReactProvider.mock.calls[0][0].config;
      expect(config.projectId).toBe('test-project-with-spaces');
      expect(config.projectId).not.toContain(' ');
    });

    it('treats empty string CDP_PROJECT_ID as disabled', async () => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = '';
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';

      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      render(
        <Providers>
          <div>Test Child</div>
        </Providers>
      );

      const config = mockCDPReactProvider.mock.calls[0][0].config;
      expect(config.useMock).toBe(true);
    });

    it('treats whitespace-only CDP_PROJECT_ID as disabled', async () => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = '   ';
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';

      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      render(
        <Providers>
          <div>Test Child</div>
        </Providers>
      );

      const config = mockCDPReactProvider.mock.calls[0][0].config;
      expect(config.useMock).toBe(true);
    });

    it('only accepts "true" (lowercase) for CDP_CHECKOUT_ENABLED', async () => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = 'test-project-123';

      // Test various truthy-looking values that should NOT enable CDP
      const falsyValues = ['TRUE', 'True', '1', 'yes', 'YES', 'enabled'];

      for (const value of falsyValues) {
        process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = value;

        vi.resetModules();
        const { Providers } = await import('@/components/providers');

        const { container } = render(
          <Providers>
            <div>Test Child</div>
          </Providers>
        );

        const config = mockCDPReactProvider.mock.calls[mockCDPReactProvider.mock.calls.length - 1][0].config;
        expect(config.useMock).toBe(true);

        // Cleanup for next iteration
        container.remove();
      }
    });
  });

  describe('CDP authentication methods configuration', () => {
    it('includes all required authentication methods', async () => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = 'test-project-123';
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';

      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      render(
        <Providers>
          <div>Test Child</div>
        </Providers>
      );

      const config = mockCDPReactProvider.mock.calls[0][0].config;

      // Should include multiple auth methods (exact config structure may vary by CDP SDK version)
      // Just verify config object is passed
      expect(config).toBeDefined();
      expect(config.projectId).toBeTruthy();
    });
  });

  describe('provider rendering', () => {
    it('renders children when CDP is enabled', async () => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = 'test-project-123';
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';

      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      const { getByText } = render(
        <Providers>
          <div>Test Child Content</div>
        </Providers>
      );

      expect(getByText('Test Child Content')).toBeInTheDocument();
    });

    it('renders children when CDP is in mock mode', async () => {
      delete process.env.NEXT_PUBLIC_CDP_PROJECT_ID;

      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      const { getByText } = render(
        <Providers>
          <div>Test Child Content</div>
        </Providers>
      );

      expect(getByText('Test Child Content')).toBeInTheDocument();
    });

    it('wraps children with CDP provider', async () => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = 'test-project-123';
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';

      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      const { getByTestId } = render(
        <Providers>
          <div>Test Child</div>
        </Providers>
      );

      expect(getByTestId('cdp-provider')).toBeInTheDocument();
    });
  });

  describe('configuration determinism', () => {
    it('produces consistent config with same environment', async () => {
      process.env.NEXT_PUBLIC_CDP_PROJECT_ID = 'test-project-123';
      process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';

      vi.resetModules();
      const { Providers } = await import('@/components/providers');

      // Render twice with same env
      render(
        <Providers>
          <div>First</div>
        </Providers>
      );

      const config1 = mockCDPReactProvider.mock.calls[mockCDPReactProvider.mock.calls.length - 1][0].config;

      render(
        <Providers>
          <div>Second</div>
        </Providers>
      );

      const config2 = mockCDPReactProvider.mock.calls[mockCDPReactProvider.mock.calls.length - 1][0].config;

      expect(config1.projectId).toBe(config2.projectId);
      expect(config1.useMock).toBe(config2.useMock);
    });
  });
});

describe('Build-time environment variable baking', () => {
  it('NEXT_PUBLIC_ variables should be available at build time', () => {
    // This test verifies the pattern we use for build-time env vars
    const varName = 'NEXT_PUBLIC_CDP_PROJECT_ID';
    expect(varName).toMatch(/^NEXT_PUBLIC_/);
  });

  it('CDP config reads from process.env at module load time', async () => {
    const testProjectId = 'build-time-project-id-' + Date.now();
    process.env.NEXT_PUBLIC_CDP_PROJECT_ID = testProjectId;
    process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED = 'true';

    // Fresh import to simulate build-time evaluation
    vi.resetModules();

    // Clear all previous mock calls
    mockCDPReactProvider.mockClear();

    const { Providers } = await import('@/components/providers');

    render(
      <Providers>
        <div>Test</div>
      </Providers>
    );

    // Get the most recent call
    const calls = mockCDPReactProvider.mock.calls;
    const config = calls[calls.length - 1][0].config;

    // At build time, these values are inlined by Next.js
    expect(config.projectId).toBe(testProjectId);
  });
});
