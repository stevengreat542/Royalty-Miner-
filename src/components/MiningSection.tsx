import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Cpu, Play, Pause, Zap, ArrowUp, RefreshCw, Trophy, ShieldCheck, Clock, Gauge, Flame, Sparkles, Coffee, AlertCircle, FastForward } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { sha256, formatSats, randomHex } from '../utils/crypto';
import { sound } from '../utils/audio';
import { MinedBlock } from '../types';

const FIVE_MINUTES_SECONDS = 300; // 5 minutes in seconds (300s)
const TWENTY_FOUR_HOURS_SECONDS = 86400; // 24 hours in seconds
const STORAGE_MINING_CYCLE = 'satoshistack_mining_5m_24h_cycle';

interface MiningSectionProps {
  onOpenLeaderboard?: () => void;
}

export const MiningSection: React.FC<MiningSectionProps> = ({ onOpenLeaderboard }) => {
  const {
    balance,
    upgrades,
    totalHashRate,
    blockBonusMultiplier,
    buyUpgrade,
    addSats,
    fireConfetti,
  } = useWallet();

  // Mining cycle states: 'idle' | 'mining' | 'cooldown'
  const [cycleState, setCycleState] = useState<'idle' | 'mining' | 'cooldown'>('idle');
  const [miningTimeRemaining, setMiningTimeRemaining] = useState<number>(FIVE_MINUTES_SECONDS);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [isSpeedingUp, setIsSpeedingUp] = useState<boolean>(false);

  // Standard mining state
  const [isAutoMining, setIsAutoMining] = useState<boolean>(false);
  const [difficultyZeros, setDifficultyZeros] = useState<number>(3); // 3 leading zeros default
  const [blockHeight, setBlockHeight] = useState<number>(884129);
  const [prevHash, setPrevHash] = useState<string>('00000000000000000002ab4f719c83de192485e90a827419bcde276531920381');
  const [currentNonce, setCurrentNonce] = useState<number>(104820);
  const [currentHash, setCurrentHash] = useState<string>('Waiting for miner cycle...');
  const [hashesComputed, setHashesComputed] = useState<number>(0);
  const [recentBlocks, setRecentBlocks] = useState<MinedBlock[]>([]);
  const [lastWinNotice, setLastWinNotice] = useState<{ block: number; reward: number; hash: string } | null>(null);

  const autoMiningRef = useRef<boolean>(false);
  autoMiningRef.current = isAutoMining && cycleState !== 'cooldown';

  const targetPrefix = '0'.repeat(difficultyZeros);

  // Load saved 5m / 24h cycle state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MINING_CYCLE);
      if (saved) {
        const parsed = JSON.parse(saved);
        const now = Date.now();
        if (parsed.cycleState === 'cooldown' && parsed.cooldownEndTime) {
          const remaining = Math.max(0, Math.floor((parsed.cooldownEndTime - now) / 1000));
          if (remaining > 0) {
            setCycleState('cooldown');
            setCooldownRemaining(remaining);
            setIsAutoMining(false);
          } else {
            setCycleState('idle');
            setMiningTimeRemaining(FIVE_MINUTES_SECONDS);
            setCooldownRemaining(0);
          }
        } else if (parsed.cycleState === 'mining') {
          // If was mining previously
          setCycleState('mining');
          setMiningTimeRemaining(Math.min(FIVE_MINUTES_SECONDS, parsed.miningTimeRemaining || FIVE_MINUTES_SECONDS));
          setIsAutoMining(true);
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  // Save cycle state to localStorage
  const saveCycleState = useCallback((state: 'idle' | 'mining' | 'cooldown', mRemaining: number, cEndTime?: number) => {
    try {
      localStorage.setItem(
        STORAGE_MINING_CYCLE,
        JSON.stringify({
          cycleState: state,
          miningTimeRemaining: mRemaining,
          cooldownEndTime: cEndTime || null,
        })
      );
    } catch {
      // Ignore
    }
  }, []);

  // Mine a batch of nonces
  const processHashRound = useCallback(async (batchSize: number = 10) => {
    let nonce = currentNonce;
    let foundBlock: MinedBlock | null = null;
    let latestHash = currentHash;

    for (let i = 0; i < batchSize; i++) {
      nonce += 1;
      const candidateString = `${blockHeight}:${prevHash}:${nonce}:${Date.now()}`;
      const hash = await sha256(candidateString);
      latestHash = hash;

      if (hash.startsWith(targetPrefix)) {
        // Discovered a valid block! Reward set to 100 sats
        const totalReward = 100;

        foundBlock = {
          blockHeight,
          nonce,
          hash,
          timestamp: Date.now(),
          rewardSats: totalReward,
          difficultyTarget: targetPrefix,
        };
        break;
      }
    }

    setCurrentNonce(nonce);
    setCurrentHash(latestHash);
    setHashesComputed(prev => prev + batchSize);

    if (foundBlock) {
      sound.playBlockFound();
      fireConfetti();

      const blockInfo = foundBlock;
      setRecentBlocks(prev => [blockInfo, ...prev.slice(0, 9)]);
      setLastWinNotice({
        block: blockInfo.blockHeight,
        reward: blockInfo.rewardSats,
        hash: blockInfo.hash,
      });

      addSats(
        foundBlock.rewardSats,
        'mining',
        `Block #${foundBlock.blockHeight} Mined (Nonce: ${foundBlock.nonce})`
      );

      // Advance block height and prev hash
      setBlockHeight(prev => prev + 1);
      setPrevHash(foundBlock.hash);
      setCurrentNonce(Math.floor(Math.random() * 50000));
    }
  }, [
    currentNonce,
    currentHash,
    blockHeight,
    prevHash,
    targetPrefix,
    difficultyZeros,
    blockBonusMultiplier,
    addSats,
    fireConfetti,
  ]);

  // Auto-mining tick loop (runs when autoMiningRef.current is true)
  useEffect(() => {
    if (!isAutoMining || cycleState === 'cooldown') return;

    const intervalMs = Math.max(35, Math.floor(1000 / (totalHashRate / 20)));
    const batchSize = Math.max(6, Math.floor(totalHashRate / 25));

    const timer = setInterval(() => {
      if (autoMiningRef.current) {
        processHashRound(batchSize);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isAutoMining, cycleState, totalHashRate, processHashRound]);

  // Master Timer: Controls the 5-Minute Mining Session and 24-Hour Cooldown Break
  useEffect(() => {
    const timer = setInterval(() => {
      if (cycleState === 'mining' && isAutoMining) {
        setMiningTimeRemaining(prev => {
          if (prev <= 1) {
            // 5 minutes session reached! Transition to 24-hour break
            setIsAutoMining(false);
            setCycleState('cooldown');
            setCooldownRemaining(TWENTY_FOUR_HOURS_SECONDS);
            const cooldownEnd = Date.now() + TWENTY_FOUR_HOURS_SECONDS * 1000;
            saveCycleState('cooldown', 0, cooldownEnd);
            sound.playLightningZap();
            return 0;
          }
          const next = prev - 1;
          saveCycleState('mining', next);
          return next;
        });
      } else if (cycleState === 'cooldown') {
        setCooldownRemaining(prev => {
          if (prev <= 1) {
            // 24 hours cooldown finished! Miner is ready again
            setCycleState('idle');
            setMiningTimeRemaining(FIVE_MINUTES_SECONDS);
            saveCycleState('idle', FIVE_MINUTES_SECONDS);
            sound.playWin();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [cycleState, isAutoMining, saveCycleState]);

  // Start the 5-Minute Mining Session
  const startFiveMinuteMining = () => {
    if (cycleState === 'cooldown') return;
    setCycleState('mining');
    setIsAutoMining(true);
    sound.playBlockFound();
    saveCycleState('mining', miningTimeRemaining);
  };

  // Pause / Resume Mining
  const togglePauseMining = () => {
    if (cycleState === 'cooldown') return;
    if (cycleState === 'idle') {
      startFiveMinuteMining();
    } else {
      setIsAutoMining(!isAutoMining);
    }
  };

  // Speed Up Demonstration: Fast forward 1 minute of mining or fast-forward cooldown
  const fastForwardMining = (seconds: number) => {
    if (cycleState === 'mining') {
      setMiningTimeRemaining(prev => Math.max(0, prev - seconds));
      processHashRound(50);
    } else if (cycleState === 'cooldown') {
      setCooldownRemaining(prev => Math.max(0, prev - seconds));
    }
  };

  const handleManualHash = () => {
    if (cycleState === 'cooldown') return;
    sound.playTick();
    processHashRound(20);
  };

  // Format MM:SS or HH:MM:SS
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const miningProgressPercent = Math.round(((FIVE_MINUTES_SECONDS - miningTimeRemaining) / FIVE_MINUTES_SECONDS) * 100);
  const cooldownProgressPercent = Math.round(((TWENTY_FOUR_HOURS_SECONDS - cooldownRemaining) / TWENTY_FOUR_HOURS_SECONDS) * 100);

  return (
    <div className="space-y-8">
      {/* Top Header & Overview */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 [text-wrap:balance]">
            Proof-of-Work Mining Station
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Compute real cryptographic SHA-256 blocks during an active 5-minute mining epoch, followed by an autonomous 24-hour rig cooling cycle.
          </p>
        </div>

        {/* Global Miner Metrics & Leaderboard CTA */}
        <div className="flex items-center flex-wrap gap-2.5 text-xs font-mono">
          {onOpenLeaderboard && (
            <button
              onClick={onOpenLeaderboard}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-2 text-amber-300 font-sans font-semibold transition-colors cursor-pointer"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span>Pool Leaderboard</span>
            </button>
          )}

          {/* Standalone Mining Balance Card */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-right">
            <div className="text-[10px] text-amber-400 uppercase tracking-wider font-sans font-semibold">
              Mining Balance
            </div>
            <div className="text-base font-bold text-amber-300 tabular-nums flex items-center justify-end gap-1">
              <span>{formatSats(balance)}</span>
              <span className="text-[10px] text-amber-400 font-medium">SATS</span>
            </div>
          </div>

          {/* Standalone Reward Multiplier Card */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-3.5 py-2 text-right">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-sans">
              Reward Multiplier
            </div>
            <div className="text-base font-bold text-neutral-100 tabular-nums">
              {blockBonusMultiplier.toFixed(2)}x
            </div>
          </div>

          {/* Standalone Rig Hashrate Card */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-3.5 py-2 text-right">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-sans">
              Rig Hashrate
            </div>
            <div className="text-base font-bold text-amber-300 tabular-nums">
              {formatSats(totalHashRate)} H/s
            </div>
          </div>
        </div>
      </div>

      {/* 5-MINUTES MINING / 24-HOURS BREAK BANNER */}
      {cycleState === 'mining' && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-neutral-100 text-sm">
                Active Proof-of-Work Mining Epoch In Progress
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono">
              <span className="text-neutral-400 text-xs">Time Left:</span>
              <span className="text-base font-bold text-amber-300 bg-neutral-950/80 px-3 py-1 rounded-lg border border-amber-500/30">
                {formatTime(miningTimeRemaining)}
              </span>
            </div>
          </div>

          {/* Mining Progress Bar */}
          <div className="space-y-1">
            <div className="w-full bg-neutral-950 rounded-full h-2.5 overflow-hidden border border-neutral-800">
              <div
                className="bg-amber-400 h-2.5 transition-all duration-300"
                style={{ width: `${miningProgressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-neutral-400 pt-0.5">
              <span>Elapsed: {formatTime(FIVE_MINUTES_SECONDS - miningTimeRemaining)} ({miningProgressPercent}%)</span>
              <span>Next 24h Break in {formatTime(miningTimeRemaining)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-amber-500/20 text-xs">
            <div className="text-neutral-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Mining SHA-256 nonces at full throttle. When the 5-minute epoch concludes, a 24-hour cooling cycle begins automatically.</span>
            </div>
            <button
              onClick={() => fastForwardMining(60)}
              className="flex items-center gap-1 text-[11px] font-mono text-amber-300 hover:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-1 rounded border border-amber-500/40 transition-colors cursor-pointer"
              title="Fast-forward 60s for testing"
            >
              <FastForward className="h-3 w-3" />
              <span>Fast-Forward 1m</span>
            </button>
          </div>
        </div>
      )}

      {/* 24-HOUR COOLING BREAK BANNER */}
      {cycleState === 'cooldown' && (
        <div className="rounded-2xl border border-blue-500/40 bg-blue-950/30 p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Coffee className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                  <span>24-Hour Rig Cooldown Break Active</span>
                  <span className="rounded bg-blue-500/20 text-blue-300 px-2 py-0.5 text-[10px] font-mono">
                    Cooling Cycle
                  </span>
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  The 5-minute mining window has completed. Rigs are cooling down for 24 hours to prevent ASIC thermal degradation.
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] uppercase font-sans text-neutral-400">Break Time Remaining</div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-blue-300 bg-neutral-950/80 px-3.5 py-1 rounded-xl border border-blue-500/30 tabular-nums">
                {formatTime(cooldownRemaining)}
              </div>
            </div>
          </div>

          {/* Cooldown Progress bar */}
          <div className="space-y-1">
            <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-800">
              <div
                className="bg-blue-400 h-2 transition-all duration-300"
                style={{ width: `${cooldownProgressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-neutral-500">
              <span>Resting: {cooldownProgressPercent}% elapsed</span>
              <span>Total Break Duration: 24:00:00</span>
            </div>
          </div>
        </div>
      )}

      {/* Discovery Alert Toast */}
      {lastWinNotice && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Trophy className="h-5 w-5 fill-amber-400/20 text-amber-400" />
            </div>
            <div>
              <div className="font-semibold text-neutral-100">
                Block #{lastWinNotice.block} Validated & Confirmed!
              </div>
              <div className="font-mono text-[11px] text-neutral-400 truncate max-w-md sm:max-w-xl">
                Target Met: <span className="text-amber-300">{lastWinNotice.hash}</span>
              </div>
            </div>
          </div>
          <div className="font-mono font-bold text-sm text-amber-300">
            +{lastWinNotice.reward} SATS
          </div>
        </div>
      )}

      {/* Primary Mining Console & Rig Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Mining Console */}
        <div className="lg:col-span-7 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${
                cycleState === 'cooldown'
                  ? 'bg-blue-400 animate-pulse'
                  : isAutoMining
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-neutral-600'
              }`} />
              <span className="text-xs font-medium text-neutral-200">
                {cycleState === 'cooldown'
                  ? 'Cooling Down (24h Break)'
                  : isAutoMining
                  ? 'PoW Mining Epoch Active (5m)'
                  : 'Miner Standby'}
              </span>
            </div>

            {/* Target Difficulty Selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500">Difficulty Target:</span>
              <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-md border border-neutral-800">
                <button
                  onClick={() => setDifficultyZeros(3)}
                  disabled={cycleState === 'cooldown'}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer disabled:opacity-40 ${
                    difficultyZeros === 3
                      ? 'bg-amber-500/20 text-amber-300 font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  000 (Fast)
                </button>
                <button
                  onClick={() => setDifficultyZeros(4)}
                  disabled={cycleState === 'cooldown'}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer disabled:opacity-40 ${
                    difficultyZeros === 4
                      ? 'bg-amber-500/20 text-amber-300 font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  0000 (Medium)
                </button>
              </div>
            </div>
          </div>

          {/* Block Header Inspection Display */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4 space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center text-neutral-500 text-[11px]">
              <span>CANDIDATE BLOCK HEADER #{blockHeight}</span>
              <span>TARGET PREFIX: &quot;{targetPrefix}&quot;</span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="text-neutral-500">PREV BLOCK HASH:</div>
              <div className="text-neutral-400 truncate">{prevHash}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-neutral-900 text-[11px]">
              <div>
                <span className="text-neutral-500">NONCE ITERATION:</span>
                <div className="text-neutral-200 font-bold tabular-nums">
                  #{currentNonce.toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-neutral-500">TOTAL ROUNDS COMPUTED:</span>
                <div className="text-neutral-200 font-bold tabular-nums">
                  {hashesComputed.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-neutral-900">
              <div className="text-neutral-500 text-[11px]">LIVE COMPUTED SHA-256 HASH:</div>
              <div className="p-2.5 rounded bg-neutral-900/90 border border-neutral-800/80 break-all text-xs font-bold text-neutral-300">
                {currentHash.startsWith(targetPrefix) ? (
                  <span className="text-amber-400">{currentHash.slice(0, difficultyZeros)}</span>
                ) : (
                  <span className="text-neutral-500">{currentHash.slice(0, difficultyZeros)}</span>
                )}
                {currentHash.slice(difficultyZeros)}
              </div>
            </div>
          </div>

          {/* Mining Trigger Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {cycleState !== 'cooldown' ? (
              <button
                onClick={togglePauseMining}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                  isAutoMining
                    ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                    : 'bg-amber-500 text-neutral-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                }`}
              >
                {isAutoMining ? (
                  <>
                    <Pause className="h-4 w-4" />
                    <span>Pause Mining Epoch</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span>Initiate Mining Epoch</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-xs font-medium text-neutral-400">
                <Coffee className="h-4 w-4 text-blue-400" />
                <span>Taking 24-Hour Break</span>
              </div>
            )}

            <button
              onClick={handleManualHash}
              disabled={cycleState === 'cooldown'}
              className="flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-800/60 px-4 py-2.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Mine 20 Nonces</span>
            </button>

            <div className="ml-auto text-xs text-neutral-400">
              Reward per block: <span className="font-mono text-amber-300 font-bold">100 Sats</span>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Rig Showcase & Hardware Upgrades */}
        <div className="lg:col-span-5 space-y-6">
          {/* Rig Hardware Image Card with Resilient Fallback */}
          <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 p-2 shadow-xl">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-neutral-900">
              <img
                src="/src/assets/images/mining_node_rig_1790512872138.jpg"
                alt="Cryptographic Mining Node Rig"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling;
                  if (fallback) {
                    (fallback as HTMLElement).style.display = 'flex';
                  }
                }}
              />
              {/* Fallback container */}
              <div
                style={{ display: 'none' }}
                className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900"
              >
                <Cpu className="h-12 w-12 text-amber-400 mb-2 opacity-80" />
                <div className="text-sm font-bold text-neutral-200">ASIC SHA-256 Mining Rig</div>
                <div className="text-xs text-neutral-500 mt-1">Proof-of-Work Node Hardware</div>
              </div>
            </div>

            {/* Overlay stats badges */}
            <div className="p-3 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5 text-neutral-400">
                <span className="text-neutral-500">Hashrate:</span>
                <span className="text-amber-400 font-bold">{formatSats(totalHashRate)} H/s</span>
              </div>
              <div className="flex items-center gap-1.5 text-neutral-400">
                <span className="text-neutral-500">Rig Duty:</span>
                <span className="text-emerald-400 font-bold">5m Epoch / 24h Off</span>
              </div>
            </div>
          </div>

          {/* Upgrades & Rig Enhancements */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-neutral-100">
                  Hardware Upgrade Workshop
                </h3>
              </div>
              <span className="text-xs text-neutral-500 font-mono">
                {upgrades.filter(u => u.level > 0).length}/{upgrades.length} Active
              </span>
            </div>

            <div className="space-y-3">
              {upgrades.map((upgrade) => {
                const isMax = upgrade.level >= upgrade.maxLevel;
                const canAfford = balance >= upgrade.cost;

                return (
                  <div
                    key={upgrade.id}
                    className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3.5 space-y-2 hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-neutral-100">
                            {upgrade.name}
                          </span>
                          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono text-amber-400">
                            Tier {upgrade.level}/{upgrade.maxLevel}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                          {upgrade.description}
                        </p>
                      </div>

                      <button
                        onClick={() => buyUpgrade(upgrade.id)}
                        disabled={isMax || !canAfford}
                        className={`shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                          isMax
                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                            : canAfford
                            ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                            : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700 cursor-not-allowed'
                        }`}
                      >
                        {isMax ? (
                          'MAXED'
                        ) : (
                          <>
                            <ArrowUp className="h-3 w-3" />
                            <span>{formatSats(upgrade.cost)} Sats</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Level progress line */}
                    <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all duration-300"
                        style={{ width: `${(upgrade.level / upgrade.maxLevel) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Pool Leaderboard Quick Preview Card */}
      {onOpenLeaderboard && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-100">Top Pool Miners & Hash Speeds</h3>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.2 text-[10px] font-semibold">
                  Live Rankings
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Compare your rig hash rate with 1,480+ global miners and see real-time pool block rewards.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenLeaderboard}
            className="flex items-center gap-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 px-3.5 py-2 text-xs font-semibold text-neutral-100 transition-colors cursor-pointer shrink-0 border border-neutral-700/60"
          >
            <span>View Full Leaderboard</span>
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
          </button>
        </div>
      )}

      {/* Validated Block Ledger */}
      {recentBlocks.length > 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-neutral-100">
                Session Mined Blocks History
              </h3>
            </div>
            <span className="text-xs font-mono text-neutral-400">
              {recentBlocks.length} valid blocks discovered
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-500">
                  <th className="pb-2 font-medium">BLOCK #</th>
                  <th className="pb-2 font-medium">NONCE</th>
                  <th className="pb-2 font-medium">HASH DIGEST</th>
                  <th className="pb-2 font-medium text-right">REWARD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {recentBlocks.map((block) => (
                  <tr key={block.hash} className="hover:bg-neutral-900/30">
                    <td className="py-2.5 text-neutral-200">#{block.blockHeight}</td>
                    <td className="py-2.5 text-neutral-400">#{block.nonce}</td>
                    <td className="py-2.5 text-amber-300 truncate max-w-xs">{block.hash}</td>
                    <td className="py-2.5 text-right font-bold text-amber-400 tabular-nums">
                      +{formatSats(block.rewardSats)} SATS
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
