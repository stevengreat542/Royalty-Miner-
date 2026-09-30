import React, { useState } from 'react';
import { Pickaxe, Volume2, VolumeX, ArrowUpRight, Flame, Check, User, LogOut, LogIn } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { formatSats, satsToUsd } from '../utils/crypto';

interface TopBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenWithdraw: () => void;
  onOpenAuth: (mode?: 'login' | 'signup') => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  onOpenWithdraw,
  onOpenAuth,
}) => {
  const {
    balance,
    btcPriceUsd,
    soundEnabled,
    toggleSound,
    dailyLoginStreak,
    isTodayLoginClaimed,
  } = useWallet();

  const { user, userProfile, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);

  const navItems = [
    { id: 'mining', label: 'Proof-of-Work Mining' },
    { id: 'pool-miners', label: 'Pool Leaderboard' },
    { id: 'faucet', label: 'Faucet Drop' },
    { id: 'daily-streak', label: 'Daily Streak' },
    { id: 'quiz', label: 'Satoshi Academy' },
    { id: 'tasks', label: 'Micro-Tasks' },
    { id: 'multiplier', label: 'Multiplier Dice' },
    { id: 'ledger', label: 'Ledger' },
  ];

  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Royalty Miner';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('mining')}
            className="flex items-center gap-2.5 text-left focus:outline-none cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Pickaxe className="h-4 w-4 text-amber-400" />
            </div>
            <span className="text-lg font-bold tracking-tight text-neutral-100 hover:text-amber-400 transition-colors">
              Royalty Miner
            </span>
          </button>
        </div>

        {/* Zone 2: Navigation tabs */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'text-amber-300 bg-neutral-900 border border-neutral-800'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Streak, Sound toggle & Username right close to 🔇 */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Quick Streak Indicator Button */}
          <button
            onClick={() => setActiveTab('daily-streak')}
            title="Open Daily Streak Tracker"
            className={`hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
              !isTodayLoginClaimed
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 animate-pulse'
                : 'border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:text-neutral-100'
            }`}
          >
            <Flame className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
            <span className="font-mono tabular-nums font-semibold">Day {dailyLoginStreak}</span>
            {isTodayLoginClaimed && <Check className="h-3 w-3 text-emerald-400 shrink-0" />}
          </button>

          {/* Sound toggle 🔇 */}
          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Mute audio' : 'Unmute audio'}
            aria-label={soundEnabled ? 'Mute audio' : 'Unmute audio'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4 text-neutral-500" />
            )}
          </button>

          {/* Username placed directly close to the 🔇 sound toggle */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors cursor-pointer"
              >
                <div className="h-5 w-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-bold text-amber-300">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[80px] sm:max-w-[120px] truncate font-semibold text-neutral-200">{displayName}</span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-neutral-800 bg-neutral-950 p-2 shadow-xl z-50 text-xs animate-fade-in">
                  <div className="px-3 py-2 border-b border-neutral-800/80">
                    <div className="font-semibold text-neutral-100 truncate">{displayName}</div>
                    <div className="text-[11px] text-neutral-400 truncate font-mono">{user.email}</div>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-red-400 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors cursor-pointer"
              >
                <div className="h-5 w-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-bold text-amber-300">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[80px] sm:max-w-[120px] truncate font-semibold text-neutral-200">{displayName}</span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-neutral-800 bg-neutral-950 p-2 shadow-xl z-50 text-xs animate-fade-in">
                  <div className="px-3 py-2 border-b border-neutral-800/80">
                    <div className="font-semibold text-neutral-100 truncate">{displayName}</div>
                    <div className="text-[10px] text-neutral-500">Miner Account</div>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenAuth('login');
                      }}
                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-amber-300 hover:bg-neutral-800 transition-colors text-left cursor-pointer font-medium"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      <span>Account Login</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav scroll strip */}
      <div className="flex md:hidden overflow-x-auto px-4 py-2 border-t border-neutral-900 gap-1.5 no-scrollbar">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'text-amber-300 bg-neutral-900 border border-neutral-800'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
