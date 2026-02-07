'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { type ThemeProviderProps } from 'next-themes/dist/types';
import { CDPReactProvider, type Config } from '@coinbase/cdp-react';
import { WalletProvider } from '@/components/wallet';

const CDP_PROJECT_ID = process.env.NEXT_PUBLIC_CDP_PROJECT_ID?.trim() || '1ed4a124-1766-4a60-be12-a88435469ed4';

const CDP_CONFIG: Config = {
  projectId: CDP_PROJECT_ID,
  appName: 'MOLT Studios',
  authMethods: ['email', 'sms', 'oauth:google', 'oauth:apple', 'oauth:x'],
  // CDP is always enabled
  useMock: false,
  disableAnalytics: false,
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
