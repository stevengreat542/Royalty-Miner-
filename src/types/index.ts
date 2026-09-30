export type TransactionType = 
  | 'faucet' 
  | 'mining' 
  | 'quiz' 
  | 'task' 
  | 'multiplier' 
  | 'withdrawal' 
  | 'deposit';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number; // in Satoshis (positive for earn, negative for withdrawal/loss)
  description: string;
  timestamp: number;
  txHash: string;
  status: 'confirmed' | 'pending';
}

export interface TaskItem {
  id: string;
  title: string;
  category: 'node' | 'security' | 'education' | 'community' | 'lightning';
  reward: number; // in Satoshis
  duration: string;
  description: string;
  isCompleted: boolean;
  stepCount: number;
  steps: string[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  satReward: number;
  category: string;
}

export interface MiningUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  hashRateBoost: number; // hashes per second
  blockBonusMultiplier: number;
  level: number;
  maxLevel: number;
}

export interface MinedBlock {
  blockHeight: number;
  nonce: number;
  hash: string;
  timestamp: number;
  rewardSats: number;
  difficultyTarget: string;
}

export interface DailyStreakReward {
  day: number;
  rewardSats: number;
  bonusMultiplier: number;
  perkDescription: string;
  isMilestone?: boolean;
}

export interface StreakMilestone {
  id: string;
  targetDays: number;
  title: string;
  badge: string;
  rewardSats: number;
  description: string;
  claimed: boolean;
}

export interface LightningInvoice {
  paymentRequest: string;
  paymentHash: string;
  amountSats: number;
  memo: string;
  timestamp: number;
  expiresAt: number;
  settled: boolean;
}
