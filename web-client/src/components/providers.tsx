'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { type ThemeProviderProps } from 'next-themes/dist/types';
import { WalletProvider } from '@/components/wallet';

export function Providers({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <WalletProvider>
        {children}
      </WalletProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </NextThemesProvider>
  );
}
