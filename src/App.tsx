import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { WalletProvider } from './context/WalletContext';
import { TopBar } from './components/TopBar';
import { NetworkStatsBar } from './components/NetworkStatsBar';
import { FaucetSection } from './components/FaucetSection';
import { DailyStreakTracker } from './components/DailyStreakTracker';
import { MiningSection } from './components/MiningSection';
import { QuizSection } from './components/QuizSection';
import { TasksSection } from './components/TasksSection';
import { MultiplierSection } from './components/MultiplierSection';
import { LedgerSection } from './components/LedgerSection';
import { TopPoolMinersLeaderboard } from './components/TopPoolMinersLeaderboard';
import { WalletModal } from './components/WalletModal';
import { AuthModal } from './components/AuthModal';
import { testFirestoreConnection } from './lib/firebase';

function AppContent() {
  const [activeTab, setActiveTab] = useState<string>('mining');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup' | 'forgot'>('login');

  useEffect(() => {
    // Validate connection to Firestore on initial boot per SKILL.md
    testFirestoreConnection();
  }, []);

  const handleOpenAuth = (mode: 'login' | 'signup' | 'forgot' = 'login') => {
    setAuthInitialMode(mode);
    setIsAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Navigation conforming to Top Bar Contract */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenWithdraw={() => setIsWalletModalOpen(true)}
        onOpenAuth={handleOpenAuth}
      />

      {/* Network Pulse & Satoshi Ticker */}
      <NetworkStatsBar />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'faucet' && (
          <FaucetSection
            onGoToMining={() => setActiveTab('mining')}
            onGoToQuiz={() => setActiveTab('quiz')}
            onGoToDailyStreak={() => setActiveTab('daily-streak')}
          />
        )}

        {activeTab === 'daily-streak' && <DailyStreakTracker />}

        {activeTab === 'mining' && (
          <MiningSection onOpenLeaderboard={() => setActiveTab('pool-miners')} />
        )}

        {activeTab === 'pool-miners' && (
          <TopPoolMinersLeaderboard onGoToUpgrades={() => setActiveTab('mining')} />
        )}

        {activeTab === 'quiz' && <QuizSection />}

        {activeTab === 'tasks' && <TasksSection />}

        {activeTab === 'multiplier' && <MultiplierSection />}

        {activeTab === 'ledger' && (
          <LedgerSection onOpenWithdraw={() => setIsWalletModalOpen(true)} />
        )}
      </main>

      {/* Footer conforming to anti-slop guidelines */}
      <footer className="w-full border-t border-neutral-900 bg-neutral-950/80 py-8 px-4 text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-400">SatoshiMining</span>
            <span className="text-neutral-700" aria-hidden="true">·</span>
            <span>1 BTC = 100,000,000 Satoshis</span>
          </div>

          <div className="text-center sm:text-right text-[11px] text-neutral-600">
            &quot;If you don&apos;t believe it or don&apos;t get it, I don&apos;t have the time to convince you, sorry.&quot; — Satoshi Nakamoto, 2010
          </div>
        </div>
      </footer>

      {/* Wallet Modal */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />

      {/* Auth Modal (Sign Up, Log In, Forgot Password) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authInitialMode}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WalletProvider>
        <AppContent />
      </WalletProvider>
    </AuthProvider>
  );
}
