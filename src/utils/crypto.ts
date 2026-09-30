/**
 * Real SHA-256 cryptographic hashing using Web Crypto API.
 */
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a pseudo-random hex string of specified length.
 */
export function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}

/**
 * Generate a realistic simulated Lightning Network payment request (BOLT11 format).
 */
export function generateMockBolt11(amountSats: number, memo: string = 'SatoshiStack payout'): string {
  const prefix = 'lnbc';
  // Human readable part: lnbc + amount in micro-btc or satoshis
  const amountPart = `${amountSats}u1p`;
  const randomBody = randomHex(104);
  return `${prefix}${amountPart}${randomBody}`;
}

/**
 * Format satoshis with commas.
 */
export function formatSats(sats: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(sats));
}

/**
 * Convert satoshis to USD based on current BTC price.
 * 1 BTC = 100,000,000 Satoshis.
 */
export function satsToUsd(sats: number, btcPriceUsd: number): string {
  const btcAmount = sats / 100_000_000;
  const usdValue = btcAmount * btcPriceUsd;
  if (usdValue < 0.01 && usdValue > 0) {
    return `< $0.01`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usdValue);
}

/**
 * Convert satoshis to BTC string.
 */
export function satsToBtc(sats: number): string {
  const btc = sats / 100_000_000;
  return btc.toFixed(8);
}

/**
 * Format hashrate in standard H/s, KH/s, MH/s, GH/s, TH/s, EH/s.
 */
export function formatHashRate(hashRate: number): string {
  if (hashRate >= 1_000_000_000_000_000_000) {
    return `${(hashRate / 1_000_000_000_000_000_000).toFixed(2)} EH/s`;
  }
  if (hashRate >= 1_000_000_000_000) {
    return `${(hashRate / 1_000_000_000_000).toFixed(1)} TH/s`;
  }
  if (hashRate >= 1_000_000_000) {
    return `${(hashRate / 1_000_000_000).toFixed(1)} GH/s`;
  }
  if (hashRate >= 1_000_000) {
    return `${(hashRate / 1_000_000).toFixed(1)} MH/s`;
  }
  if (hashRate >= 1_000) {
    return `${(hashRate / 1_000).toFixed(1)} KH/s`;
  }
  return `${Math.round(hashRate)} H/s`;
}
