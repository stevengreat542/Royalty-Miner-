import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Cpu, 
  Zap, 
  Activity, 
  Flame, 
  Search, 
  Sparkles, 
  RefreshCw,
  Users,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { formatSats, formatHashRate } from '../utils/crypto';

export interface PoolMiner {
  id: string;
  rank: number;
  minerName: string;
  rigModel: string;
  hashRate: number; // in H/s
  efficiency: string; // e.g. "15.0 J/TH"
  shares24h: number;
  sharePercent: number;
  blocksFound: number;
  satsRewarded: number;
  latencyMs: number;
  status: 'active' | 'cooling';
}

const GLOBAL_POOL_MINERS: Omit<PoolMiner, 'rank' | 'sharePercent'>[] = [
  {
    id: 'miner_satoshi_99',
    minerName: 'Satoshi_Vault_99',
    rigModel: 'Antminer S21 Pro Hydro (Cluster)',
    hashRate: 335000000000000, // 335 TH/s
    efficiency: '15.0 J/TH',
    shares24h: 142850,
    blocksFound: 28,
    satsRewarded: 2450000,
    latencyMs: 11,
    status: 'active',
  },
  {
    id: 'miner_bitaxe_maxi',
    minerName: 'BitAxe_Maxi',
    rigModel: 'MicroBT Whatsminer M60S+',
    hashRate: 218000000000000, // 218 TH/s
    efficiency: '18.2 J/TH',
    shares24h: 98400,
    blocksFound: 19,
    satsRewarded: 1820000,
    latencyMs: 14,
    status: 'active',
  },
  {
    id: 'miner_hal_legacy',
    minerName: 'HalFinney_Legacy_Node',
    rigModel: 'Avalon A1466I Immersion',
    hashRate: 172000000000000, // 172 TH/s
    efficiency: '19.5 J/TH',
    shares24h: 81200,
    blocksFound: 14,
    satsRewarded: 1410000,
    latencyMs: 16,
    status: 'active',
  },
  {
    id: 'miner_hash_beast',
    minerName: 'HashMonster_Nordic',
    rigModel: 'Antminer S19k Pro 120T',
    hashRate: 120000000000000, // 120 TH/s
    efficiency: '23.0 J/TH',
    shares24h: 56300,
    blocksFound: 9,
    satsRewarded: 980000,
    latencyMs: 22,
    status: 'active',
  },
  {
    id: 'miner_bravo_asic',
    minerName: 'Bravo_Rig_Fleet_04',
    rigModel: 'Whatsminer M50S++ 118T',
    hashRate: 95000000000000, // 95 TH/s
    efficiency: '22.8 J/TH',
    shares24h: 44200,
    blocksFound: 7,
    satsRewarded: 740000,
    latencyMs: 19,
    status: 'active',
  },
  {
    id: 'miner_lightning_strike',
    minerName: 'LightningStrike_Miner',
    rigModel: 'Bitmain Antminer T21 190T',
    hashRate: 82000000000000, // 82 TH/s
    efficiency: '19.0 J/TH',
    shares24h: 39800,
    blocksFound: 6,
    satsRewarded: 620000,
    latencyMs: 25,
    status: 'active',
  },
  {
    id: 'miner_cypherpunk_alpha',
    minerName: 'Cypherpunk_Alpha',
    rigModel: 'Canaan AvalonMiner 1346',
    hashRate: 64000000000000, // 64 TH/s
    efficiency: '29.5 J/TH',
    shares24h: 31200,
    blocksFound: 4,
    satsRewarded: 480000,
    latencyMs: 18,
    status: 'active',
  },
  {
    id: 'miner_solar_stacker',
    minerName: 'SolarStacker_Texas',
    rigModel: 'Custom Off-Grid Solar Array',
    hashRate: 48000000000000, // 48 TH/s
    efficiency: '14.2 J/TH',
    shares24h: 24100,
    blocksFound: 3,
    satsRewarded: 360000,
    latencyMs: 31,
    status: 'active',
  },
  {
    id: 'miner_quantum_proof',
    minerName: 'QuantumProof_Lab',
    rigModel: 'Immersion Liquid-Cooled Pod',
    hashRate: 35000000000000, // 35 TH/s
    efficiency: '16.8 J/TH',
    shares24h: 18400,
    blocksFound: 2,
    satsRewarded: 275000,
    latencyMs: 12,
    status: 'cooling',
  },
  {
    id: 'miner_block_chaser',
    minerName: 'BlockChaser_Zero',
    rigModel: 'Antminer S19 Pro 110T',
    hashRate: 28000000000000, // 28 TH/s
    efficiency: '29.5 J/TH',
    shares24h: 14200,
    blocksFound: 2,
    satsRewarded: 210000,
    latencyMs: 28,
    status: 'active',
  },
  {
    id: 'miner_apex_stratum',
    minerName: 'Apex_Stratum_Ops',
    rigModel: 'Whatsminer M30S++ 112T',
    hashRate: 22000000000000, // 22 TH/s
    efficiency: '31.0 J/TH',
    shares24h: 11500,
    blocksFound: 1,
    satsRewarded: 175000,
    latencyMs: 20,
    status: 'active',
  },
  {
    id: 'miner_hydro_beast',
    minerName: 'HydroPulse_Mining_Lab',
    rigModel: 'Antminer S19 XP Hydro 255T',
    hashRate: 19500000000000, // 19.5 TH/s
    efficiency: '20.5 J/TH',
    shares24h: 9800,
    blocksFound: 1,
    satsRewarded: 142000,
    latencyMs: 17,
    status: 'active',
  }
];

