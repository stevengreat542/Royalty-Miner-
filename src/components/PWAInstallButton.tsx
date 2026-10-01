import React, { useState } from 'react';
import { Download, Smartphone, X, Check, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'topbar' | 'banner' | 'modal';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'topbar', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState<boolean>(false);
  const [installedSuccess, setInstalledSuccess] = useState<boolean>(false);

  // If already installed in standalone mode, hide the install trigger
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setInstalledSuccess(true);
        setTimeout(() => setInstalledSuccess(false), 3000);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Fallback for browsers that haven't triggered beforeinstallprompt yet or standard Chrome desktop
      // Show guided install toast or trigger prompt
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        title="Install Royalty Miner App"
        className={`flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-amber-600/10 hover:bg-amber-500/30 px-2.5 py-1.5 text-xs font-bold text-amber-300 transition-all cursor-pointer shadow-sm shadow-amber-500/10 ${className}`}
      >
        <Download className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
        <span>Install App</span>
      </button>

      {/* Guided iOS & Fallback Install Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-4 shadow-2xl relative text-xs">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-200 cursor-pointer p-1"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-100">Install Royalty Miner</h3>
                <p className="text-neutral-400">Add to your device home screen</p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-2 rounded-xl bg-neutral-900/60 p-3.5 border border-neutral-800 text-neutral-300 leading-relaxed font-sans">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-amber-400">1.</span>
                  <span>Tap the <strong>Share</strong> button in the Safari bottom toolbar.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-amber-400">2.</span>
                  <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-amber-400">3.</span>
                  <span>Tap <strong>Add</strong> in the top right to launch as a standalone app!</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 rounded-xl bg-neutral-900/60 p-3.5 border border-neutral-800 text-neutral-300 leading-relaxed font-sans">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-amber-400">1.</span>
                  <span>Open your browser options menu (<strong>⋮</strong> or Share icon).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-amber-400">2.</span>
                  <span>Tap <strong>Install App</strong> or <strong>Add to Home Screen</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-amber-400">3.</span>
                  <span>Enjoy fast offline access, zero browser bars, and instant mining access!</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-2.5 font-bold text-neutral-950 transition-colors cursor-pointer text-center"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
