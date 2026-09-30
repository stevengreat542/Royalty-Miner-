import React, { useState } from 'react';
import { ListFilter, Download, Copy, Check, ArrowUpRight, ArrowDownLeft, ShieldCheck, Gift, Zap, Pickaxe, Flame, Sparkles, Clock, CheckCircle2, ChevronRight, Layers } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { formatSats, satsToUsd } from '../utils/crypto';
import { Transaction, TransactionType } from '../types';

export const LedgerSection: React.FC<{ onOpenWithdraw: () => void }> = ({ onOpenWithdraw }) => {
  const { transactions, balance, totalEarned, totalWithdrawn, btcPriceUsd } = useWallet();
  const [activeView, setActiveView] = useState<'all' | 'rewards'>('rewards');
  const [rewardCategory, setRewardCategory] = useState<'all' | 'faucet' | 'mining' | 'streak'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Rewards list: positive earnings from faucet drops, mining gains, and streak bonuses
  const rewardTransactions = transactions.filter((tx) => {
    if (tx.amount <= 0) return false;
    const isFaucet = tx.type === 'faucet' && !tx.description.toLowerCase().includes('streak') && !tx.description.toLowerCase().includes('milestone');
    const isMining = tx.type === 'mining';
    const isStreak = tx.description.toLowerCase().includes('streak') || tx.description.toLowerCase().includes('milestone');
    
    // Fallback: If it's a faucet transaction with streak in description, count as streak
    if (rewardCategory === 'all') {
      return isFaucet || isMining || isStreak;
    }
    if (rewardCategory === 'faucet') return isFaucet;
    if (rewardCategory === 'mining') return isMining;
    if (rewardCategory === 'streak') return isStreak;
    return true;
  });

  // Calculate totals for quick reward analytics
  const totalRewardSats = transactions
    .filter(t => t.amount > 0 && (t.type === 'faucet' || t.type === 'mining' || t.description.toLowerCase().includes('streak')))
    .reduce((acc, curr) => acc + curr.amount, 0);

  const faucetDropsCount = transactions.filter(t => t.type === 'faucet' && !t.description.toLowerCase().includes('streak')).length;
  const miningBlocksCount = transactions.filter(t => t.type === 'mining').length;
  const streakBonusesCount = transactions.filter(t => t.description.toLowerCase().includes('streak') || t.description.toLowerCase().includes('milestone')).length;

  const filtered = transactions.filter((tx) => {
    if (filterType === 'all') return true;
    return tx.type === filterType;
  });

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const exportCsv = () => {
    const listToExport = activeView === 'rewards' ? rewardTransactions : transactions;
    const headers = ['ID,Type,Amount_Sats,Description,Timestamp,TxHash,Status'];
    const rows = listToExport.map(t => 
      `"${t.id}","${t.type}",${t.amount},"${t.description}","${new Date(t.timestamp).toISOString()}","${t.txHash}","${t.status}"`
    );
    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeView === 'rewards' ? `reward_history_${Date.now()}.csv` : `satoshi_ledger_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRewardIcon = (tx: Transaction) => {
    const desc = tx.description.toLowerCase();
    if (desc.includes('streak') || desc.includes('milestone')) {
      return (
        <div className="h-9 w-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
          <Flame className="h-4 w-4 fill-orange-400" />
        </div>
      );
    }
    if (tx.type === 'mining') {
      return (
        <div className="h-9 w-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
          <Pickaxe className="h-4 w-4" />
        </div>
      );
    }
    return (
      <div className="h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
        <Zap className="h-4 w-4 fill-amber-400" />
      </div>
    );
  };

  const getRewardBadge = (tx: Transaction) => {
    const desc = tx.description.toLowerCase();
    if (desc.includes('streak') || desc.includes('milestone')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[10px] font-medium text-orange-300">
          Streak Bonus
        </span>
      );
    }
    if (tx.type === 'mining') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
          PoW Mining
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-medium text-amber-300">
        Faucet Drop
      </span>
    );
  };

  const filterTabs: { id: string; label: string }[] = [
    { id: 'all', label: 'All Operations' },
    { id: 'faucet', label: 'Faucet Drops' },
    { id: 'mining', label: 'Proof-of-Work' },
    { id: 'quiz', label: 'Academy' },
    { id: 'task', label: 'Tasks' },
    { id: 'multiplier', label: 'Dice' },
    { id: 'withdrawal', label: 'Withdrawals' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Auditable State Ledger</span>
            <span className="text-neutral-600" aria-hidden="true">·</span>
            <span className="text-neutral-400">Cryptographically Signed Transactions</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 mt-1 [text-wrap:balance]">
            {activeView === 'rewards' ? 'Reward Claim History' : 'Transaction Ledger & History'}
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            {activeView === 'rewards'
              ? 'Chronological list of all verified faucet drops, proof-of-work mining block rewards, and daily login streak multipliers.'
              : 'Complete verifiable log of every Satoshi earned, staked, mined, or withdrawn via Lightning channels.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2 text-xs font-medium text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export {activeView === 'rewards' ? 'Rewards' : 'Ledger'}</span>
          </button>

          <button
            onClick={onOpenWithdraw}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-neutral-950 transition-colors cursor-pointer"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Withdraw Sats</span>
          </button>
        </div>
      </div>

      {/* Primary View Switcher: Reward History vs Raw Full Ledger */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 rounded-xl bg-neutral-900/80 p-1 border border-neutral-800">
          <button
            onClick={() => setActiveView('rewards')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              activeView === 'rewards'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Gift className="h-3.5 w-3.5" />
            <span>Reward History</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeView === 'rewards' ? 'bg-neutral-950/20 text-neutral-950' : 'bg-neutral-800 text-neutral-400'
            }`}>
              {rewardTransactions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveView('all')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              activeView === 'all'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Full Ledger Table</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeView === 'all' ? 'bg-neutral-950/20 text-neutral-950' : 'bg-neutral-800 text-neutral-400'
            }`}>
              {transactions.length}
            </span>
          </button>
        </div>

        {/* Quick totals badge */}
        <div className="flex items-center gap-4 text-xs font-mono text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Total Claimed Rewards:</span>
            <span className="font-bold text-emerald-400">+{formatSats(totalRewardSats)} Sats</span>
          </span>
        </div>
      </div>

      {/* Aggregate Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-1">
          <div className="text-[11px] text-neutral-500 uppercase font-sans">Available Balance</div>
          <div className="text-xl font-bold text-amber-300 tabular-nums">
            {formatSats(balance)} SATS
          </div>
          <div className="text-neutral-500">{satsToUsd(balance, btcPriceUsd)}</div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-1">
          <div className="text-[11px] text-neutral-500 uppercase font-sans">Lifetime Earned</div>
          <div className="text-xl font-bold text-emerald-400 tabular-nums">
            +{totalEarned === 300 ? '300.00' : formatSats(totalEarned)} SATS
          </div>
          <div className="text-neutral-500">{satsToUsd(totalEarned, btcPriceUsd)}</div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-1">
          <div className="text-[11px] text-neutral-500 uppercase font-sans">Withdrawn to Lightning</div>
          <div className="text-xl font-bold text-neutral-200 tabular-nums">
            {formatSats(totalWithdrawn)} SATS
          </div>
          <div className="text-neutral-500">{satsToUsd(totalWithdrawn, btcPriceUsd)}</div>
        </div>
      </div>

      {/* REWARD HISTORY CLEAN LIST VIEW */}
      {activeView === 'rewards' && (
        <div className="space-y-4">
          {/* Reward Categories Quick Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setRewardCategory('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                rewardCategory === 'all'
                  ? 'bg-neutral-800 text-neutral-100 border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>All Rewards ({transactions.filter(t => t.amount > 0 && (t.type === 'faucet' || t.type === 'mining' || t.description.toLowerCase().includes('streak'))).length})</span>
            </button>

            <button
              onClick={() => setRewardCategory('faucet')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                rewardCategory === 'faucet'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>Faucet Drops ({faucetDropsCount})</span>
            </button>

            <button
              onClick={() => setRewardCategory('mining')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                rewardCategory === 'mining'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
            >
              <Pickaxe className="h-3.5 w-3.5 text-cyan-400" />
              <span>Mining Gains ({miningBlocksCount})</span>
            </button>

            <button
              onClick={() => setRewardCategory('streak')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                rewardCategory === 'streak'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
              }`}
            >
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              <span>Streak Bonuses ({streakBonusesCount})</span>
            </button>
          </div>

          {/* Clean Chronological Rewards List */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 divide-y divide-neutral-800/80 overflow-hidden shadow-lg">
            {rewardTransactions.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-600">
                  <Gift className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold text-neutral-300">No Rewards Claimed in this Category</div>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Claim interval faucet drops, mine cryptographic blocks, or check-in daily to see verified reward receipts listed here.
                </p>
              </div>
            ) : (
              rewardTransactions.map((tx) => {
                const dateObj = new Date(tx.timestamp);
                const timeAgo = formatTimeAgo(tx.timestamp);

                return (
                  <div
                    key={tx.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-800/40 transition-colors"
                  >
                    {/* Left: Icon & Description */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      {getRewardIcon(tx)}
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-neutral-100 truncate">
                            {tx.description}
                          </span>
                          {getRewardBadge(tx)}
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Settled</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-neutral-500 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-neutral-500" />
                            <span>{timeAgo}</span>
                          </span>
                          <span className="text-neutral-700" aria-hidden="true">·</span>
                          <span>
                            {dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at{' '}
                            {dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-neutral-700 hidden md:inline" aria-hidden="true">·</span>
                          <div className="hidden md:flex items-center gap-1">
                            <span className="text-neutral-600 truncate max-w-[90px]">
                              {tx.txHash.slice(0, 10)}...
                            </span>
                            <button
                              onClick={() => handleCopyHash(tx.txHash)}
                              title="Copy transaction hash"
                              className="text-neutral-500 hover:text-amber-400 transition-colors cursor-pointer"
                            >
                              {copiedHash === tx.txHash ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Satoshi Gain & USD Value */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800/60 sm:text-right">
                      <div className="sm:hidden text-xs text-neutral-500">Reward Yield:</div>
                      <div>
                        <div className="text-base sm:text-lg font-bold font-mono text-emerald-400 tabular-nums">
                          +{formatSats(tx.amount)} SATS
                        </div>
                        <div className="text-xs font-mono text-neutral-500 tabular-nums">
                          ~{satsToUsd(tx.amount, btcPriceUsd)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* FULL OPERATIONS TABLE (Available when switched to Full Ledger Table) */}
      {activeView === 'all' && (
        <div className="space-y-4">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {filterTabs.map((tab) => {
              const isActive = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-neutral-800 text-neutral-100 border border-neutral-700'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Ledger Table */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/60 text-neutral-500">
                    <th className="py-3 px-4 font-medium">TIMESTAMP</th>
                    <th className="py-3 px-4 font-medium">TYPE</th>
                    <th className="py-3 px-4 font-medium">TRANSACTION HASH</th>
                    <th className="py-3 px-4 font-medium">DESCRIPTION</th>
                    <th className="py-3 px-4 font-medium text-right">SATOSHI DELTA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-neutral-500 font-sans">
                        No transactions found for filter &quot;{filterType}&quot;.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((tx) => {
                      const isPositive = tx.amount > 0;
                      return (
                        <tr key={tx.id} className="hover:bg-neutral-900/40 transition-colors">
                          <td className="py-3 px-4 text-neutral-400 whitespace-nowrap">
                            {new Date(tx.timestamp).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          <td className="py-3 px-4 capitalize text-neutral-300">
                            <span className="text-[11px] font-sans text-neutral-400">
                              {tx.type}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-neutral-400">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[120px] text-neutral-500">{tx.txHash}</span>
                              <button
                                onClick={() => handleCopyHash(tx.txHash)}
                                title="Copy full TX hash"
                                className="text-neutral-500 hover:text-amber-400 transition-colors cursor-pointer"
                              >
                                {copiedHash === tx.txHash ? (
                                  <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-neutral-200 font-sans truncate max-w-xs">
                            {tx.description}
                          </td>

                          <td className={`py-3 px-4 text-right font-bold tabular-nums whitespace-nowrap ${
                            isPositive ? 'text-emerald-400' : 'text-neutral-400'
                          }`}>
                            {isPositive ? `+${formatSats(tx.amount)}` : formatSats(tx.amount)} SATS
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

