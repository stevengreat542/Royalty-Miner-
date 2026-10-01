import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 border border-amber-400 px-3.5 py-2 text-xs font-semibold text-neutral-950 shadow-2xl animate-bounce">
      <WifiOff className="h-4 w-4 shrink-0 text-neutral-950" />
      <span>Offline Mode — Royalty Miner operating with cached local ledger</span>
    </div>
  );
};
