import { NormalizedOutput, NormalizedTransaction, ProviderData, QueryInput } from '../types';

/**
 * Convert a raw Mempool.space transaction object into a NormalizedTransaction
 */
function normalizeMempoolTx(tx: any, targetAddress: string): NormalizedTransaction {
  let valueToAddress = 0;
  for (const out of (tx.vout || [])) {
    if (out.scriptpubkey_address === targetAddress) {
      valueToAddress += out.value || 0;
    }
  }

  const blockTime = tx.status?.block_time
    ? new Date(tx.status.block_time * 1000).toISOString()
    : null;

  const isCoinbaseInput = (tx.vin || []).some((v: any) => v.is_coinbase === true);

  // Determine primary from/to addresses
  const fromAddresses = (tx.vin || [])
    .map((v: any) => v.prevout?.scriptpubkey_address)
    .filter(Boolean);
  const toAddresses = (tx.vout || [])
    .map((v: any) => v.scriptpubkey_address)
    .filter(Boolean);

  const fromAddr = fromAddresses[0] || null;
  const toAddr = toAddresses.find((a: string) => a === targetAddress) || toAddresses[0] || null;

  const btcValue = (valueToAddress / 1e8).toFixed(8);
  const feeInBtc = tx.fee ? (tx.fee / 1e8).toFixed(8) : null;

  return {
    hash: tx.txid || tx.hash || 'unknown',
    from: isCoinbaseInput ? 'Coinbase (block reward)' : fromAddr,
    to: toAddr,
    valueNative: `${btcValue} BTC`,
    valueRaw: btcValue,
    fee: feeInBtc ? `${feeInBtc} BTC` : null,
    confirmed: tx.status?.confirmed ?? false,
    blockHeight: tx.status?.block_height ?? null,
    blockTime,
    isCoinbase: isCoinbaseInput
  };
}

/**
 * Convert a raw ethers-fetched ETH transaction into a NormalizedTransaction
 */
function normalizeEthTx(tx: any): NormalizedTransaction {
  const valueEth = tx.valueFormatted || tx.value || '0';
  return {
    hash: tx.hash || 'unknown',
    from: tx.from || null,
    to: tx.to || null,
    valueNative: `${valueEth} ETH`,
    valueRaw: valueEth,
    fee: null,
    confirmed: tx.blockNumber != null,
    blockHeight: tx.blockNumber ?? null,
    blockTime: null,
    isCoinbase: false
  };
}

