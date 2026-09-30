import React, { useState } from 'react';
import { Flame, Shield, Check, Calendar, Clock, Sparkles, Award, Lock } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { DAILY_STREAK_TIERS, STREAK_MILESTONES } from '../data/mockData';
import { formatSats, satsToUsd } from '../utils/crypto';

export const DailyStreakTracker: React.FC = () => {
  const {
    balance,
    dailyLoginStreak,
    maxDailyStreak,
    isTodayLoginClaimed,
    dailyTimeRemainingSeconds,
    streakShieldActive,
    claimedMilestoneIds,
    totalStreakSatsEarned,
    claimDailyLogin,
    activateStreakShield,
    claimStreakMilestone,
    btcPriceUsd,
  } = useWallet();

  const [claimToast, setClaimToast] = useState<{ amount: number; day: number } | null>(null);

  // Format 24-hour remaining cooldown
  const format24hTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Active day index in 7-day cycle (0 to 6)
  const currentCycleDayIndex = (dailyLoginStreak - 1) % 7;
  const currentTier = DAILY_STREAK_TIERS[currentCycleDayIndex];
  const nextDaySats = dailyLoginStreak > 7 
    ? 30000 + (dailyLoginStreak - 7) * 2500 
    : currentTier.rewardSats;

  const isLocked = isTodayLoginClaimed || dailyTimeRemainingSeconds > 0;

  const handleClaim = () => {
    if (isLocked) return;
    const res = claimDailyLogin();
    if (res.success) {
      setClaimToast({ amount: res.amount, day: res.day });
      setTimeout(() => setClaimToast(null), 4000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
            <Flame className="h-4 w-4 fill-amber-400" />
            <span>Daily Login Streak Protocol</span>
            <span className="text-neutral-600" aria-hidden="true">·</span>
            <span className="text-neutral-400">Escalating Consecutive Rewards</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 mt-1 [text-wrap:balance]">
            Consecutive Daily Check-In & Streak Multipliers
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Log into SatoshiStack every 24 hours to earn escalating satoshi bonuses, claim exclusive milestone bounties, and protect your streak.
          </p>
        </div>

        {/* Top Streak Stats */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2.5 text-right">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-sans">
              Current Streak
            </div>
            <div className="flex items-center justify-end gap-1.5 text-base font-bold text-amber-300 tabular-nums">
              <Flame className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span>{dailyLoginStreak} {dailyLoginStreak === 1 ? 'Day' : 'Days'}</span>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2.5 text-right">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-sans">
              Best Record
            </div>
            <div className="text-base font-bold text-neutral-100 tabular-nums">
              {maxDailyStreak} {maxDailyStreak === 1 ? 'Day' : 'Days'}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2.5 text-right">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-sans">
              Total Streak Sats
            </div>
            <div className="text-base font-bold text-emerald-400 tabular-nums">
              +{formatSats(totalStreakSatsEarned)}
            </div>
          </div>
        </div>
      </div>

      {/* Claim Toast Notice */}
      {claimToast && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-neutral-100">
                Day {claimToast.day} Login Bonus Claimed!
              </div>
              <div className="text-neutral-400 text-[11px]">
                +{claimToast.amount} Satoshis deposited to your wallet balance.
              </div>
            </div>
          </div>
          <div className="font-mono font-bold text-amber-300">
            +{claimToast.amount} SATS
          </div>
        </div>
      )}

      {/* Primary Check-in Hero Card */}
      <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900/80 via-neutral-900/40 to-neutral-950 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              <span>Today&apos;s Status:</span>
              {isLocked ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="h-3 w-3" /> Checked In · 24h Cooldown Active
                </span>
              ) : (
                <span className="text-amber-400 font-bold">Bonus Awaiting Collection</span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-neutral-100">
              {isLocked
                ? `Day ${dailyLoginStreak - 1} Claimed · 24-Hour Cooldown Active`
                : `Claim Day ${dailyLoginStreak} Daily Reward (+${formatSats(nextDaySats)} Sats)`}
            </h2>

            <p className="text-xs text-neutral-400 max-w-xl leading-relaxed">
              {isLocked
                ? `You have already collected today's reward! Next check-in unlocks in ${format24hTimer(dailyTimeRemainingSeconds)}. Come back in 24 hours to claim Day ${dailyLoginStreak}.`
                : `You are on Day ${dailyLoginStreak} of your streak. Claim now to bank ${formatSats(nextDaySats)} satoshis and continue advancing toward milestone bounties.`}
            </p>
          </div>

          {/* Action Trigger Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {!isLocked ? (
              <button
                onClick={handleClaim}
                className="flex items-center justify-center gap-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-6 py-3.5 text-sm font-bold text-neutral-950 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Flame className="h-4 w-4 fill-current" />
                <span>Claim {formatSats(nextDaySats)} Satoshis</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-3 text-xs text-neutral-300">
                  <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
                  <span>Next check-in in:</span>
                  <span className="font-mono font-bold text-amber-300 tabular-nums">
                    {format24hTimer(dailyTimeRemainingSeconds)}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-300">
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span>Day {dailyLoginStreak - 1} Bonus Secured</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 7-Day Visual Progression Pathway */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-neutral-100">
              7-Day Escalating Reward Pathway
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Each consecutive day increases your payout. Complete Day 7 to open the Golden Satoshi Genesis Vault.
            </p>
          </div>
          <div className="text-xs text-neutral-400 font-mono">
            Cycle Stage: <span className="text-amber-400 font-bold">Day {currentCycleDayIndex + 1} of 7</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {DAILY_STREAK_TIERS.map((tier) => {
            const isCompleted = isTodayLoginClaimed
              ? tier.day <= ((dailyLoginStreak - 2) % 7) + 1 && dailyLoginStreak > tier.day
              : tier.day < currentCycleDayIndex + 1;

            const isCurrent = isTodayLoginClaimed
              ? tier.day === ((dailyLoginStreak - 2) % 7) + 1
              : tier.day === currentCycleDayIndex + 1;

            return (
              <div
                key={tier.day}
                className={`relative rounded-xl p-4 border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                    : isCompleted
                    ? 'border-neutral-800 bg-neutral-950/70 opacity-80'
                    : 'border-neutral-800/70 bg-neutral-950/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                    <span>DAY {tier.day}</span>
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : isCurrent ? (
                      <Flame className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ) : (
                      <Lock className="h-3 w-3 text-neutral-600" />
                    )}
                  </div>

                  <div className="my-2 text-base font-bold font-mono text-neutral-100 tabular-nums">
                    +{tier.rewardSats} <span className="text-xs font-sans text-amber-400/80">Sats</span>
                  </div>

                  <div className="text-[11px] text-neutral-400 leading-snug">
                    {tier.perkDescription}
                  </div>
                </div>

                <div className="pt-3 mt-2 border-t border-neutral-800/60 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-neutral-500">{tier.bonusMultiplier}x Multiplier</span>
                  {tier.isMilestone && (
                    <span className="text-amber-400 font-bold">Chest</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Streak Shield & Long-Term Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Streak Shield Protection */}
        <div className="lg:col-span-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className={`h-5 w-5 ${streakShieldActive ? 'text-emerald-400' : 'text-amber-400'}`} />
              <h3 className="text-sm font-semibold text-neutral-100">
                Streak Freeze Shield
              </h3>
            </div>
            {streakShieldActive ? (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" /> Shield Active
              </span>
            ) : (
              <span className="text-xs text-neutral-500 font-mono">120 Sats</span>
            )}
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            Never lose your hard-earned streak. If you miss a 24-hour check-in window, the Streak Shield automatically consumes itself to preserve your streak count intact.
          </p>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3.5 space-y-2 text-xs">
            <div className="flex justify-between text-neutral-400">
              <span>Status:</span>
              <strong className={streakShieldActive ? 'text-emerald-300' : 'text-neutral-300'}>
                {streakShieldActive ? 'Protected for 1 Missed Day' : 'Unprotected'}
              </strong>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Coverage:</span>
              <span className="font-mono text-neutral-300">Preserves Day {dailyLoginStreak}</span>
            </div>
          </div>

          <button
            onClick={activateStreakShield}
            disabled={streakShieldActive || balance < 120}
            className={`w-full rounded-xl py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              streakShieldActive
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : balance >= 120
                ? 'bg-neutral-800 text-neutral-100 hover:bg-amber-500 hover:text-neutral-950'
                : 'bg-neutral-900 text-neutral-500 cursor-not-allowed'
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>{streakShieldActive ? 'Shield Already Armed' : 'Equip Streak Shield (120 Sats)'}</span>
          </button>
        </div>

        {/* Right: Milestone Bounties */}
        <div className="lg:col-span-7 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-400" />
              <h3 className="text-sm font-semibold text-neutral-100">
                Streak Milestone Bounties
              </h3>
            </div>
            <span className="text-xs text-neutral-500 font-mono">
              {claimedMilestoneIds.length} / {STREAK_MILESTONES.length} Claimed
            </span>
          </div>

          <div className="space-y-3">
            {STREAK_MILESTONES.map((milestone) => {
              const isClaimed = claimedMilestoneIds.includes(milestone.id);
              const isEligible = dailyLoginStreak >= milestone.targetDays && !isClaimed;

              return (
                <div
                  key={milestone.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xl shrink-0 p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                      {milestone.badge}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
                        <span>{milestone.title}</span>
                        <span className="text-[11px] font-mono text-neutral-500">
                          ({milestone.targetDays} Days Target)
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        {milestone.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-900">
                    <span className="font-mono text-xs font-bold text-amber-300 tabular-nums">
                      +{formatSats(milestone.rewardSats)} Sats
                    </span>

                    {isClaimed ? (
                      <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Claimed
                      </span>
                    ) : isEligible ? (
                      <button
                        onClick={() => claimStreakMilestone(milestone.id)}
                        className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold text-neutral-950 transition-colors"
                      >
                        Claim Bonus
                      </button>
                    ) : (
                      <span className="text-[11px] text-neutral-500 font-mono">
                        {dailyLoginStreak} / {milestone.targetDays} Days
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
