import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Transaction, TransactionType, MiningUpgrade } from '../types';
import { INITIAL_TRANSACTIONS, INITIAL_UPGRADES, DAILY_STREAK_TIERS, STREAK_MILESTONES } from '../data/mockData';
import { randomHex } from '../utils/crypto';
import { sound } from '../utils/audio';

interface WalletContextType {
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  streakDays: number;
  lastClaimTime: number | null;
  faucetCooldownSeconds: number;
  isFaucetReady: boolean;
  timeRemainingSeconds: number;
  transactions: Transaction[];
  upgrades: MiningUpgrade[];
  completedQuizIds: string[];
  completedTaskIds: string[];
  btcPriceUsd: number;
  soundEnabled: boolean;
  totalHashRate: number;
  blockBonusMultiplier: number;
  
  // Daily Login Streak System
  dailyLoginStreak: number;
  maxDailyStreak: number;
  simulatedDayOffset: number;
  isTodayLoginClaimed: boolean;
  dailyTimeRemainingSeconds: number;
  streakShieldActive: boolean;
  claimedMilestoneIds: string[];
  totalStreakSatsEarned: number;
  claimDailyLogin: () => { success: boolean; amount: number; day: number };
  simulateNextDay: () => void;
  activateStreakShield: () => boolean;
  claimStreakMilestone: (milestoneId: string) => boolean;
  resetDailyStreak: () => void;
  