export function normalizeData(
  input: QueryInput,
  providersUsed: string[],
  providerResponses: ProviderData[]
): NormalizedOutput {
  const result: NormalizedOutput = {
    query: {
      inputType: input.inputType,
      value: input.value,
      detectedChain: null,
      chainId: null,
      normalizedValue: input.value.toLowerCase()
    },
    summary: {
      label: null,
      addressType: null,
      currentBalance: [],
      firstSeen: null,
      lastActive: null,
      txCount: null
    },
    assets: [],
    activity: {
      recentTransactions: [],
      totalInbound: null,
      totalOutbound: null,
      netFlow: null
    },
    intelligence: {
      labels: [],
      isMalicious: false,
      maliciousFlags: [],
      fundingSource: null,
      counterparties: [],
      notes: [],
      confidenceWarnings: []
    },
    provenance: {
      providersUsed,
      fieldSources: {},
      fetchedAt: new Date().toISOString()
    },
    raw: {
      goplus: null,
      mempool: null,
      coinbase: null,
      arkham: null
    }
  };

  const targetAddress = input.value;

  // Process each provider response
  for (const p of providerResponses) {
    // Populate raw data
    if (p.providerName === 'GoPlus') result.raw.goplus = p.raw;
    if (p.providerName === 'Mempool') result.raw.mempool = p.raw;
    if (p.providerName === 'CoinbaseCDP') result.raw.coinbase = p.raw;
    if (p.providerName === 'Arkham') result.raw.arkham = p.raw;

    // Determine chain based on provider
    if (p.providerName === 'Mempool') {
      result.query.detectedChain = 'Bitcoin';
      result.query.chainId = 'bitcoin-mainnet';
    } else if (p.providerName === 'CoinbaseCDP') {
      if (!result.query.detectedChain) {
        result.query.detectedChain = input.value.startsWith('0x') ? 'Ethereum' : 'Bitcoin';
        result.query.chainId = input.value.startsWith('0x') ? '1' : 'bitcoin-mainnet';
      }
    }

    // Merge summary partial
    if (p.summaryPartial) {
      if (p.summaryPartial.currentBalance) {
        result.summary.currentBalance.push(...p.summaryPartial.currentBalance);
        result.provenance.fieldSources['summary.currentBalance'] = p.providerName;
      }
      if (p.summaryPartial.txCount !== undefined) {
        result.summary.txCount = p.summaryPartial.txCount;
        result.provenance.fieldSources['summary.txCount'] = p.providerName;
      }
    }

    // Merge Assets
    if (p.assets) {
      result.assets.push(...p.assets);
      result.provenance.fieldSources['assets'] = p.providerName;
    }

    // Merge Activity Partial — normalize raw transactions from Mempool
    if (p.activityPartial) {
      if (p.activityPartial.recentTransactions && p.activityPartial.recentTransactions.length > 0) {
        const txs = p.activityPartial.recentTransactions;
        // Check if already normalized (has valueNative)
        const isAlreadyNormalized = txs[0] && typeof (txs[0] as any).valueNative !== 'undefined';
        if (!isAlreadyNormalized) {
          // These are raw mempool txs — normalize them
          const normalized = txs.map((tx: any) => {
            if (tx.txid) return normalizeMempoolTx(tx, targetAddress);
            if (tx.hash && tx.from !== undefined) return normalizeEthTx(tx);
            return tx;
          });
          result.activity.recentTransactions.push(...normalized);
        } else {
          result.activity.recentTransactions.push(...(txs as NormalizedTransaction[]));
        }
        result.provenance.fieldSources['activity.recentTransactions'] = p.providerName;
      }
      if (p.activityPartial.totalInbound != null) {
        result.activity.totalInbound = p.activityPartial.totalInbound;
      }
      if (p.activityPartial.totalOutbound != null) {
        result.activity.totalOutbound = p.activityPartial.totalOutbound;
      }
    }

    // Merge Intelligence Partial
    if (p.intelligencePartial) {
      if (p.intelligencePartial.labels) result.intelligence.labels.push(...p.intelligencePartial.labels);
      if (p.intelligencePartial.maliciousFlags) {
        result.intelligence.maliciousFlags.push(...p.intelligencePartial.maliciousFlags);
        if (p.intelligencePartial.maliciousFlags.length > 0) {
          result.intelligence.isMalicious = true;
        }
      }
      if (p.intelligencePartial.isMalicious) result.intelligence.isMalicious = true;
      if (p.intelligencePartial.confidenceWarnings) result.intelligence.confidenceWarnings.push(...p.intelligencePartial.confidenceWarnings);
      if (p.intelligencePartial.notes) result.intelligence.notes.push(...p.intelligencePartial.notes);
      if (p.intelligencePartial.fundingSource) result.intelligence.fundingSource = p.intelligencePartial.fundingSource;
      if (p.intelligencePartial.counterparties) result.intelligence.counterparties.push(...p.intelligencePartial.counterparties);
    }
  }

  // Compute net flow if both sides are known
  if (result.activity.totalInbound && result.activity.totalOutbound) {
    const inbound = parseFloat(result.activity.totalInbound);
    const outbound = parseFloat(result.activity.totalOutbound);
    result.activity.netFlow = (inbound - outbound).toFixed(8);
  }

  return result;
}
