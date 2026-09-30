import React, { useState } from 'react';
import { Zap, Sparkles, Check, Clock, RotateCcw, Flame, ArrowRight } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { formatSats, satsToUsd } from '../utils/crypto';

interface FaucetSectionProps {
  onGoToMining: () => void;
  onGoToQuiz: () => void;
  onGoToDailyStreak?: () => void;
}

export const FaucetSection: React.FC<FaucetSectionProps> = ({
  onGoToMining,
  onGoToQuiz,
  onGoToDailyStreak,
}) => {
  const {
    balance,
    streakDays,
    isFaucetReady,
    timeRemainingSeconds,
    claimFaucet,
    resetFaucetCooldown,
    btcPriceUsd,
    totalEarned,
    dailyLoginStreak,
    isTodayLoginClaimed,
  } = useWallet();

  const [claimFeedback, setClaimFeedback] = useState<{ amount: number } | null>(null);

  const streakTiers = [
    { day: 1, multiplier: '1.0x', sats: 100 },
    { day: 2, multiplier: '1.15x', sats: 115 },
    { day: 3, multiplier: '1.30x', sats: 130 },
    { day: 4, multiplier: '1.45x', sats: 145 },
    { day: 5, multiplier: '1.60x', sats: 160 },
    { day: 6, multiplier: '1.75x', sats: 175 },
    { day: 7, multiplier: '2.0x', sats: 200 },
  ];

  const currentMultiplier = 1 + Math.min(streakDays - 1, 6) * 0.15;
  const currentExpectedSats = Math.round(100 * currentMultiplier);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleClaim = () => {
    const res = claimFaucet();
    if (res.success) {
      setClaimFeedback({ amount: res.amount });
      setTimeout(() => setClaimFeedback(null), 4000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Daily Login Streak Teaser Banner */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Flame className="h-5 w-5 fill-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200">
              <span>Consecutive Daily Login Streak: Day {dailyLoginStreak}</span>
              <span className="text-neutral-600" aria-hidden="true">·</span>
              <span className={isTodayLoginClaimed ? 'text-emerald-400 font-normal' : 'text-amber-400 font-bold animate-pulse'}>
                {isTodayLoginClaimed ? 'Today Secured' : 'Check-In Bonus Ready!'}
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5">
              Stack satoshis for consecutive days of logging into SatoshiStack.
            </div>
          </div>
        </div>

        {onGoToDailyStreak && (
          <button
            onClick={onGoToDailyStreak}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-neutral-950 transition-colors"
          >
            <span>Open Daily Streak</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Hero Drop Canvas */}
      <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 sm:p-8 lg:p-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Claim Action */}
          <div className="lg:col-span-7 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
                <Zap className="h-3.5 w-3.5 fill-amber-400" />
                <span>Zero-Fee Lightning Faucet</span>
                <span className="text-neutral-600" aria-hidden="true">·</span>
                <span className="text-neutral-400">10-Minute Distribution Cycle</span>
                <span className="text-neutral-600" aria-hidden="true">·</span>
                <span className="rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2 py-0.5 font-mono font-bold">100.00 Sats Base</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-100 [text-wrap:balance]">
                Claim Free Satoshis Every Interval and Build Your Stack
              </h1>
              <p className="text-sm leading-relaxed text-neutral-400 max-w-xl">
                Every drop sends authentic Bitcoin satoshis (starting at 100 Sats base) straight to your local state ledger. Maintain your consecutive claim streak to unlock up to 200 Sats (2.0x multiplier).
              </p>
            </div>

            {/* Claim button & state */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {isFaucetReady ? (
                <button
                  onClick={handleClaim}
                  className="flex items-center gap-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-6 py-3 text-sm font-semibold text-neutral-950 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Claim {currentExpectedSats} Satoshis Now</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-2.5 text-xs text-neutral-300">
                    <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
                    <span>Next drop in:</span>
                    <span className="font-mono font-bold text-amber-300 tabular-nums">
                      {formatTimer(timeRemainingSeconds)}
                    </span>
                  </div>

                  <button
                    onClick={resetFaucetCooldown}
                    className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-amber-400 transition-colors px-2 py-1 rounded"
                    title="Skip cooldown for demo testing"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Fast Forward Timer</span>
                  </button>
                </div>
              )}

              {/* Feedback toast */}
              {claimFeedback && (
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 animate-fade-in bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                  <Check className="h-3.5 w-3.5" />
                  <span>+{claimFeedback.amount} Sats collected!</span>
                </div>
              )}
            </div>

            {/* Quick summary stats */}
            <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-400 border-t border-neutral-800/80">
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-500">Current Balance:</span>
                <span className="font-mono font-semibold text-neutral-100 tabular-nums">
                  {formatSats(balance)} Sats
                </span>
                <span className="text-neutral-500">({satsToUsd(balance, btcPriceUsd)})</span>
              </div>
              <span className="text-neutral-700" aria-hidden="true">·</span>
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-500">Total Stacked:</span>
                <span className="font-mono text-neutral-300 tabular-nums">
                  {totalEarned === 300 ? '300.00 Sats' : `${(totalEarned).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Sats`}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Anchor with Fallback Container */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 p-2 shadow-2xl">
              <img
                src="/src/assets/images/satoshi_gold_coin_1790512860625.jpg"
                alt="Satoshi Gold Medallion Physical Coin"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-xl transition-transform duration-500 hover:scale-105"
                onError={(e) => {
                  // Fallback container if image fails
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling;
                  if (fallback) {
                    (fallback as HTMLElement).style.display = 'flex';
                  }
                }}
              />
              {/* Resilient fallback container */}
              <div
                style={{ display: 'none' }}
                className="w-full h-full rounded-xl bg-gradient-to-br from-amber-500/20 via-neutral-900 to-neutral-950 flex flex-col items-center justify-center p-6 text-center"
              >
                <div className="h-16 w-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-3">
                  <Zap className="h-8 w-8 fill-amber-400" />
                </div>
                <div className="font-bold text-neutral-100">100,000,000 Sats</div>
                <div className="text-xs text-neutral-400 mt-1">= 1 Bitcoin (BTC)</div>
              </div>

              {/* Discreet overlay badge */}
              <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-neutral-950/80 backdrop-blur-md border border-neutral-800/80 px-3 py-2 flex items-center justify-between text-xs">
                <span className="text-neutral-400">Streak Day:</span>
                <span className="font-mono font-bold text-amber-400 tabular-nums">
                  Day {streakDays} ({currentMultiplier.toFixed(2)}x)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Consecutive Streak Ladder */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-neutral-100">
              Daily Streak Multiplier Track
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Claim consistently to escalate your drop payouts up to 2.0x base yield.
            </p>
          </div>
          <div className="text-xs text-neutral-400">
            Current multiplier: <span className="font-mono font-bold text-amber-400">{currentMultiplier.toFixed(2)}x</span>
          </div>
        </div>

        {/* Responsive horizontal ladder */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {streakTiers.map((tier) => {
            const isCurrent = streakDays === tier.day;
            const isCompleted = streakDays > tier.day;

            return (
              <div
                key={tier.day}
                className={`relative rounded-xl p-3.5 border transition-all text-center ${
                  isCurrent
                    ? 'border-amber-500 bg-amber-500/10 shadow-md shadow-amber-500/10'
                    : isCompleted
                    ? 'border-neutral-800 bg-neutral-950/60 opacity-80'
                    : 'border-neutral-800/70 bg-neutral-950/30'
                }`}
              >
                <div className="text-[11px] text-neutral-500">Day {tier.day}</div>
                <div className="my-1 text-sm font-bold font-mono text-neutral-100 tabular-nums">
                  {tier.multiplier}
                </div>
                <div className="text-xs font-mono text-amber-400/90 tabular-nums">
                  ~{tier.sats} sats
                </div>
                {isCompleted && (
                  <div className="mt-2 text-[10px] text-emerald-400 flex items-center justify-center gap-1">
                    <Check className="h-3 w-3" /> Claimed
                  </div>
                )}
                {isCurrent && (
                  <div className="mt-2 text-[10px] font-semibold text-amber-300">
                    Active Tier
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mechanism-to-Outcome Earning Discovery Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">Cryptographic Mining</span>
            <span className="text-xs font-mono text-amber-400">125 - 650 Sats</span>
          </div>
          <h3 className="text-base font-semibold text-neutral-100">
            Proof-of-Work SHA-256 Mining Rig
          </h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Run real client-side SHA-256 hash rounds to discover valid block nonces. Upgrade your CPU threads and ASIC hash boards to multiply your yield.
          </p>
          <button
            onClick={onGoToMining}
            className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 pt-1"
          >
            Launch Proof-of-Work Miner &rarr;
          </button>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">Knowledge Bounty</span>
            <span className="text-xs font-mono text-amber-400">50 Sats / Answer</span>
          </div>
          <h3 className="text-base font-semibold text-neutral-100">
            Satoshi Bitcoin Knowledge Academy
          </h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Test your understanding of the Bitcoin whitepaper, halving mechanics, lightning channels, and consensus history to earn instant satoshi payouts.
          </p>
          <button
            onClick={onGoToQuiz}
            className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 pt-1"
          >
            Begin Academy Challenges &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
