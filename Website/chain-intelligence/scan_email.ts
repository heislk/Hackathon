/**
 * chain-intelligence/scan_email.ts
 *
 * Email Phishing Intelligence CLI — orchestrates the full email scanning pipeline:
 *
 *   1. Read .eml file from disk
 *   2. POST to Python FastAPI service (localhost:8000/scan)
 *      → Runs: EML parse → PII redact → DistilBERT inference → VirusTotal hybrid response
 *   3. Print the Python service's built-in ML + VirusTotal hybrid score
 *   4. Print formatted report to console
 *   5. Write full result JSON to output/email_result.json
 *
 *   Risk tiers:
 *     CLEAN    < 0.25
 *     LOW      0.25 – 0.50
 *     MEDIUM   0.50 – 0.75
 *     HIGH     0.75 – 0.90
 *     CRITICAL ≥ 0.90
 *
 * USAGE:
 *   npx ts-node scan_email.ts <path/to/email.eml>
 *
 * REQUIREMENTS:
 *   - Python FastAPI service running: cd email-intelligence && uvicorn src.api:app --port 8000
 *   - VIRUSTOTAL_API_KEY in email-intelligence/.env (optional — skipped if not set)
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const PYTHON_SERVICE_URL = process.env.EMAIL_INTEL_URL ?? 'http://localhost:8000';
const OUTPUT_DIR = path.join(__dirname, 'output');

// ─── Risk tier lookup ─────────────────────────────────────────────────────────
function scoreToTier(score: number): string {
  if (score >= 0.90) return 'CRITICAL';
  if (score >= 0.75) return 'HIGH';
  if (score >= 0.50) return 'MEDIUM';
  if (score >= 0.25) return 'LOW';
  return 'CLEAN';
}

function tierIcon(tier: string): string {
  switch (tier) {
    case 'CRITICAL': return '🔴';
    case 'HIGH':     return '🟠';
    case 'MEDIUM':   return '🟡';
    case 'LOW':      return '🔵';
    default:         return '🟢';
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const emlPath = process.argv[2];

  if (!emlPath) {
    console.error('Usage: npx ts-node scan_email.ts <path/to/email.eml>');
    process.exit(1);
  }

  if (!fs.existsSync(emlPath)) {
    console.error(`❌ File not found: ${emlPath}`);
    process.exit(1);
  }

  if (!emlPath.toLowerCase().endsWith('.eml')) {
    console.error('❌ Only .eml files are supported.');
    process.exit(1);
  }

  const filename = path.basename(emlPath);
  console.log(`\n📧 Scanning email: ${filename}`);
  console.log('   (PII is redacted locally before any external calls)\n');

  // ── Step 1: Call Python ML service ────────────────────────────────────────
  console.log('[1/4] Running DistilBERT phishing classifier...');
  let mlResponse: any;

  try {
    const emlBytes = fs.readFileSync(emlPath);
    const formData = new FormData();
    const blob = new Blob([emlBytes], { type: 'message/rfc822' });
    formData.append('file', blob, filename);

    const response = await axios.post(`${PYTHON_SERVICE_URL}/scan`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });
    mlResponse = response.data;
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED') {
      console.error(
        '\n❌ Python ML service is not running.\n' +
        '   Start it with:\n' +
        '   cd email-intelligence && uvicorn src.api:app --port 8000\n'
      );
    } else if (err.response?.status === 503) {
      console.error(
        '\n❌ Model not trained yet.\n' +
        '   Run: cd email-intelligence && python scripts/download_dataset.py\n' +
        '         then: python scripts/train.py\n'
      );
    } else {
      console.error('❌ ML service error:', err.response?.data?.detail ?? err.message);
    }
    process.exit(1);
  }

  const mlScore: number = mlResponse.ml_score ?? 0;
  const mlTier: string = mlResponse.ml_risk_tier ?? mlResponse.risk_tier ?? scoreToTier(mlScore);
  const vtSummary: any = mlResponse.virus_total ?? null;
  const vtScore: number = mlResponse.vt_score ?? vtSummary?.vt_score ?? 0;
  const hybridScore: number = mlResponse.hybrid_score ?? mlScore;
  const finalTier: string = mlResponse.risk_tier ?? scoreToTier(hybridScore);
  const finalIsPhishing: boolean = mlResponse.is_phishing ?? hybridScore >= 0.5;
  const features = mlResponse.extracted_features ?? {};
  const explanation = mlResponse.explanation ?? {};

  console.log(`   ✓ ML Score: ${(mlScore * 100).toFixed(1)}% phishing probability`);

  // ── Step 2: Display built-in VirusTotal hybrid result ─────────────────────
  if (vtSummary?.configured) {
    console.log(`[2/3] VirusTotal: ${vtSummary.checked_items ?? 0} checked item(s), ${(vtScore * 100).toFixed(1)}% malicious`);
  } else {
    console.log('[2/3] VirusTotal: skipped (no VIRUSTOTAL_API_KEY configured)');
  }

  console.log('[3/3] Using hybrid score from Python service...');
  const icon = tierIcon(finalTier);

  // ── Print report ─────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(62));
  console.log(`  📧 EMAIL PHISHING INTELLIGENCE REPORT`);
  console.log('═'.repeat(62));
  console.log(`  File      : ${filename}`);
  console.log(`  Scanned   : ${new Date().toLocaleString()}`);
  console.log(`  Redacted  : ✓ (PII stripped before all processing)`);

  console.log('\n  ── UNIFIED RISK SCORE ──');
  console.log(`    ${icon} Risk Tier   : ${finalTier}`);
  console.log(`    📊 Final Score  : ${(hybridScore * 100).toFixed(1)} / 100`);

  console.log('\n  ── SIGNAL BREAKDOWN ──');
  console.log(`    🧠 ML Model     : ${(mlScore * 100).toFixed(1)}%  (${mlTier})`);
  console.log(`    🔬 VirusTotal   : ${vtSummary?.configured ? `${(vtScore * 100).toFixed(1)}%` : 'N/A (no key)'}`);
  console.log(`    🧩 Hybrid Score : ${(hybridScore * 100).toFixed(1)}%`);

  console.log('\n  ── ML EXPLANATION ──');
  console.log(`    Tier            : ${mlTier} (confidence: ${mlResponse.ml_confidence ?? mlResponse.confidence ?? 'N/A'})`);
  if (mlResponse.explanation?.top_tokens?.length > 0) {
    console.log(`    Top Tokens      : ${mlResponse.explanation.top_tokens.join(', ')}`);
  }

  console.log('\n  ── EMAIL AUTHENTICATION ──');
  console.log(`    SPF             : ${explanation.spf_fail  ? '🚩 FAIL' : '✅ pass'}`);
  console.log(`    DKIM            : ${explanation.dkim_fail ? '🚩 FAIL' : '✅ pass'}`);
  console.log(`    DMARC           : ${explanation.dmarc_fail? '🚩 FAIL' : '✅ pass'}`);

  console.log('\n  ── BEHAVIORAL SIGNALS ──');
  console.log(`    Urgency phrases : ${explanation.urgency_signal_count ?? 0}`);
  console.log(`    HTML-only body  : ${explanation.has_html_only_body ? '🚩 Yes' : 'No'}`);
  console.log(`    Mismatched links: ${explanation.has_mismatched_links ? '🚩 Yes' : 'No'}`);
  console.log(`    Reply-To mismatch: ${explanation.reply_to_mismatch ? '🚩 Yes' : 'No'}`);
  console.log(`    Sender suspicious: ${explanation.suspicious_sender_domain ? '🚩 Yes' : 'No'}`);
  console.log(`    Attachments     : ${explanation.attachment_count ?? 0}`);
  console.log(`    Routing hops    : ${explanation.received_hops ?? 0}`);
  console.log(`    VirusTotal hits : ${explanation.virus_total_hits ?? 0}`);
  console.log(`    VT flagged      : ${explanation.virus_total_flagged ? '🚩 Yes' : 'No'}`);

  // Extracted features summary
  if (features.urls?.length > 0) {
    console.log('\n  ── EXTRACTED URLS ──');
    for (const url of (features.urls as string[]).slice(0, 8)) {
      console.log(`    → ${url}`);
    }
    if (features.urls.length > 8) {
      console.log(`    ... and ${features.urls.length - 8} more`);
    }
  }
  if (features.crypto_addresses?.length > 0) {
    console.log('\n  ── EXTRACTED CRYPTO ADDRESSES ──');
    for (const addr of (features.crypto_addresses as string[]).slice(0, 8)) {
      console.log(`    → ${addr}`);
    }
    if (features.crypto_addresses.length > 8) {
      console.log(`    ... and ${features.crypto_addresses.length - 8} more`);
    }
  }

  console.log('\n  ── PROVENANCE ──');
  console.log(`    Model           : ${mlResponse.model_version ?? 'distilbert-phishing-v1'}`);
  console.log(`    Data Sources    : DistilBERT (local)${vtSummary?.configured ? ', VirusTotal' : ''}`);
  console.log(`    Processed At    : ${mlResponse.processed_at ?? new Date().toISOString()}`);
  console.log('═'.repeat(62));

  // ── Write output JSON ─────────────────────────────────────────────────────
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const outputData = {
    file: filename,
    scannedAt: new Date().toISOString(),
    unified: {
      finalScore: parseFloat(hybridScore.toFixed(4)),
      riskTier: finalTier,
      isPhishing: finalIsPhishing,
    },
    signals: {
      ml: { score: mlScore, tier: mlTier, confidence: mlResponse.ml_confidence ?? mlResponse.confidence },
      virustotal: vtSummary,
    },
    explanation,
    extractedFeatures: features,
    modelVersion: mlResponse.model_version,
    privacyNote: 'All PII was redacted locally before any external API calls. No raw email content was transmitted.',
  };

  const outputPath = path.join(OUTPUT_DIR, 'email_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`\n✅ Full result written to output/email_result.json\n`);
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
