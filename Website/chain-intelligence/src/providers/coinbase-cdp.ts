import { logger } from '../utils/logger';
import { ProviderData, NormalizedTransaction } from '../types';
import { Coinbase, Address } from '@coinbase/coinbase-sdk';
import { ethers } from 'ethers';

export class CoinbaseCdpProvider {
  private isConfigured = false;

  constructor() {
    const apiKey = process.env.COINBASE_CDP_API_KEY;
    const apiSecret = process.env.COINBASE_CDP_API_SECRET;

    if (!apiKey || !apiSecret) {
      logger.info('Coinbase CDP API key or secret missing. CDP provider will be stubbed.');
      return;
    }

    try {
      const parsedSecret = apiSecret.replace(/\\n/g, '\n');
      Coinbase.configure({
        apiKeyName: apiKey,
        privateKey: parsedSecret
      });
      this.isConfigured = true;
    } catch (err: any) {
      logger.error('Failed to configure Coinbase SDK', err.message);
    }
  }

  async getAddressData(addressStr: string): Promise<ProviderData | null> {
    if (!this.isConfigured) return null;

    const isBtc = !addressStr.startsWith('0x');
    const network = isBtc ? 'bitcoin-mainnet' : 'ethereum-mainnet';

    try {
      logger.info(`Coinbase CDP: Fetching balances for ${addressStr} on ${network}`);
      const cdpAddr = new Address(network, addressStr);
      const balancesList = await cdpAddr.listBalances();

      const currentBalance: any[] = [];
      const assets: any[] = [];

      for await (const item of balancesList as any) {
        let key, val;
        if (Array.isArray(item) && item.length === 2) {
          key = item[0];
          val = item[1];
        } else {
          continue;
        }

        if (val !== undefined && val !== null) {
          const balStr = val.toString();
          const symbol = String(key).toUpperCase();
          const assetName = symbol === 'ETH' ? 'Ethereum'
            : symbol === 'USDC' ? 'USD Coin'
            : symbol === 'BTC' ? 'Bitcoin'
            : symbol;

          currentBalance.push({ asset: symbol, balance: balStr, usdValue: null });
          assets.push({
            asset: assetName,
            symbol,
            balance: balStr,
            decimals: isBtc ? 8 : 18,
            usdValue: null,
            source: 'CoinbaseCDP'
          });
        }
      }

      return {
        providerName: 'CoinbaseCDP',
        raw: { network, balanceFetched: true },
        summaryPartial: { currentBalance },
        assets
      };
    } catch (e: any) {
      logger.error('Coinbase CDP getAddressData failed', e.message);
      return null;
    }
  }

  /**
   * Fetch an ETH transaction by hash using a public JSON-RPC provider
   */
  async getEthTxData(txhash: string): Promise<ProviderData | null> {
    logger.info(`Coinbase (Ethers RPC): Fetching ETH tx ${txhash}`);
    try {
      const provider = new ethers.JsonRpcProvider('https://cloudflare-eth.com');
      const [tx, receipt] = await Promise.allSettled([
        provider.getTransaction(txhash),
        provider.getTransactionReceipt(txhash)
      ]);

      const txData = tx.status === 'fulfilled' ? tx.value : null;
      const receiptData = receipt.status === 'fulfilled' ? receipt.value : null;

      if (!txData) {
        logger.warn(`Coinbase (Ethers RPC): ETH tx ${txhash} not found`);
        return null;
      }

      const valueEth = ethers.formatEther(txData.value || 0n);
      let feeEth: string | null = null;
      if (receiptData && txData.gasPrice) {
        feeEth = ethers.formatEther((txData.gasPrice) * BigInt(receiptData.gasUsed));
      }

      const normalized: NormalizedTransaction = {
        hash: txData.hash,
        from: txData.from,
        to: txData.to || null,
        valueNative: `${valueEth} ETH`,
        valueRaw: valueEth,
        fee: feeEth ? `${feeEth} ETH` : null,
        confirmed: txData.blockNumber != null,
        blockHeight: txData.blockNumber ?? null,
        blockTime: null,
        isCoinbase: false
      };

      return {
        providerName: 'CoinbaseCDP',
        raw: { txhash, network: 'ethereum-mainnet' },
        activityPartial: {
          recentTransactions: [normalized]
        }
      };
    } catch (e: any) {
      logger.error('Coinbase ETH tx fetch failed', e.message);
      return null;
    }
  }

  /**
   * Existing generic getTxData — routes to ETH RPC for EVM hashes
   */
  async getTxData(txhash: string): Promise<ProviderData | null> {
    return this.getEthTxData(txhash);
  }
}
