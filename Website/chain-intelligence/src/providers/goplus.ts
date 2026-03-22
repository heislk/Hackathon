import { GoPlus } from '@goplus/sdk-node';
import { logger } from '../utils/logger';
import { ProviderData } from '../types';

export class GoPlusProvider {
  private appKey: string | undefined;
  private appSecret: string | undefined;

  constructor() {
    this.appKey = process.env.GOPLUS_APP_KEY;
    this.appSecret = process.env.GOPLUS_APP_SECRET;

    if (this.appKey && this.appSecret) {
      // @ts-ignore
      GoPlus.config(this.appKey, this.appSecret);
    }
  }

  /**
   * Check an ETH/EVM address for malicious behavior (chain 1 = Ethereum mainnet)
   */
  async getAddressData(address: string, chainId: string = '1'): Promise<ProviderData | null> {
    try {
      if (this.appKey && this.appSecret) {
        // @ts-ignore
        await GoPlus.getAccessToken();
      }

      logger.info(`GoPlus: Checking address security for ${address} on chain ${chainId}`);

      // @ts-ignore
      const res = await GoPlus.addressSecurity(chainId, address, 30);

      if (!res || res.code !== 1) {
        logger.warn(`GoPlus addressSecurity failed for ${address}: ${res?.message}`);
        return null;
      }

      const result = res.result;

      const maliciousFlagDefs = [
        { key: 'cybercrime',                 label: 'Cybercrime' },
        { key: 'money_laundering',           label: 'Money Laundering' },
        { key: 'phishing_activities',        label: 'Phishing Activities' },
        { key: 'stealing_attack',            label: 'Stealing Attack' },
        { key: 'blackmail_activities',       label: 'Blackmail Activities' },
        { key: 'sanctioned',                 label: 'Sanctioned' },
        { key: 'malicious_mining_activities',label: 'Malicious Mining' },
        { key: 'darkweb_transactions',       label: 'Darkweb Transactions' },
        { key: 'fake_kyc',                   label: 'Fake KYC' },
        { key: 'gas_abuse',                  label: 'Gas Abuse' },
        { key: 'financial_crime',            label: 'Financial Crime' },
        { key: 'mixer',                      label: 'Coin Mixer' },
        { key: 'honeypot_related_address',   label: 'Honeypot Creator/Owner' },
        { key: 'blacklist_doubt',            label: 'Blacklist Suspect' },
        { key: 'fake_token',                 label: 'Fake Token' },
        { key: 'fake_standard_interface',    label: 'Fake Standard Interface' },
      ];

      const maliciousFlags: string[] = [];
      const labels: string[] = [];

      if (result) {
        for (const flag of maliciousFlagDefs) {
          if (result[flag.key] === '1') {
            maliciousFlags.push(flag.label);
          }
        }

        if (result.contract_address === '1') {
          labels.push('Smart Contract');
        }

        const maliciousContractsCreated = Number(result.number_of_malicious_contracts_created || '0');
        if (maliciousContractsCreated > 0) {
          maliciousFlags.push(`Created ${maliciousContractsCreated} malicious contract(s)`);
        }
      }

      const isMalicious = maliciousFlags.length > 0;
      const notes = isMalicious
        ? ['⚠️ GoPlus Security: MALICIOUS BEHAVIOR DETECTED']
        : ['✅ GoPlus Security: No malicious behavior detected'];

      if (result?.data_source) {
        notes.push(`Data source: ${result.data_source}`);
      }

      return {
        providerName: 'GoPlus',
        raw: { security: result },
        intelligencePartial: {
          labels,
          isMalicious,
          maliciousFlags,
          notes
        }
      };
    } catch (e: any) {
      logger.error('GoPlus getAddressData failed', e.message);
      return null;
    }
  }

  async getTxData(_txhash: string): Promise<ProviderData | null> {
    // GoPlus doesn't have a TX hash endpoint
    return null;
  }
}
