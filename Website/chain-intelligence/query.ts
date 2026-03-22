import { queryChainIntelligence, checkPhishingUrl } from './src/index';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: npx ts-node query.ts <address|txhash|url>");
    console.error("  Examples:");
    console.error("    npx ts-node query.ts 0xABCD... (ETH address)");
    console.error("    npx ts-node query.ts bc1q... (BTC address)");
    console.error("    npx ts-node query.ts <txhash> (ETH or BTC transaction)");
    console.error("    npx ts-node query.ts coinbase.com (phishing site check)");
    process.exit(1);
  }

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // Detect if input looks like a URL / domain for phishing check
  const isUrl = !input.startsWith('0x') && !input.startsWith('bc1') &&
    !input.startsWith('1') && !input.startsWith('3') &&
    (input.includes('.') || input.startsWith('http'));

  if (isUrl) {
    console.log(`🔍 Checking URL for phishing: ${input}`);
    const result = await checkPhishingUrl(input);

    printPhishingResult(result);

    const filename = 'phishing_result.json';
    fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(result, null, 2));
    console.log(`\n✅ Wrote phishing check result to output/${filename}`);
    return;
  }

  // Otherwise treat as crypto address or txhash
  const inputType: 'address' | 'txhash' = (() => {
    if (input.startsWith('0x') && input.length >= 64) return 'txhash';
    if (input.startsWith('0x')) return 'address';
    // BTC: 64-char hex = txhash, otherwise address
    if (/^[0-9a-f]{64}$/i.test(input)) return 'txhash';
    return 'address';
  })();

  console.log(`🔍 Querying ${inputType}: ${input}`);
  const data = await queryChainIntelligence({ inputType, value: input });

  if (!data) {
    console.error("No data returned.");
    process.exit(1);
  }

  printAddressResult(data);

  const filename = input.startsWith('0x') ? 'eth_result.json' : 'btc_result.json';
  fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(data, null, 2));
  console.log(`\n✅ Wrote intelligence data to output/${filename}`);
}

