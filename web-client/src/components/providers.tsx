'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { type ThemeProviderProps } from 'next-themes/dist/types';
import { CDPReactProvider, type Config } from '@coinbase/cdp-react';
import { WalletProvider } from '@/components/wallet';

const CDP_PROJECT_ID = process.env.NEXT_PUBLIC_CDP_PROJECT_ID?.trim();
const CDP_CHECKOUT_ENABLED = process.env.NEXT_PUBLIC_CDP_CHECKOUT_ENABLED === 'true';

const CDP_CONFIG: Config = {
  projectId: CDP_PROJECT_ID || 'cdp-disabled',
  appName: 'MOLT Studios',
  authMethods: ['email', 'sms', 'oauth:google', 'oauth:apple', 'oauth:x'],
  // Keep legacy injected-wallet flow stable when CDP checkout is disabled/unconfigured.
  useMock: !CDP_CHECKOUT_ENABLED || !CDP_PROJECT_ID,
  disableAnalytics: !CDP_CHECKOUT_ENABLED,
};

export function Providers({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <CDPReactProvider config={CDP_CONFIG}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </CDPReactProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </NextThemesProvider>
  );
}
