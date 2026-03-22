import axios from 'axios';
import { logger } from '../utils/logger';

export interface PhishingResult {
  url: string;
  isPhishing: boolean;
  phishingScore: number; // 0 = not found malicious, 1 = confirmed phishing
  websiteContracts: Array<{
    contract: string;
    standard: string | null;
    isContract: boolean;
    isOpenSource: boolean;
    addressRisks: string[];
  }>;
  dataSource: string;
  checkedAt: string;
}

export class GoPlusPhishingProvider {
  private baseUrl = 'https://api.gopluslabs.io';
  private appKey: string | undefined;
  private appSecret: string | undefined;

  constructor() {
    this.appKey = process.env.GOPLUS_APP_KEY;
    this.appSecret = process.env.GOPLUS_APP_SECRET;
  }

  /**
   * Get a GoPlus access token using app key + secret
   */
  private async getAccessToken(): Promise<string | null> {
    if (!this.appKey || !this.appSecret) return null;
    try {
      const res = await axios.post(
        `${this.baseUrl}/api/v1/token`,
        { app_key: this.appKey, time: Math.floor(Date.now() / 1000), sign: '' },
        { timeout: 10000 }
      );
      return res.data?.result?.access_token || null;
    } catch {
      return null;
    }
  }

  async checkUrl(url: string): Promise<PhishingResult> {
    logger.info(`GoPlus: Checking URL for phishing: ${url}`);

    const headers: Record<string, string> = {};
    const token = await this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await axios.get(`${this.baseUrl}/api/v1/phishing_site`, {
        params: { url },
        headers,
        timeout: 15000
      });

      if (!res.data || res.data.code !== 1) {
        logger.warn(`GoPlus phishing check returned non-success: ${res.data?.message}`);
        return this.buildResult(url, null);
      }

      return this.buildResult(url, res.data.result);
    } catch (e: any) {
      logger.error(`GoPlus phishing check failed for ${url}: ${e.message}`);
      return this.buildResult(url, null);
    }
  }

  private buildResult(url: string, result: any): PhishingResult {
    if (!result) {
      return {
        url,
        isPhishing: false,
        phishingScore: 0,
        websiteContracts: [],
        dataSource: 'GoPlus (error/unavailable)',
        checkedAt: new Date().toISOString()
      };
    }

    const phishingScore = result.phishing_site ?? 0;
    const contractsRaw: any[] = result.website_contract_security || [];

    const websiteContracts = contractsRaw.map((c: any) => ({
      contract: c.contract,
      standard: c.standard || null,
      isContract: c.is_contract === 1,
      isOpenSource: c.is_open_source === 1,
      addressRisks: Array.isArray(c.address_risk) ? c.address_risk : []
    }));

    return {
      url,
      isPhishing: phishingScore === 1,
      phishingScore,
      websiteContracts,
      dataSource: 'GoPlus Security',
      checkedAt: new Date().toISOString()
    };
  }
}