function printAddressResult(data: any) {
  const chain = data.query.detectedChain || 'Unknown';
  const type = data.query.inputType === 'address' ? 'Address' : 'Transaction';

  console.log('\n' + '═'.repeat(60));
  console.log(`  CHAIN INTELLIGENCE REPORT — ${chain} ${type}`);
  console.log('═'.repeat(60));
  console.log(`  Value    : ${data.query.value}`);
  console.log(`  Chain    : ${data.query.detectedChain || 'Unknown'} (${data.query.chainId || 'unknown'})`);

  if (data.summary.txCount !== null) {
    console.log(`  Tx Count : ${data.summary.txCount}`);
  }

  // Balance
  if (data.summary.currentBalance && data.summary.currentBalance.length > 0) {
    console.log('\n  ── BALANCES ──');
    for (const b of data.summary.currentBalance) {
      console.log(`    ${b.asset}: ${b.balance}${b.usdValue ? ` (~$${b.usdValue})` : ''}`);
    }
  }

  // Flow stats
  if (data.activity.totalInbound || data.activity.totalOutbound) {
    console.log('\n  ── FLOW ──');
    if (data.activity.totalInbound)  console.log(`    Total Received : ${data.activity.totalInbound}`);
    if (data.activity.totalOutbound) console.log(`    Total Sent     : ${data.activity.totalOutbound}`);
    if (data.activity.netFlow)       console.log(`    Net Flow       : ${data.activity.netFlow}`);
  }

  // Recent transactions
  if (data.activity.recentTransactions && data.activity.recentTransactions.length > 0) {
    console.log(`\n  ── RECENT TRANSACTIONS (${Math.min(data.activity.recentTransactions.length, 5)} of ${data.activity.recentTransactions.length}) ──`);
    for (const tx of data.activity.recentTransactions.slice(0, 5)) {
      console.log(`\n    Hash     : ${tx.hash}`);
      if (tx.isCoinbase) {
        console.log(`    Type     : ⛏️  Coinbase (block reward)`);
      } else {
        if (tx.from) console.log(`    From     : ${tx.from}`);
        if (tx.to)   console.log(`    To       : ${tx.to}`);
      }
      if (tx.valueNative) console.log(`    Value    : ${tx.valueNative}`);
      if (tx.fee)         console.log(`    Fee      : ${tx.fee}`);
      if (tx.blockHeight) console.log(`    Block    : #${tx.blockHeight}`);
      if (tx.blockTime)   console.log(`    Time     : ${new Date(tx.blockTime).toLocaleString()}`);
      console.log(`    Status   : ${tx.confirmed ? '✅ Confirmed' : '⏳ Unconfirmed'}`);
    }
  }

  // Security / Intelligence
  const intel = data.intelligence;
  const arkhamRaw = data.raw?.arkham?.arkham;

  // Risk tier
  const flagCount = intel.maliciousFlags?.length ?? 0;
  const riskTier = intel.isMalicious
    ? (flagCount >= 2 ? '🔴 CRITICAL' : flagCount >= 1 ? '🟠 HIGH' : '🟡 MEDIUM')
    : '🟢 CLEAN';

  console.log('\n  ── SECURITY ANALYSIS ──');
  console.log(`    Risk Tier  : ${riskTier}`);
  console.log(`    Status     : ${intel.isMalicious ? '🚨 THREAT DETECTED' : '✅ No malicious behavior detected'}`);

  if (intel.labels && intel.labels.length > 0) {
    console.log(`    Labels     : ${intel.labels.join(' | ')}`);
  }

  if (arkhamRaw) {
    if (arkhamRaw.arkhamEntity) {
      console.log(`    Entity     : ${arkhamRaw.arkhamEntity.name} (${arkhamRaw.arkhamEntity.type || 'Unknown'})`);
      if (arkhamRaw.arkhamEntity.website) console.log(`    Website    : ${arkhamRaw.arkhamEntity.website}`);
    }
  }

  if (intel.isMalicious && intel.maliciousFlags && intel.maliciousFlags.length > 0) {
    console.log('\n  ── THREAT FLAGS ──');
    for (const flag of intel.maliciousFlags) {
      console.log(`    🚩 ${flag}`);
    }
  }

  // Full Arkham field breakdown even for clean addresses
  if (arkhamRaw && arkhamRaw.populatedTags && arkhamRaw.populatedTags.length > 0) {
    console.log('\n  ── ARKHAM POPULATED TAGS ──');
    for (const tag of arkhamRaw.populatedTags) {
      console.log(`    🏷️  ${tag.label || tag.name || tag.id || tag.tag || ''}`);
    }
  }

  if (intel.notes && intel.notes.length > 0) {
    console.log('\n  ── SCAN METADATA ──');
    for (const note of intel.notes) {
      console.log(`    📝 ${note}`);
    }
  }

  console.log('\n  ── PROVENANCE ──');
  console.log(`    Providers  : ${data.provenance.providersUsed.join(', ')}`);
  console.log(`    Fetched At : ${data.provenance.fetchedAt}`);
  console.log('═'.repeat(60));
}

function printPhishingResult(result: any) {
  console.log('\n' + '═'.repeat(60));
  console.log('  GOPLUS PHISHING SITE CHECK');
  console.log('═'.repeat(60));
  console.log(`  URL     : ${result.url}`);
  console.log(`  Status  : ${result.isPhishing ? '🚨 PHISHING SITE DETECTED' : '✅ Not identified as phishing'}`);
  console.log(`  Score   : ${result.phishingScore} (1 = phishing, 0 = clean)`);

  if (result.websiteContracts && result.websiteContracts.length > 0) {
    console.log('\n  ── WEBSITE CONTRACTS ──');
    for (const c of result.websiteContracts) {
      console.log(`    Contract  : ${c.contract}`);
      console.log(`    Standard  : ${c.standard || 'unknown'}`);
      console.log(`    Open Src  : ${c.isOpenSource ? 'Yes' : 'No'}`);
      if (c.addressRisks && c.addressRisks.length > 0) {
        console.log(`    Risks     : ${c.addressRisks.join(', ')}`);
      }
    }
  }

  console.log('\n  ── PROVENANCE ──');
  console.log(`    Source    : ${result.dataSource}`);
  console.log(`    Checked   : ${result.checkedAt}`);
  console.log('═'.repeat(60));
}

main().catch(console.error);
