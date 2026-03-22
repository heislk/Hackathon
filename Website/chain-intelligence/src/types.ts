/**
 * Domain types for Chain Intelligence module
 */

export type InputType = 'address' | 'txhash' | 'url';

export interface QueryInput {
  inputType: InputType;
  value: string;
  chainHint?: string;
}

export interface NormalizedTransaction {
  hash: string;
  from: string | null;
  to: string | null;
  valueNative: string | null;   // e.g. "0.5 ETH" or "0.001 BTC"
  valueRaw: string | null;       // raw numeric string
  fee: string | null;
  confirmed: boolean;
  blockHeight: number | null;
  blockTime: string | null;      // ISO timestamp
  isCoinbase: boolean;
}

export interface NormalizedOutput {
  query: {
    inputType: InputType;
    value: string;
    detectedChain: string | null;
    chainId: string | null;
    normalizedValue: string;
  };
  summary: {
    label: string | null;
    addressType: string | null; // e.g. "contract" or "eoa"
    currentBalance: Array<{ asset: string; balance: string; usdValue: string | null }>;
    firstSeen: string | null;
    lastActive: string | null;
    txCount: number | null;
  };
  assets: Array<{
    asset: string;
    symbol: string;
    balance: string;
    decimals: number | null;
    usdValue: string | null;
    source: string;
  }>;
  activity: {
    recentTransactions: NormalizedTransaction[];
    totalInbound: string | null;
    totalOutbound: string | null;
    netFlow: string | null;
  };
  intelligence: {
    labels: string[];
    isMalicious: boolean;
    maliciousFlags: string[];
    fundingSource: string | null;
    counterparties: string[];
    notes: string[];
    confidenceWarnings: string[];
  };
  provenance: {
    providersUsed: string[];
    fieldSources: Record<string, string>;
    fetchedAt: string;
  };
  raw: {
    goplus: any | null;
    mempool: any | null;
    coinbase: any | null;
    arkham: any | null;
  };
}

// Internal Provider Interfaces
export interface ProviderData {
  providerName: string;
  raw: any;
  // normalized summary elements that normalizers will extract
  summaryPartial?: Partial<NormalizedOutput['summary']>;
  assets?: NormalizedOutput['assets'];
  activityPartial?: {
    recentTransactions?: NormalizedTransaction[];
    totalInbound?: string | null;
    totalOutbound?: string | null;
  };
  intelligencePartial?: Partial<NormalizedOutput['intelligence']>;
}
