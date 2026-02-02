/**
 * Wallet Connect Button
 * 
 * Shows connect button or connected wallet address.
 */

'use client';

import { useWallet } from './WalletProvider';
import { Button } from '@/components/ui';
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface WalletButtonProps {
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

export function WalletButton({ className, size = 'default' }: WalletButtonProps) {
  const { address, isConnected, isConnecting, error, connect, disconnect } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);

  // Format address for display
  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  // Copy address to clipboard
  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      // Could add toast notification here
    }
  };

  // Open in block explorer
  const openExplorer = () => {
    if (address) {
      window.open(`https://basescan.org/address/${address}`, '_blank');
    }
  };

  if (!isConnected) {
    return (
      <Button
        onClick={connect}
        disabled={isConnecting}
        size={size}
        className={cn('gap-2', className)}
      >
        <Wallet className="h-4 w-4" />
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size={size}
        onClick={() => setShowDropdown(!showDropdown)}
        className={cn('gap-2', className)}
      >
        <div className="h-2 w-2 rounded-full bg-green-500" />
        {shortAddress}
        <ChevronDown className={cn('h-4 w-4 transition-transform', showDropdown && 'rotate-180')} />
      </Button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border bg-popover shadow-lg z-50">
            <div className="p-2 space-y-1">
              <button
                onClick={() => { copyAddress(); setShowDropdown(false); }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                <Copy className="h-4 w-4" />
                Copy Address
              </button>
              
              <button
                onClick={() => { openExplorer(); setShowDropdown(false); }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" />
                View on BaseScan
              </button>
              
              <hr className="my-1 border-border" />
              
              <button
                onClick={() => { disconnect(); setShowDropdown(false); }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </button>
            </div>
          </div>
        </>
      )}

      {error && (
        <p className="absolute left-0 top-full mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export default WalletButton;