interface LeaderboardProps {
  onGoToUpgrades?: () => void;
}

export const TopPoolMinersLeaderboard: React.FC<LeaderboardProps> = ({ onGoToUpgrades }) => {
  const { totalHashRate } = useWallet();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'speed' | 'blocks' | 'rewards' | 'shares'>('speed');
  const [pulseTick, setPulseTick] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Organic slight jitter to simulate live pool network pulse
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseTick((prev) => prev + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setPulseTick((prev) => prev + 1);
      setIsRefreshing(false);
    }, 500);
  };

  // Calculate rankings and share percentages for global miners only (excluding user injection)
  const rankedMiners = useMemo(() => {
    const list = GLOBAL_POOL_MINERS.map((m, idx) => {
      const jitter = 1 + Math.sin(pulseTick + idx) * 0.015; // ±1.5% live fluctuation
      return {
        ...m,
        hashRate: Math.round(m.hashRate * jitter),
      };
    });

    // Sort according to selection
    if (sortBy === 'speed') {
      list.sort((a, b) => b.hashRate - a.hashRate);
    } else if (sortBy === 'blocks') {
      list.sort((a, b) => b.blocksFound - a.blocksFound);
    } else if (sortBy === 'rewards') {
      list.sort((a, b) => b.satsRewarded - a.satsRewarded);
    } else if (sortBy === 'shares') {
      list.sort((a, b) => b.shares24h - a.shares24h);
    }

    const totalPoolHashrate = list.reduce((acc, m) => acc + m.hashRate, 0);

    return list.map((m, index) => ({
      ...m,
      rank: index + 1,
      sharePercent: Number(((m.hashRate / totalPoolHashrate) * 100).toFixed(2)),
    }));
  }, [pulseTick, sortBy]);

  // Pool Aggregates
  const totalPoolHashRate = useMemo(() => {
    return rankedMiners.reduce((acc, m) => acc + m.hashRate, 0);
  }, [rankedMiners]);

  const totalPoolBlocks24h = useMemo(() => {
    return rankedMiners.reduce((acc, m) => acc + m.blocksFound, 0);
  }, [rankedMiners]);

  // Filtered Miners by Search
  const filteredMiners = useMemo(() => {
    if (!searchQuery.trim()) return rankedMiners;
    const q = searchQuery.toLowerCase();
    return rankedMiners.filter(
      (m) =>
        m.minerName.toLowerCase().includes(q) ||
        m.rigModel.toLowerCase().includes(q)
    );
  }, [rankedMiners, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-1">
            <Trophy className="h-4 w-4" />
            <span>Stratum V2 Global Mining Pool</span>
            <span className="text-neutral-600" aria-hidden="true">·</span>
            <span className="text-neutral-400">Live Global Leaderboard</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            Top Pool Miners & Hash Speeds
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
            Real-time hash power distribution, block solvers, and individual rig telemetry across the global Royalty Miner pool.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-neutral-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Stats</span>
          </button>
          {onGoToUpgrades && (
            <button
              onClick={onGoToUpgrades}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-2 text-xs font-bold text-neutral-950 transition-colors cursor-pointer shadow-lg shadow-amber-500/10"
            >
              <Zap className="h-3.5 w-3.5 fill-neutral-950" />
              <span>Go To Mining Station</span>
            </button>
          )}
        </div>
      </div>

      {/* Pool Network Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              Pool Hashrate
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-neutral-100">
            {formatHashRate(totalPoolHashRate)}
          </div>
          <div className="text-[11px] text-neutral-500">Stratum V2 Aggregated</div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-blue-400" />
              Active Rigs
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-neutral-100">
            1,482 Miners
          </div>
          <div className="text-[11px] text-neutral-500">99.8% Online Telemetry</div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-emerald-400" />
              24h Blocks Mined
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
            {totalPoolBlocks24h} Blocks
          </div>
          <div className="text-[11px] text-neutral-500">Valid PoW Solutions</div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              Your Rig Hashrate
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-amber-300">
            {formatSats(totalHashRate)} H/s
          </div>
          <div className="text-[11px] text-neutral-500">Connected Station</div>
        </div>
      </div>

      {/* Controls: Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search miners by alias or ASIC model..."
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 pl-10 pr-3.5 py-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        {/* Sorting Buttons */}
        <div className="flex items-center gap-1.5 rounded-xl bg-neutral-900/70 p-1 border border-neutral-800 text-xs overflow-x-auto">
          <button
            onClick={() => setSortBy('speed')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              sortBy === 'speed'
                ? 'bg-neutral-800 text-amber-300 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Mining Speed
          </button>
          <button
            onClick={() => setSortBy('blocks')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              sortBy === 'blocks'
                ? 'bg-neutral-800 text-amber-300 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Blocks Mined
          </button>
          <button
            onClick={() => setSortBy('shares')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              sortBy === 'shares'
                ? 'bg-neutral-800 text-amber-300 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Shares (24h)
          </button>
          <button
            onClick={() => setSortBy('rewards')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              sortBy === 'rewards'
                ? 'bg-neutral-800 text-amber-300 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Total Rewards
          </button>
        </div>
      </div>

      {/* Leaderboard Miners Table */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950/80 border-b border-neutral-800 text-neutral-400 uppercase tracking-wider text-[10px] font-mono">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Rank</th>
                <th className="py-3.5 px-4 font-semibold">Miner / Station</th>
                <th className="py-3.5 px-4 font-semibold">Rig Hardware</th>
                <th className="py-3.5 px-4 font-semibold text-right">Hash Speed</th>
                <th className="py-3.5 px-4 font-semibold text-right hidden sm:table-cell">Efficiency</th>
                <th className="py-3.5 px-4 font-semibold text-right">Pool Share</th>
                <th className="py-3.5 px-4 font-semibold text-right hidden md:table-cell">Blocks</th>
                <th className="py-3.5 px-4 font-semibold text-right">24h Rewards</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-sans">
              {filteredMiners.map((miner) => {
                const isGold = miner.rank === 1;
                const isSilver = miner.rank === 2;
                const isBronze = miner.rank === 3;

                return (
                  <tr
                    key={miner.id}
                    className={`transition-colors hover:bg-neutral-900/60 ${
                      isGold ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {isGold && (
                          <div className="h-6 w-6 rounded-md bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 font-bold text-xs">
                            🥇
                          </div>
                        )}
                        {isSilver && (
                          <div className="h-6 w-6 rounded-md bg-neutral-300/20 border border-neutral-300/50 flex items-center justify-center text-neutral-200 font-bold text-xs">
                            🥈
                          </div>
                        )}
                        {isBronze && (
                          <div className="h-6 w-6 rounded-md bg-amber-700/20 border border-amber-700/50 flex items-center justify-center text-amber-600 font-bold text-xs">
                            🥉
                          </div>
                        )}
                        {!isGold && !isSilver && !isBronze && (
                          <span className="font-mono text-neutral-400 font-semibold w-6 text-center">
                            #{miner.rank}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Miner Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            miner.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                          }`}
                        />
                        <div>
                          <div className="font-semibold text-neutral-200">
                            {miner.minerName}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {miner.latencyMs}ms ping · Stratum V2
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Hardware */}
                    <td className="py-3.5 px-4 text-neutral-300 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="h-3 w-3 text-neutral-500 shrink-0" />
                        <span className="truncate max-w-[140px] sm:max-w-[200px]">{miner.rigModel}</span>
                      </div>
                    </td>

                    {/* Hash Speed */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-100 whitespace-nowrap">
                      {formatHashRate(miner.hashRate)}
                    </td>

                    {/* Efficiency */}
                    <td className="py-3.5 px-4 text-right font-mono text-neutral-400 text-[11px] hidden sm:table-cell whitespace-nowrap">
                      {miner.efficiency}
                    </td>

                    {/* Pool Share */}
                    <td className="py-3.5 px-4 text-right font-mono text-neutral-200 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{miner.sharePercent}%</span>
                        <div className="w-12 h-1.5 rounded-full bg-neutral-800 overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${Math.min(miner.sharePercent * 3, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Blocks Mined */}
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-400 hidden md:table-cell whitespace-nowrap">
                      {miner.blocksFound}
                    </td>

                    {/* Total Rewards */}
                    <td className="py-3.5 px-4 text-right font-mono text-amber-300 font-semibold whitespace-nowrap">
                      +{formatSats(miner.satsRewarded)} SATS
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-neutral-950/60 border-t border-neutral-800/80 text-[11px] text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Stratum V2 Protocol Pool · Block Rewards distributed via PPLNS system</span>
          <span className="text-neutral-400 font-mono">Last hash retarget: Block #884,912</span>
        </div>
      </div>
    </div>
  );
};
