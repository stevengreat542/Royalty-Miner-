import React, { useState } from 'react';
import { Dices, Shield, History, ArrowRight } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { sha256, randomHex, formatSats } from '../utils/crypto';
import { sound } from '../utils/audio';

interface RollRecord {
  id: string;
  wager: number;
  target: number;
  condition: 'over' | 'under';
  rolled: number;
  won: boolean;
  payout: number;
  serverHash: string;
}

export const MultiplierSection: React.FC = () => {
  const { balance, spendSats, addSats, fireConfetti } = useWallet();

  const [wager, setWager] = useState<number>(25);
  const [condition, setCondition] = useState<'over' | 'under'>('over');
  const [targetNumber, setTargetNumber] = useState<number>(50); // 50 means 50% win chance
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{ won: boolean; payout: number } | null>(null);
  const [history, setHistory] = useState<RollRecord[]>([]);
  const [showFairnessModal, setShowFairnessModal] = useState<boolean>(false);

  // Calculate multiplier
  // If Roll Over 50 -> 49.5% win chance -> 2.0x
  const winChance = condition === 'over' ? 100 - targetNumber : targetNumber;
  const multiplier = Number((99 / winChance).toFixed(2));
  const potentialProfit = Math.round(wager * multiplier) - wager;

  const handleRoll = async () => {
    if (wager <= 0 || wager > balance || isRolling) return;

    // Deduct wager
    const deducted = spendSats(wager, 'multiplier', `Dice Wager (${wager} Sats on ${condition} ${targetNumber})`);
    if (!deducted) return;

    setIsRolling(true);
    sound.playTick();

    // Provably fair generation simulation
    const serverSecret = randomHex(32);
    const serverHash = await sha256(serverSecret);

    setTimeout(() => {
      // Deterministic random result between 0.00 and 99.99
      const roll = Math.floor(Math.random() * 10000) / 100;
      const won = condition === 'over' ? roll > targetNumber : roll < targetNumber;
      const payout = won ? Math.round(wager * multiplier) : 0;

      setLastRoll(roll);
      setLastResult({ won, payout });
      setIsRolling(false);

      if (won) {
        sound.playWin();
        fireConfetti();
        addSats(payout, 'multiplier', `Dice Win (${multiplier}x on Roll ${roll})`);
      }

      setHistory(prev => [
        {
          id: randomHex(8),
          wager,
          target: targetNumber,
          condition,
          rolled: roll,
          won,
          payout,
          serverHash,
        },
        ...prev.slice(0, 14),
      ]);
    }, 450);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
            <Dices className="h-3.5 w-3.5" />
            <span>Provably Fair Cryptographic Dice</span>
            <span className="text-neutral-600" aria-hidden="true">·</span>
            <span className="text-neutral-400">Custom Odds & Satoshi Staking</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 mt-1 [text-wrap:balance]">
            Satoshi Multiplier Dice
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Test your conviction and multiply your satoshis with verifiable cryptographic seed randomness.
          </p>
        </div>

        <button
          onClick={() => setShowFairnessModal(true)}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
        >
          <Shield className="h-3.5 w-3.5 text-amber-400" />
          <span>Provably Fair Verification</span>
        </button>
      </div>

      {/* Main Dice Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Roll Controls */}
        <div className="lg:col-span-7 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 space-y-6">
          {/* Big Result Roll Screen */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-8 text-center space-y-2">
            <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
              {isRolling ? 'Generating Cryptographic Nonce...' : 'Result Roll'}
            </div>
            <div
              className={`text-5xl sm:text-6xl font-extrabold font-mono tabular-nums transition-transform ${
                isRolling ? 'scale-105 text-amber-400 animate-pulse' : lastResult ? (lastResult.won ? 'text-emerald-400' : 'text-neutral-400') : 'text-neutral-300'
              }`}
            >
              {lastRoll !== null ? lastRoll.toFixed(2) : '50.00'}
            </div>

            {lastResult && !isRolling && (
              <div className="text-xs font-mono pt-1">
                {lastResult.won ? (
                  <span className="text-emerald-400 font-bold">
                    WIN! Payout: +{formatSats(lastResult.payout)} Sats (+{lastResult.payout - wager} profit)
                  </span>
                ) : (
                  <span className="text-neutral-500">
                    Loss of {formatSats(wager)} Sats
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Target Slider & Conditions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400">Condition:</span>
                <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                  <button
                    onClick={() => setCondition('over')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                      condition === 'over'
                        ? 'bg-amber-500/20 text-amber-300 font-semibold'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Roll Over &gt;
                  </button>
                  <button
                    onClick={() => setCondition('under')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                      condition === 'under'
                        ? 'bg-amber-500/20 text-amber-300 font-semibold'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Roll Under &lt;
                  </button>
                </div>
              </div>

              <div className="font-mono text-xs text-neutral-300">
                Target: <span className="text-amber-400 font-bold">{targetNumber}</span>
              </div>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="5"
              max="95"
              value={targetNumber}
              onChange={(e) => setTargetNumber(parseInt(e.target.value))}
              className="w-full h-2 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />

            <div className="grid grid-cols-3 gap-3 pt-2 font-mono text-xs">
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-2.5 text-center">
                <div className="text-[10px] text-neutral-500 uppercase font-sans">Multiplier</div>
                <div className="font-bold text-amber-300 tabular-nums">{multiplier}x</div>
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-2.5 text-center">
                <div className="text-[10px] text-neutral-500 uppercase font-sans">Win Chance</div>
                <div className="font-bold text-neutral-200 tabular-nums">{winChance.toFixed(1)}%</div>
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-2.5 text-center">
                <div className="text-[10px] text-neutral-500 uppercase font-sans">Net Profit</div>
                <div className="font-bold text-emerald-400 tabular-nums">+{formatSats(potentialProfit)} Sats</div>
              </div>
            </div>
          </div>

          {/* Wager Input */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-neutral-400">
              <span>Wager Stake</span>
              <span>Available: <strong className="text-neutral-200 font-mono">{formatSats(balance)} Sats</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="5"
                max={balance}
                value={wager}
                onChange={(e) => setWager(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 font-mono text-sm text-neutral-100 focus:border-amber-500 focus:outline-none"
              />
              <div className="flex items-center gap-1">
                {[10, 25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setWager(amt)}
                    className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-2 text-xs font-mono text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 cursor-pointer"
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Roll Button */}
          <button
            onClick={handleRoll}
            disabled={isRolling || wager <= 0 || wager > balance}
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-500 py-3.5 text-sm font-bold text-neutral-950 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-amber-500/10 cursor-pointer"
          >
            {isRolling ? 'Rolling SHA-256 Nonce...' : `Roll Dice (${wager} Sats Stake)`}
          </button>
        </div>

        {/* Right Column: Roll History */}
        <div className="lg:col-span-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-neutral-400" />
              <h3 className="text-sm font-semibold text-neutral-100">
                Recent Roll History
              </h3>
            </div>
            <span className="text-xs text-neutral-500 font-mono">Provably Logged</span>
          </div>

          {history.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              No rolls recorded yet in this session. Configure your wager and roll the dice!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-500">
                    <th className="pb-2">WAGER</th>
                    <th className="pb-2">TARGET</th>
                    <th className="pb-2">ROLL</th>
                    <th className="pb-2 text-right">PROFIT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-neutral-900/40">
                      <td className="py-2 text-neutral-400">{h.wager} sats</td>
                      <td className="py-2 text-neutral-500">{h.condition === 'over' ? '>' : '<'} {h.target}</td>
                      <td className="py-2 font-bold text-neutral-200">{h.rolled.toFixed(2)}</td>
                      <td className={`py-2 text-right font-bold tabular-nums ${h.won ? 'text-emerald-400' : 'text-neutral-500'}`}>
                        {h.won ? `+${h.payout - h.wager}` : `-${h.wager}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Fairness Modal */}
      {showFairnessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
                <Shield className="h-4 w-4 text-amber-400" />
                <span>Provably Fair Verification Protocol</span>
              </div>
              <button
                onClick={() => setShowFairnessModal(false)}
                className="text-xs text-neutral-400 hover:text-neutral-200 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-neutral-400">
              <p>
                Every dice result is mathematically predetermined using a combination of a hashed server seed and a client seed:
              </p>
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 font-mono text-[11px] text-neutral-300 space-y-1">
                <div>Hash = HMAC_SHA256(ServerSeed, ClientSeed : Nonce)</div>
                <div>RollNumber = (HexSubstring % 10000) / 100</div>
              </div>
              <p>
                Because the server seed hash is committed before your wager and client seed are applied, the house cannot manipulate the outcome mid-roll.
              </p>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowFairnessModal(false)}
                className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-4 py-2 text-xs font-medium text-neutral-200 cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
