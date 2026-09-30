import React, { useState } from 'react';
import { ArrowRight, Calculator } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { formatSats, satsToUsd } from '../utils/crypto';

export const NetworkStatsBar: React.FC = () => {
  const { btcPriceUsd } = useWallet();
  const [calcSats, setCalcSats] = useState<number>(1000);
  const [showConverter, setShowConverter] = useState<boolean>(false);

  // Approximate block height and next halving countdown
  const currentBlockHeight = 884128;
  const nextHalvingBlock = 1050000;
  const blocksToHalving = nextHalvingBlock - currentBlockHeight;
  const daysToHalving = Math.round((blocksToHalving * 10) / (60 * 24));

  return (
    <div className="w-full border-b border-neutral-900 bg-neutral-950/60 py-2.5 px-4 text-xs text-neutral-400">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-2 gap-x-6">
        {/* Unboxed ticker stats with typographic separators */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">BTC / USD:</span>
            <span className="font-mono font-medium text-neutral-200 tabular-nums">
              ${new Intl.NumberFormat('en-US').format(btcPriceUsd)}
            </span>
          </div>

          <span className="text-neutral-700" aria-hidden="true">·</span>

          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">1 Sat:</span>
            <span className="font-mono text-neutral-300 tabular-nums">
              ${(btcPriceUsd / 100000000).toFixed(6)}
            </span>
          </div>

          <span className="text-neutral-700" aria-hidden="true">·</span>

          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">Mempool Priority:</span>
            <span className="font-mono text-amber-400/90 tabular-nums">11 sat/vB</span>
          </div>

          <span className="text-neutral-700 hidden sm:inline" aria-hidden="true">·</span>

          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-neutral-500">Next Halving:</span>
            <span className="font-mono text-neutral-300 tabular-nums">
              ~{daysToHalving} days ({formatSats(blocksToHalving)} blocks)
            </span>
          </div>
        </div>

        {/* Quick Satoshi Converter toggle */}
        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={() => setShowConverter(!showConverter)}
            className="flex items-center gap-1 text-neutral-400 hover:text-amber-400 transition-colors"
          >
            <Calculator className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">Satoshi Calculator</span>
          </button>
        </div>
      </div>

      {/* Expanded quick converter drawer */}
      {showConverter && (
        <div className="mx-auto max-w-7xl pt-3 pb-1 border-t border-neutral-900 mt-2.5">
          <div className="flex flex-wrap items-center gap-3 bg-neutral-900/50 p-3 rounded-lg border border-neutral-800">
            <span className="text-neutral-400 text-xs">Convert:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100000000"
                value={calcSats}
                onChange={(e) => setCalcSats(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 rounded border border-neutral-700 bg-neutral-950 px-2.5 py-1 font-mono text-xs text-neutral-100 focus:border-amber-500 focus:outline-none"
              />
              <span className="text-xs font-mono text-neutral-400">Sats</span>
            </div>

            <ArrowRight className="h-3.5 w-3.5 text-neutral-600" />

            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-amber-300 font-semibold">{satsToUsd(calcSats, btcPriceUsd)}</span>
              <span className="text-neutral-500">/</span>
              <span className="text-neutral-300">{(calcSats / 100000000).toFixed(8)} BTC</span>
            </div>

            <button
              onClick={() => setShowConverter(false)}
              className="ml-auto text-[11px] text-neutral-500 hover:text-neutral-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
