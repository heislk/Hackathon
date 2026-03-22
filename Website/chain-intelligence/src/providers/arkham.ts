import axios from 'axios';
import { logger } from '../utils/logger';
import { ProviderData } from '../types';

export class ArkhamProvider {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.arkm.com';

  constructor() {
    this.apiKey = process.env.ARKHAM_API_KEY;
  }

  private get headers() {
    return this.apiKey ? { 'API-Key': this.apiKey } : {};
  }

  /**
   * Check an address for intelligence using Arkham's enriched address endpoint
   */
  async getAddressData(address: string): Promise<ProviderData | null> {
    try {
      logger.info(`Arkham: Fetching enriched intelligence for address ${address}`);
      const response = await axios.get(`${this.baseUrl}/intelligence/address_enriched/${address}`, {
        headers: this.headers,
        timeout: 10000
      });

      const result = response.data;
      if (!result) return null;

      const labels = [];
      const maliciousFlags = [];
      const notes = [];

      // Process Arkham Enriched Address Response
      if (result.arkhamEntity) {
        notes.push(`Entity: ${result.arkhamEntity.name} (${result.arkhamEntity.type || 'Unknown'})`);
      }
      if (result.arkhamLabel) {
        labels.push(result.arkhamLabel.name);
      }
      if (result.isUserAddress) {
        notes.push('User Address');
      }
      if (result.contract) {
        labels.push('Smart Contract');
      }

      let isMalicious = false;

      // Check tags for malicious indicators
      if (result.populatedTags && Array.isArray(result.populatedTags)) {
        for (const tag of result.populatedTags) {
          const tagName = tag.label || tag.name || tag.id || tag.tag || '';
          labels.push(`Tag: ${tagName}`);
          
          // Basic threat analysis based on tags
          const lowerTag = tagName.toLowerCase();
          if (
            lowerTag.includes('hack') || 
            lowerTag.includes('exploit') || 
            lowerTag.includes('phish') ||
            lowerTag.includes('sanction') ||
            lowerTag.includes('scam') ||
            lowerTag.includes('stolen')
          ) {
            isMalicious = true;
            maliciousFlags.push(`Flagged Tag: ${tagName}`);
          }
        }
      }

      // Fetch recent transfers for heuristic analysis
      let recentTransactions = [];
      try {
        const transfersResponse = await axios.get(`${this.baseUrl}/transfers?base=${address}&limit=50`, {
          headers: this.headers,
          timeout: 10000
        });
        const transfers = transfersResponse.data?.transfers || [];
        
        let poisoningCount = 0;
        let spamTokenCount = 0;
        let scamInteractionCount = 0;

        for (const t of transfers) {
          const fromAddr = t.fromAddress?.address || null;
          const toAddr = t.toAddress?.address || null;
          const valueNative = (t.unitValue !== null && t.unitValue !== undefined) ? `${t.unitValue} ${t.tokenSymbol || ''}`.trim() : '0';
          
          const fromName = t.fromAddress?.arkhamEntity?.name || t.fromAddress?.arkhamLabel?.name || fromAddr;
          const toName = t.toAddress?.arkhamEntity?.name || t.toAddress?.arkhamLabel?.name || toAddr;

          recentTransactions.push({
            hash: t.transactionHash,
            from: fromName,
            to: toName,
            valueNative,
            valueRaw: String(t.unitValue || 0),
            fee: null,
            confirmed: true,
            blockHeight: t.blockNumber,
            blockTime: t.blockTimestamp,
            isCoinbase: false
          });

          // Heuristics
          const isZeroValue = !t.unitValue || parseFloat(t.unitValue) === 0;
          const fromStr = (fromName || '').toLowerCase();
          const toStr = (toName || '').toLowerCase();
          
          const isCounterpartyFake = fromStr.includes('fake_phish') || toStr.includes('fake_phish');
          const isCounterpartyScam = fromStr.includes('scam') || toStr.includes('scam') || 
                                     fromStr.includes('phish') || toStr.includes('phish') ||
                                     fromStr.includes('hack') || toStr.includes('hack');

          const tokenName = (t.tokenName || '').toLowerCase();
          const tokenSymbol = (t.tokenSymbol || '').toLowerCase();
          const isSpamToken = tokenName.includes('telegram') || tokenName.includes('.com') || tokenName.includes('.org') ||
                              tokenName.includes('voucher') || tokenName.includes('claim') || tokenName.includes('@') ||
                              tokenSymbol.includes('telegram') || tokenSymbol.includes('.com') || tokenSymbol.includes('@');

          if (isSpamToken) {
            spamTokenCount++;
          }
          if (isZeroValue && isCounterpartyFake) {
            poisoningCount++;
          } else if (isCounterpartyScam) {
            scamInteractionCount++;
          }
        }

        if (poisoningCount > 0) {
          maliciousFlags.push(`Warning: Target of ${poisoningCount} Zero-Value Poisoning attack(s)`);
          notes.push(`Observed ${poisoningCount} poisoning attempts in recent transactions.`);
        }
        if (spamTokenCount > 0) {
          maliciousFlags.push(`Warning: Target of ${spamTokenCount} Spam/Phishing Token drop(s)`);
          notes.push(`Observed ${spamTokenCount} spam tokens in recent transfers.`);
        }
        if (scamInteractionCount > 0) {
          isMalicious = true;
          maliciousFlags.push(`High Risk: Interacted with ${scamInteractionCount} known scam/phishing address(es)`);
        }
      } catch (err: any) {
        logger.warn(`Arkham transfers fetch failed: ${err.message}`);
      }

      return {
        providerName: 'Arkham',
        raw: { arkham: result },
        intelligencePartial: {
          labels,
          isMalicious,
          maliciousFlags,
          notes
        },
        activityPartial: {
          recentTransactions
        }
      };
    } catch (e: any) {
      logger.error('Arkham getAddressData failed', e.message);
      return null;
    }
  }

  /**
   * Fetch transaction data from Arkham
   */
  async getTxData(txhash: string): Promise<ProviderData | null> {
    try {
      logger.info(`Arkham: Fetching transaction ${txhash}`);
      const response = await axios.get(`${this.baseUrl}/tx/${txhash}`, {
        headers: this.headers,
        timeout: 10000
      });

      const result = response.data;
      if (!result) return null;

      return {
        providerName: 'Arkham',
        raw: { tx: result },
        intelligencePartial: {}
      };
    } catch (e: any) {
      logger.error('Arkham getTxData failed', e.message);
      return null;
    }
  }
}
