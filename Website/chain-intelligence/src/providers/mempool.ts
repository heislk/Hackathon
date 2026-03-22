import axios from 'axios';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { ProviderData } from '../types';

export class MempoolProvider {
  private baseUrl: string;

  constructor() {
    this.baseUrl = 'https://mempool.space/api';
  }

  async getAddressData(address: string): Promise<ProviderData | null> {
    try {
      const getAddressFn = () => axios.get(`${this.baseUrl}/address/${address}`);
      const getTxsFn = () => axios.get(`${this.baseUrl}/address/${address}/txs`);

      const [addressRes, txsRes] = await Promise.all([
        withRetry(getAddressFn),
        withRetry(getTxsFn)
      ]);

      const addrData = addressRes.data;
      const txsData = txsRes.data;

      const stats = addrData.chain_stats;
      const balanceSats = (stats.funded_txo_sum - stats.spent_txo_sum).toString();
      const btcBalance = (Number(balanceSats) / 1e8).toString();

      return {
        providerName: 'Mempool',
        raw: {
          address: addrData,
          transactions: txsData
        },
        assets: [{
          asset: 'Bitcoin',
          symbol: 'BTC',
          balance: btcBalance,
          decimals: 8,
          usdValue: null,
          source: 'Mempool'
        }],
        summaryPartial: {
          txCount: stats.tx_count,
          currentBalance: [{ asset: 'BTC', balance: btcBalance, usdValue: null }]
        },
        activityPartial: {
          recentTransactions: txsData.slice(0, 10),
          totalInbound: (stats.funded_txo_sum / 1e8).toString(),
          totalOutbound: (stats.spent_txo_sum / 1e8).toString()
        }
      };
    } catch (e: any) {
      logger.error('Mempool getAddressData failed', e.message);
      return null;
    }
  }

  async getTxData(txhash: string): Promise<ProviderData | null> {
    try {
      const getTxFn = () => axios.get(`${this.baseUrl}/tx/${txhash}`);
      const txRes = await withRetry(getTxFn);
      
      return {
        providerName: 'Mempool',
        raw: {
          transaction: txRes.data
        }
      };
    } catch (e: any) {
      logger.error('Mempool getTxData failed', e.message);
      return null;
    }
  }
}
