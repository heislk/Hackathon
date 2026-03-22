import { QueryInput, NormalizedOutput, ProviderData } from './types';
import { MempoolProvider } from './providers/mempool';
import { CoinbaseCdpProvider } from './providers/coinbase-cdp';
import { ArkhamProvider } from './providers/arkham';
import { GoPlusPhishingProvider, PhishingResult } from './providers/goplus-phishing';
import { GoPlusProvider } from './providers/goplus';
import { normalizeData } from './normalizers';
import { logger } from './utils/logger';

export async function queryChainIntelligence(
  input: string | QueryInput
): Promise<NormalizedOutput | null> {
  const inputType = typeof input === 'string'
    ? (input.startsWith('0x') && input.length >= 64 ? 'txhash' : (input.startsWith('0x') ? 'address' : 'txhash'))
    : input.inputType;
  const value = typeof input === 'string' ? input : input.value;
  const chainHint = typeof input === 'string' ? undefined : input.chainHint;

  logger.info(`Received intelligence query for ${inputType}: ${value}`);

  let detectedChain = chainHint;
  if (!detectedChain) {
    if (value.startsWith('0x')) {
      detectedChain = 'evm';
    } else if (value.startsWith('bc1') || value.startsWith('1') || value.startsWith('3') || value.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/)) {
      detectedChain = 'btc';
    } else {
      detectedChain = 'unknown';
    }
  }

  const providersUsed: string[] = [];
  const providersToCall: Promise<ProviderData | null>[] = [];

  const mempool = new MempoolProvider();
  const coinbase = new CoinbaseCdpProvider();
  const arkham = new ArkhamProvider();
  const goplus = new GoPlusProvider();

  if (detectedChain === 'evm' || detectedChain === 'ethereum') {
    if (inputType === 'address') {
      // Coinbase for balance/address data on ETH
      providersToCall.push(coinbase.getAddressData(value));
      providersUsed.push('CoinbaseCDP');
      // Arkham for enriched intelligence
      providersToCall.push(arkham.getAddressData(value));
      providersUsed.push('Arkham');
      // GoPlus for security analysis
      providersToCall.push(goplus.getAddressData(value));
      providersUsed.push('GoPlus');
    } else {
      // Coinbase (ethers RPC) for ETH transaction data
      providersToCall.push(coinbase.getTxData(value));
      providersUsed.push('CoinbaseCDP');
      // Arkham for TX data
      providersToCall.push(arkham.getTxData(value));
      providersUsed.push('Arkham');
    }
  } else if (detectedChain === 'btc' || detectedChain === 'bitcoin') {
    if (inputType === 'address') {
      // Mempool for on-chain BTC data
      providersToCall.push(mempool.getAddressData(value));
      providersUsed.push('Mempool');
      // Coinbase for BTC balance via CDP
      providersToCall.push(coinbase.getAddressData(value));
      providersUsed.push('CoinbaseCDP');
      // Arkham for intelligence on BTC
      providersToCall.push(arkham.getAddressData(value));
      providersUsed.push('Arkham');
    } else {
      // Mempool for BTC transaction data
      providersToCall.push(mempool.getTxData(value));
      providersUsed.push('Mempool');
      // Arkham for TX data
      providersToCall.push(arkham.getTxData(value));
      providersUsed.push('Arkham');
    }
  } else {
    logger.warn('Could not infer chain. Trying Mempool (BTC) first, then Coinbase (ETH).');
    providersUsed.push('Mempool');
    if (inputType === 'address') {
      providersToCall.push(mempool.getAddressData(value));
      providersToCall.push(arkham.getAddressData(value));
      providersUsed.push('Arkham');
    } else {
      providersToCall.push(mempool.getTxData(value));
      providersToCall.push(arkham.getTxData(value));
      providersUsed.push('Arkham');
    }
  }

  const results = await Promise.allSettled(providersToCall);

  const successfulResponses: ProviderData[] = results
    .filter((r): r is PromiseFulfilledResult<ProviderData> => r.status === 'fulfilled' && r.value !== null)
    .map((r: any) => r.value);

  const inputObj: QueryInput = typeof input === 'string'
    ? { inputType: inputType as 'address' | 'txhash', value, chainHint: detectedChain || undefined }
    : input;

  const normalized = normalizeData(inputObj, providersUsed, successfulResponses);

  // Set detected chain if not already set by providers
  if (!normalized.query.detectedChain) {
    if (detectedChain === 'evm' || detectedChain === 'ethereum') {
      normalized.query.detectedChain = 'Ethereum';
      normalized.query.chainId = '1';
    } else if (detectedChain === 'btc' || detectedChain === 'bitcoin') {
      normalized.query.detectedChain = 'Bitcoin';
      normalized.query.chainId = 'bitcoin-mainnet';
    }
  }

  return normalized;
}

/**
 * Check a URL for phishing using GoPlus Security phishing site API
 */
export async function checkPhishingUrl(url: string): Promise<PhishingResult> {
  const phishingProvider = new GoPlusPhishingProvider();
  return phishingProvider.checkUrl(url);
}

export * from './types';
export { PhishingResult } from './providers/goplus-phishing';