  // Actions
  addSats: (amount: number, type: TransactionType, description: string) => Transaction;
  spendSats: (amount: number, type: TransactionType, description: string) => boolean;
  claimFaucet: () => { success: boolean; amount: number; streak: number };
  buyUpgrade: (upgradeId: string) => boolean;
  completeQuizQuestion: (questionId: string, reward: number) => void;
  completeTask: (taskId: string, reward: number) => void;
  withdrawSats: (amount: number, destination: string, memo?: string) => { success: boolean; tx?: Transaction; error?: string };
  toggleSound: () => void;
  fireConfetti: () => void;
  resetFaucetCooldown: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const FAUCET_COOLDOWN_SEC = 600; // 10 minutes standard cooldown (with test reset affordance)
const DAILY_COOLDOWN_SEC = 24 * 60 * 60; // 24 hours (86,400 seconds)
const STORAGE_KEY = 'satoshistack_v1_state';

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load from localStorage or defaults
  const [balance, setBalance] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_balance`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // If it was the previously default 100,000 or greater, calibrate to user's 88,012 sats
        if (parsed >= 100000) {
          localStorage.setItem(`${STORAGE_KEY}_balance`, '88012');
          return 88012;
        }
        return parsed;
      }
      return 88012; // Calibrated balance to 88,012 Sats
    } catch {
      return 88012;
    }
  });

  const [totalEarned, setTotalEarned] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_totalEarned`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed > 300) {
          try {
            localStorage.setItem(`${STORAGE_KEY}_totalEarned`, '300');
          } catch {}
          return 300;
        }
        return parsed;
      }
      return 300;
    } catch {
      return 300;
    }
  });

  const [totalWithdrawn, setTotalWithdrawn] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_totalWithdrawn`);
      return saved ? JSON.parse(saved) : 0;
    } catch {
      return 0;
    }
  });

  const [streakDays, setStreakDays] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_streak`);
      return saved ? JSON.parse(saved) : 1;
    } catch {
      return 1;
    }
  });

  const [lastClaimTime, setLastClaimTime] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_lastClaim`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_txs`);
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  const [upgrades, setUpgrades] = useState<MiningUpgrade[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_upgrades`);
      if (saved) {
        const parsed: MiningUpgrade[] = JSON.parse(saved);
        // Ensure all upgrades respect requested pricing:
        // cpu_threads -> 10, gpu_acceleration -> 10, asic_rig -> 10, solar_substation -> 20, twenty_four_miner -> 30
        const merged = INITIAL_UPGRADES.map(initU => {
          const found = parsed.find(p => p.id === initU.id);
          if (found) {
            let currentCost = found.cost;
            if (found.id === 'cpu_threads') {
              currentCost = 10;
            } else if (found.id === 'gpu_acceleration') {
              currentCost = 10;
            } else if (found.id === 'asic_rig') {
              currentCost = 10;
            } else if (found.id === 'solar_substation') {
              currentCost = 20;
            } else if (found.id === 'twenty_four_miner') {
              currentCost = 30;
            }
            return { ...initU, level: found.level, cost: currentCost };
          }
          return initU;
        });
        return merged;
      }
      return INITIAL_UPGRADES;
    } catch {
      return INITIAL_UPGRADES;
    }
  });

  const [completedQuizIds, setCompletedQuizIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_quizzes`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_tasks`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_sound`);
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Daily Login Streak States
  const [dailyLoginStreak, setDailyLoginStreak] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_dailyStreak`);
      return saved ? JSON.parse(saved) : 1;
    } catch {
      return 1;
    }
  });

  const [lastDailyClaimTime, setLastDailyClaimTime] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_lastDailyClaim`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [dailyTimeRemainingSeconds, setDailyTimeRemainingSeconds] = useState<number>(0);

  const [maxDailyStreak, setMaxDailyStreak] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_maxDailyStreak`);
      return saved ? JSON.parse(saved) : 1;
    } catch {
      return 1;
    }
  });

  const [simulatedDayOffset, setSimulatedDayOffset] = useState<number>(0);

  const [isTodayLoginClaimed, setIsTodayLoginClaimed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_isTodayClaimed`);
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [streakShieldActive, setStreakShieldActive] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_streakShield`);
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [claimedMilestoneIds, setClaimedMilestoneIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_claimedMilestones`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [totalStreakSatsEarned, setTotalStreakSatsEarned] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_streakSatsEarned`);
      return saved ? JSON.parse(saved) : 0;
    } catch {
      return 0;
    }
  });

  // BTC Price
  const [btcPriceUsd, setBtcPriceUsd] = useState<number>(88450);

  // Auto-reduce legacy inflated totalEarned (e.g. 101,082) down to 300
  useEffect(() => {
    if (totalEarned > 300) {
      setTotalEarned(300);
      try {
        localStorage.setItem(`${STORAGE_KEY}_totalEarned`, '300');
      } catch {}
    }
  }, [totalEarned]);

  // Sync sound utility state
  useEffect(() => {
    sound.enabled = soundEnabled;
  }, [soundEnabled]);

  // Minor simulated price drift for organic live market feel (±0.02%)
  useEffect(() => {
    const interval = setInterval(() => {
      setBtcPriceUsd(prev => {
        const delta = (Math.random() - 0.49) * 25;
        return Math.round((prev + delta) * 100) / 100;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_balance`, JSON.stringify(balance));
    localStorage.setItem(`${STORAGE_KEY}_totalEarned`, JSON.stringify(totalEarned));
    localStorage.setItem(`${STORAGE_KEY}_totalWithdrawn`, JSON.stringify(totalWithdrawn));
    localStorage.setItem(`${STORAGE_KEY}_streak`, JSON.stringify(streakDays));
    localStorage.setItem(`${STORAGE_KEY}_lastClaim`, JSON.stringify(lastClaimTime));
    localStorage.setItem(`${STORAGE_KEY}_txs`, JSON.stringify(transactions));
    localStorage.setItem(`${STORAGE_KEY}_upgrades`, JSON.stringify(upgrades));
    localStorage.setItem(`${STORAGE_KEY}_quizzes`, JSON.stringify(completedQuizIds));
    localStorage.setItem(`${STORAGE_KEY}_tasks`, JSON.stringify(completedTaskIds));
    localStorage.setItem(`${STORAGE_KEY}_sound`, JSON.stringify(soundEnabled));
    localStorage.setItem(`${STORAGE_KEY}_dailyStreak`, JSON.stringify(dailyLoginStreak));
    localStorage.setItem(`${STORAGE_KEY}_lastDailyClaim`, JSON.stringify(lastDailyClaimTime));
    localStorage.setItem(`${STORAGE_KEY}_maxDailyStreak`, JSON.stringify(maxDailyStreak));
    localStorage.setItem(`${STORAGE_KEY}_isTodayClaimed`, JSON.stringify(isTodayLoginClaimed));
    localStorage.setItem(`${STORAGE_KEY}_streakShield`, JSON.stringify(streakShieldActive));
    localStorage.setItem(`${STORAGE_KEY}_claimedMilestones`, JSON.stringify(claimedMilestoneIds));
    localStorage.setItem(`${STORAGE_KEY}_streakSatsEarned`, JSON.stringify(totalStreakSatsEarned));
  }, [
    balance,
    totalEarned,
    totalWithdrawn,
    streakDays,
    lastClaimTime,
    transactions,
    upgrades,
    completedQuizIds,
    completedTaskIds,
    soundEnabled,
    dailyLoginStreak,
    lastDailyClaimTime,
    maxDailyStreak,
    isTodayLoginClaimed,
    streakShieldActive,
    claimedMilestoneIds,
    totalStreakSatsEarned,
  ]);

  // Timer countdown calculations
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    const checkTimer = () => {
      if (!lastClaimTime) {
        setTimeRemainingSeconds(0);
        return;
      }
      const elapsed = Math.floor((Date.now() - lastClaimTime) / 1000);
      const remaining = Math.max(0, FAUCET_COOLDOWN_SEC - elapsed);
      setTimeRemainingSeconds(remaining);
    };

    checkTimer();
    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [lastClaimTime]);

  // 24-hour Daily Claim Timer
  useEffect(() => {
    const checkDailyTimer = () => {
      if (!lastDailyClaimTime) {
        setDailyTimeRemainingSeconds(0);
        setIsTodayLoginClaimed(false);
        return;
      }
      const elapsed = Math.floor((Date.now() - lastDailyClaimTime) / 1000);
      const remaining = Math.max(0, DAILY_COOLDOWN_SEC - elapsed);
      setDailyTimeRemainingSeconds(remaining);
      if (remaining > 0) {
        setIsTodayLoginClaimed(true);
      } else {
        setIsTodayLoginClaimed(false);
      }
    };

    checkDailyTimer();
    const interval = setInterval(checkDailyTimer, 1000);
    return () => clearInterval(interval);
  }, [lastDailyClaimTime]);

  const isFaucetReady = timeRemainingSeconds === 0;

  // Hash rate and multiplier totals from upgrades
  const totalHashRate = upgrades.reduce((acc, u) => acc + (u.level * u.hashRateBoost), 25); // base 25 H/s
  const blockBonusMultiplier = upgrades.reduce((acc, u) => acc * Math.pow(u.blockBonusMultiplier, u.level), 1.0);

  const fireConfetti = useCallback(() => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#f59e0b', '#fbbf24', '#fef3c7', '#d97706'],
      });
    } catch {
      // safe fallback
    }
  }, []);

  const addSats = useCallback((amount: number, type: TransactionType, description: string): Transaction => {
    const tx: Transaction = {
      id: `tx_${Date.now()}_${randomHex(6)}`,
      type,
      amount,
      description,
      timestamp: Date.now(),
      txHash: randomHex(64),
      status: 'confirmed',
    };

    setBalance(prev => prev + amount);
    setTotalEarned(prev => prev + amount);
    setTransactions(prev => [tx, ...prev.slice(0, 99)]); // keep latest 100 txs

    sound.playCoin();
    return tx;
  }, []);

  const spendSats = useCallback((amount: number, type: TransactionType, description: string): boolean => {
    if (balance < amount) return false;

    const tx: Transaction = {
      id: `tx_${Date.now()}_${randomHex(6)}`,
      type,
      amount: -amount,
      description,
      timestamp: Date.now(),
      txHash: randomHex(64),
      status: 'confirmed',
    };

    setBalance(prev => prev - amount);
    setTransactions(prev => [tx, ...prev.slice(0, 99)]);
    return true;
  }, [balance]);

  const claimFaucet = useCallback(() => {
    if (!isFaucetReady) {
      return { success: false, amount: 0, streak: streakDays };
    }

    // Base payout: 100 sats (increased from 50)
    // Multiplier based on daily streak: 1.0x to 2.0x
    const streakMultiplier = 1 + Math.min(streakDays - 1, 6) * 0.15;
    const basePayout = 100;
    const payout = Math.round(basePayout * streakMultiplier);

    const now = Date.now();
    setLastClaimTime(now);

    // Increment streak if within 28 hours of last claim, else reset to 1
    if (lastClaimTime && now - lastClaimTime > 28 * 3600 * 1000) {
      setStreakDays(1);
    } else {
      setStreakDays(prev => Math.min(prev + 1, 30));
    }

    addSats(payout, 'faucet', `Lightning Faucet Claim (${streakMultiplier.toFixed(2)}x Streak Bonus)`);
    fireConfetti();

    return { success: true, amount: payout, streak: streakDays };
  }, [isFaucetReady, streakDays, lastClaimTime, addSats, fireConfetti]);

  const resetFaucetCooldown = useCallback(() => {
    setLastClaimTime(null);
    setTimeRemainingSeconds(0);
  }, []);

  const buyUpgrade = useCallback((upgradeId: string): boolean => {
    const upgrade = upgrades.find(u => u.id === upgradeId);
    if (!upgrade) return false;
    if (upgrade.level >= upgrade.maxLevel) return false;
    if (balance < upgrade.cost) return false;

    // Deduct cost
    const success = spendSats(upgrade.cost, 'mining', `Upgrade: ${upgrade.name} (Level ${upgrade.level + 1})`);
    if (!success) return false;

    setUpgrades(prev => prev.map(u => {
      if (u.id === upgradeId) {
        return {
          ...u,
          level: u.level + 1,
          cost: Math.round(u.cost * 1.6),
        };
      }
      return u;
    }));

    sound.playWin();
    return true;
  }, [upgrades, balance, spendSats]);

  const completeQuizQuestion = useCallback((questionId: string, reward: number) => {
    if (completedQuizIds.includes(questionId)) return;
    setCompletedQuizIds(prev => [...prev, questionId]);
    addSats(reward, 'quiz', `Quiz Passed: Question #${questionId}`);
    fireConfetti();
  }, [completedQuizIds, addSats, fireConfetti]);

  const completeTask = useCallback((taskId: string, reward: number) => {
    if (completedTaskIds.includes(taskId)) return;
    setCompletedTaskIds(prev => [...prev, taskId]);
    addSats(reward, 'task', `Task Completed: ${taskId.replace('task_', '').replace(/_/g, ' ')}`);
    sound.playBlockFound();
    fireConfetti();
  }, [completedTaskIds, addSats, fireConfetti]);

  const withdrawSats = useCallback((amount: number, destination: string, memo: string = 'Lightning Payout'): { success: boolean; tx?: Transaction; error?: string } => {
    if (balance < 100000) {
      return { success: false, error: `Balance is only ${balance.toLocaleString()} Sats. You must reach at least 100,000 Sats to withdraw.` };
    }
    if (amount < 100000) {
      return { success: false, error: 'Minimum Lightning withdrawal is 100,000 Satoshis. Little amounts are not permitted.' };
    }
    if (amount > balance) {
      return { success: false, error: `Amount exceeds current balance (${balance.toLocaleString()} Sats).` };
    }
    if (!destination.trim()) {
      return { success: false, error: 'Enter a valid Lightning address or invoice' };
    }

    const shortDest = destination.length > 24 
      ? `${destination.slice(0, 10)}...${destination.slice(-6)}` 
      : destination;

    const tx: Transaction = {
      id: `tx_${Date.now()}_${randomHex(6)}`,
      type: 'withdrawal',
      amount: -amount,
      description: `Sent to ${shortDest}${memo ? ` (${memo})` : ''}`,
      timestamp: Date.now(),
      txHash: randomHex(64),
      status: 'confirmed',
    };

    setBalance(prev => Math.max(0, prev - amount));
    setTotalWithdrawn(prev => prev + amount);
    setTransactions(prev => [tx, ...prev.slice(0, 99)]);

    sound.playLightningZap();
    return { success: true, tx };
  }, [balance]);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  // Daily Streak Functions
  const claimDailyLogin = useCallback(() => {
    if (isTodayLoginClaimed || dailyTimeRemainingSeconds > 0) {
      return { success: false, amount: 0, day: dailyLoginStreak };
    }

    const dayCycle = (dailyLoginStreak - 1) % 7;
    const tier = DAILY_STREAK_TIERS[dayCycle];
    const baseReward = dailyLoginStreak > 7 
      ? 30000 + (dailyLoginStreak - 7) * 2500 
      : tier.rewardSats;

    const currentDay = dailyLoginStreak;
    const now = Date.now();
    setLastDailyClaimTime(now);
    setDailyTimeRemainingSeconds(DAILY_COOLDOWN_SEC);
    setIsTodayLoginClaimed(true);

    const nextStreak = dailyLoginStreak + 1;
    setDailyLoginStreak(nextStreak);
    setMaxDailyStreak(m => Math.max(m, nextStreak));
    setTotalStreakSatsEarned(prev => prev + baseReward);

    addSats(baseReward, 'faucet', `Day ${currentDay} Daily Login Streak Bonus`);
    sound.playBlockFound();
    fireConfetti();

    return { success: true, amount: baseReward, day: currentDay };
  }, [isTodayLoginClaimed, dailyTimeRemainingSeconds, dailyLoginStreak, addSats, fireConfetti]);

  const simulateNextDay = useCallback(() => {
    setSimulatedDayOffset(prev => prev + 1);
    
    if (!isTodayLoginClaimed) {
      if (streakShieldActive) {
        setStreakShieldActive(false);
      } else {
        setDailyLoginStreak(1);
      }
    }
    
    setIsTodayLoginClaimed(false);
    setDailyTimeRemainingSeconds(0);
  }, [isTodayLoginClaimed, streakShieldActive]);

  const activateStreakShield = useCallback((): boolean => {
    if (streakShieldActive) return false;
    const cost = 120;
    if (balance < cost) return false;

    const paid = spendSats(cost, 'faucet', 'Activated Daily Streak Freeze Shield');
    if (!paid) return false;

    setStreakShieldActive(true);
    sound.playWin();
    return true;
  }, [streakShieldActive, balance, spendSats]);

  const claimStreakMilestone = useCallback((milestoneId: string): boolean => {
    if (claimedMilestoneIds.includes(milestoneId)) return false;
    const milestone = STREAK_MILESTONES.find(m => m.id === milestoneId);
    if (!milestone) return false;
    if (dailyLoginStreak < milestone.targetDays) return false;

    setClaimedMilestoneIds(prev => [...prev, milestoneId]);
    addSats(milestone.rewardSats, 'faucet', `Milestone Bonus: ${milestone.title}`);
    sound.playBlockFound();
    fireConfetti();
    return true;
  }, [claimedMilestoneIds, dailyLoginStreak, addSats, fireConfetti]);

  const resetDailyStreak = useCallback(() => {
    setDailyLoginStreak(1);
    setLastDailyClaimTime(null);
    setDailyTimeRemainingSeconds(0);
    setIsTodayLoginClaimed(false);
    setStreakShieldActive(false);
    setSimulatedDayOffset(0);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        balance,
        totalEarned,
        totalWithdrawn,
        streakDays,
        lastClaimTime,
        faucetCooldownSeconds: FAUCET_COOLDOWN_SEC,
        isFaucetReady,
        timeRemainingSeconds,
        transactions,
        upgrades,
        completedQuizIds,
        completedTaskIds,
        btcPriceUsd,
        soundEnabled,
        totalHashRate,
        blockBonusMultiplier,
        dailyLoginStreak,
        maxDailyStreak,
        simulatedDayOffset,
        isTodayLoginClaimed,
        dailyTimeRemainingSeconds,
        streakShieldActive,
        claimedMilestoneIds,
        totalStreakSatsEarned,
        claimDailyLogin,
        simulateNextDay,
        activateStreakShield,
        claimStreakMilestone,
        resetDailyStreak,
        addSats,
        spendSats,
        claimFaucet,
        buyUpgrade,
        completeQuizQuestion,
        completeTask,
        withdrawSats,
        toggleSound,
        fireConfetti,
        resetFaucetCooldown,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
