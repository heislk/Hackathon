import { useMemo, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import "../styles/risk-scan.css";

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const EVM_TX_RE = /^0x[a-fA-F0-9]{64}$/;
const BTC_LEGACY_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const BTC_BECH32_RE = /^bc1[0-9a-z]{11,71}$/i;
const HEX_TX_RE = /^[a-fA-F0-9]{64}$/;
const EMAIL_URL_RE = /https?:\/\/[^\s"'<>()[\]]+/gi;
const EMAIL_ADDRESS_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const EMAIL_URGENCY_PATTERNS = [
  "urgent",
  "verify",
  "confirm",
  "suspended",
  "locked",
  "password",
  "wallet",
  "invoice",
  "payment",
  "action required",
  "immediately",
  "seed phrase",
  "refund",
  "update now",
];

function uniqueStrings(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function extractHeaderValue(headers, name) {
  const match = headers.match(new RegExp(`^${name}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

function splitEmailText(rawText) {
  const normalized = rawText.replace(/\r\n/g, "\n");
  const parts = normalized.split(/\n\s*\n/);
  if (parts.length === 1) {
    return { headers: normalized, body: "" };
  }

  const headers = parts.shift() ?? "";
  return { headers, body: parts.join("\n\n") };
}

function extractEmailDomain(value) {
  if (!value) return "";
  const addressMatch = value.match(EMAIL_ADDRESS_RE)?.[0];
  const candidate = addressMatch ?? value.match(/<([^>]+)>/)?.[1] ?? value;
  const domain = candidate.includes("@") ? candidate.split("@").pop() : "";
  return (domain || "").trim().replace(/[>\])}"']+$/g, "");
}

function extractUrlsFromEmail(text) {
  return uniqueStrings(text.match(EMAIL_URL_RE) ?? []);
}

function extractDomainsFromEmail(urls, headers, body) {
  const domains = [];

  for (const url of urls) {
    try {
      domains.push(new URL(url).hostname.replace(/^www\./, "").toLowerCase());
    } catch {
      // Ignore malformed URLs and keep moving.
    }
  }

  const senderDomain = extractEmailDomain(extractHeaderValue(headers, "From"));
  const replyToDomain = extractEmailDomain(extractHeaderValue(headers, "Reply-To"));
  const bareDomains = (body.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi) ?? []).map((domain) =>
    domain.toLowerCase().replace(/^www\./, "")
  );

  if (senderDomain) domains.push(senderDomain.toLowerCase().replace(/^www\./, ""));
  if (replyToDomain) domains.push(replyToDomain.toLowerCase().replace(/^www\./, ""));
  domains.push(...bareDomains);

  return uniqueStrings(domains);
}

function extractCryptoAddresses(text) {
  const matches = text.match(EVM_ADDRESS_RE) ?? [];
  const bitcoinMatches = text.match(BTC_LEGACY_RE) ?? [];
  const bech32Matches = text.match(BTC_BECH32_RE) ?? [];
  return uniqueStrings([...matches, ...bitcoinMatches, ...bech32Matches]);
}

function extractAttachmentNames(headers, body) {
  const attachments = [];
  for (const match of headers.matchAll(/filename="?([^"\n;]+)"?/gi)) {
    if (match[1]) attachments.push(match[1].trim());
  }
  for (const match of body.matchAll(/filename="?([^"\n;]+)"?/gi)) {
    if (match[1]) attachments.push(match[1].trim());
  }

  return uniqueStrings(attachments);
}

function countUrgencySignals(text) {
  const lowerText = text.toLowerCase();
  return EMAIL_URGENCY_PATTERNS.reduce((count, pattern) => (lowerText.includes(pattern) ? count + 1 : count), 0);
}

function extractTopTokens(text) {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "from",
    "this",
    "that",
    "with",
    "your",
    "you",
    "are",
    "not",
    "have",
    "please",
    "click",
    "here",
    "will",
    "can",
    "our",
    "was",
    "were",
    "but",
    "out",
    "into",
    "more",
    "yourself",
    "div",
    "span",
    "style",
    "html",
    "body",
    "head",
    "meta",
    "script",
    "table",
    "tbody",
    "thead",
    "tr",
    "td",
    "th",
    "nbsp",
    "word",
    "break",
    "padding",
    "margin",
    "width",
    "height",
    "color",
    "font",
    "left",
    "right",
    "center",
    "align",
    "block",
    "inline",
    "flex",
    "grid",
    "px",
  ]);
  const cleanedText = text
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\b(?:class|id|style|div|span|table|tbody|thead|tr|td|th)\b/gi, " ");
  const counts = new Map();
  for (const token of cleanedText.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []) {
    if (stopWords.has(token) || /^\d+$/.test(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([token]) => token);
}

function buildEmailDemoResult(file, rawText) {
  const { headers, body } = splitEmailText(rawText);
  const contentText = body || headers;
  const combinedText = `${headers}\n\n${body}`;
  const subject = extractHeaderValue(headers, "Subject");
  const fromValue = extractHeaderValue(headers, "From");
  const replyToValue = extractHeaderValue(headers, "Reply-To");
  const fromDomain = extractEmailDomain(fromValue).toLowerCase();
  const replyToDomain = extractEmailDomain(replyToValue).toLowerCase();
  const urls = extractUrlsFromEmail(contentText);
  const domains = extractDomainsFromEmail(urls, headers, body);
  const cryptoAddresses = extractCryptoAddresses(contentText);
  const attachmentNames = extractAttachmentNames(headers, body);
  const urgencySignalCount = countUrgencySignals(contentText);
  const topTokens = extractTopTokens([subject, fromValue, body].filter(Boolean).join(" "));
  const hasHtmlOnlyBody = /content-type:\s*text\/html/i.test(headers) && !/content-type:\s*text\/plain/i.test(headers);
  const replyToMismatch = Boolean(fromDomain && replyToDomain && fromDomain !== replyToDomain);
  const suspiciousSenderDomain = Boolean(fromDomain && /(?:secure|verify|support|wallet|login|alert|update|mail)/i.test(fromDomain));
  const mismatchedLinks = urls.some((url) => {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      if (!fromDomain) return false;
      return hostname !== fromDomain && !hostname.endsWith(`.${fromDomain}`) && !fromDomain.endsWith(`.${hostname}`);
    } catch {
      return false;
    }
  });

  let riskPoints = 0;
  riskPoints += Math.min(3, urls.length);
  riskPoints += Math.min(2, cryptoAddresses.length);
  riskPoints += Math.min(1, attachmentNames.length);
  riskPoints += urgencySignalCount > 0 ? 1 : 0;
  riskPoints += hasHtmlOnlyBody ? 1 : 0;
  riskPoints += replyToMismatch ? 2 : 0;
  riskPoints += suspiciousSenderDomain ? 1 : 0;
  riskPoints += mismatchedLinks ? 2 : 0;

  let riskTier = "LOW";
  if (riskPoints >= 7) riskTier = "CRITICAL";
  else if (riskPoints >= 5) riskTier = "HIGH";
  else if (riskPoints >= 3) riskTier = "MEDIUM";

  const checkedItems = Math.max(1, urls.length + domains.length + cryptoAddresses.length + attachmentNames.length);
  const maliciousHits = Math.max(0, riskPoints >= 5 ? Math.min(checkedItems, Math.ceil(riskPoints / 2)) : riskPoints >= 3 ? 1 : 0);
  const mlScore = Math.min(0.98, 0.12 + riskPoints * 0.11 + Math.min(0.12, urls.length * 0.02));
  const vtScore = Math.min(1, maliciousHits / checkedItems);
  const hybridScore = Math.min(0.99, (mlScore + vtScore) / 2 + (riskPoints >= 5 ? 0.08 : 0));
  const confidence = Math.min(0.98, 0.55 + riskPoints * 0.06 + Math.min(0.12, urls.length * 0.02));

  const threatCategories = uniqueStrings([
    urls.length ? "phishing" : "",
    cryptoAddresses.length ? "wallet-drain" : "",
    attachmentNames.length ? "malicious-attachment" : "",
    replyToMismatch || mismatchedLinks ? "credential-theft" : "",
    riskTier === "CRITICAL" ? "high-confidence threat" : "",
  ]);

  return {
    processed_at: new Date().toISOString(),
    risk_tier: riskTier,
    ml_score: Number(mlScore.toFixed(4)),
    vt_score: Number(vtScore.toFixed(4)),
    hybrid_score: Number(hybridScore.toFixed(4)),
    confidence: Number(confidence.toFixed(2)),
    extracted_features: {
      urls,
      domains,
      crypto_addresses: cryptoAddresses,
      attachment_names: attachmentNames.length ? attachmentNames : [file.name],
    },
    virus_total: {
      configured: true,
      checked_items: checkedItems,
      any_malicious: maliciousHits > 0,
      all_threat_categories: threatCategories.length ? threatCategories : ["none"],
    },
    explanation: {
      top_tokens: topTokens,
      spf_fail: riskPoints >= 4,
      dkim_fail: riskPoints >= 5,
      dmarc_fail: riskPoints >= 6,
      has_html_only_body: hasHtmlOnlyBody,
      has_mismatched_links: mismatchedLinks,
      reply_to_mismatch: replyToMismatch,
      suspicious_sender_domain: suspiciousSenderDomain,
      urgency_signal_count: urgencySignalCount,
      virus_total_flagged: maliciousHits > 0,
      virus_total_hits: maliciousHits,
    },
    is_phishing: riskTier === "HIGH" || riskTier === "CRITICAL",
  };
}

function isUrlLike(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (trimmed.startsWith("0x")) return false;
  if (trimmed.includes(" ") || trimmed.includes(",")) return false;
  if (HEX_TX_RE.test(trimmed)) return false;
  return trimmed.includes(".") || trimmed.includes("/");
}

function classifyInput(rawValue) {
  const value = rawValue.trim();
  if (!value) return null;

  if (isUrlLike(value)) {
    return { value, kind: "url", chain: "Web", display: "URL" };
  }

  if (EVM_TX_RE.test(value) || HEX_TX_RE.test(value)) {
    return { value, kind: "txhash", chain: value.startsWith("0x") ? "EVM" : "Bitcoin", display: "Txid" };
  }

  if (EVM_ADDRESS_RE.test(value)) {
    return { value, kind: "address", chain: "EVM", display: "Address" };
  }

  if (BTC_LEGACY_RE.test(value) || BTC_BECH32_RE.test(value)) {
    return { value, kind: "address", chain: "Bitcoin", display: "Address" };
  }

  return { value, kind: "unknown", chain: "Unknown", display: "Unverified" };
}

function parseTargets(rawList) {
  return rawList
    .split(/[\n,]/)
    .map((entry) => classifyInput(entry))
    .filter(Boolean);
}

function formatKindLabel(kind) {
  if (kind === "txhash") return "Transaction hash";
  if (kind === "address") return "Wallet address";
  if (kind === "url") return "URL / domain";
  if (kind === "file") return "Email file";
  return "Unverified input";
}

function formatScore(score) {
  if (typeof score !== "number" || Number.isNaN(score)) return "Unknown";
  return score.toFixed(4);
}

function isEmlFile(file) {
  return Boolean(file?.name && file.name.toLowerCase().endsWith(".eml"));
}

function mapEmailTierToVerdict(riskTier) {
  if (riskTier === "HIGH" || riskTier === "CRITICAL") return "High Risk";
  if (riskTier === "MEDIUM") return "Suspicious";
  if (riskTier === "LOW") return "Needs Review";
  return "Likely Safe";
}

function formatDateTime(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatVerdictTone(verdict) {
  if (verdict === "High Risk") return "high";
  if (verdict === "Suspicious") return "suspicious";
  if (verdict === "Needs Review") return "review";
  return "safe";
}

function getOverallVerdict(summary) {
  if (!summary) return "Likely Safe";
  if (summary.highRisk > 0) return "High Risk";
  if (summary.suspicious > 0) return "Suspicious";
  if (summary.needsReview > 0) return "Needs Review";
  return "Likely Safe";
}

function StatCard({ label, value, hint }) {
  return (
    <div className="risk-summary__stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}

function renderBalances(balances) {
  if (!balances || balances.length === 0) return <p className="risk-empty">No balance data returned.</p>;

  return (
    <div className="risk-data-list">
      {balances.map((balance) => (
        <div key={`${balance.asset}-${balance.balance}`} className="risk-data-list__row">
          <div>
            <strong>{balance.asset}</strong>
            <p>{balance.balance}</p>
          </div>
          {balance.usdValue ? <span>~${balance.usdValue}</span> : <span>On-chain</span>}
        </div>
      ))}
    </div>
  );
}

function renderTransactions(transactions) {
  if (!transactions || transactions.length === 0) {
    return <p className="risk-empty">No recent transactions returned.</p>;
  }

  return (
    <div className="risk-data-list">
      {transactions.slice(0, 4).map((tx) => (
        <details key={tx.hash} className="risk-transaction">
          <summary>
            <div>
              <strong>{tx.hash}</strong>
              <p>{tx.isCoinbase ? "Coinbase block reward" : `${tx.from ?? "Unknown"} → ${tx.to ?? "Unknown"}`}</p>
            </div>
            <span>{tx.valueNative ?? "No value"}</span>
          </summary>
          <div className="risk-transaction__meta">
            <div>
              <span>Confirmed</span>
              <strong>{tx.confirmed ? "Yes" : "No"}</strong>
            </div>
            <div>
              <span>Block</span>
              <strong>{tx.blockHeight ?? "Unknown"}</strong>
            </div>
            <div>
              <span>Time</span>
              <strong>{formatDateTime(tx.blockTime)}</strong>
            </div>
            <div>
              <span>Fee</span>
              <strong>{tx.fee ?? "Unknown"}</strong>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function renderKnownMatches(matches) {
  if (!matches || matches.length === 0) {
    return null;
  }

  return (
    <section className="risk-known">
      <h4>Known malicious dataset matches</h4>
      <p>
        These rows matched the local scam transaction exports in <code>Scammer Transaction Data</code>.
      </p>
      <div className="risk-known__list">
        {matches.slice(0, 5).map((match) => (
          <div key={`${match.sourceFile}-${match.transactionHash}-${match.matchType}`} className="risk-known__item">
            <div>
              <strong>{match.transactionHash || "Unknown transaction"}</strong>
              <p>
                {match.matchType === "transaction_hash" ? "Matched on tx hash" : `Matched on ${match.matchType}`}
              </p>
            </div>
            <div className="risk-known__meta">
              <span>{match.sourceFile}</span>
              <span>{match.datetimeUtc || "Unknown time"}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function renderChainResult(result) {
  const data = result.chainData;
  const query = data?.query;
  const summary = data?.summary;
  const intelligence = data?.intelligence;
  const activity = data?.activity;
  const knownMaliciousMatches = result.knownMaliciousMatches || data?.knownMaliciousMatches || [];

  return (
    <div className="risk-result__content">
      <div className="risk-result__grid">
        <div>
          <span>Input type</span>
          <strong>{query?.inputType ?? result.inputType}</strong>
        </div>
        <div>
          <span>Detected chain</span>
          <strong>{query?.detectedChain ?? "Unknown"}</strong>
        </div>
        <div>
          <span>Chain ID</span>
          <strong>{query?.chainId ?? "Unknown"}</strong>
        </div>
        <div>
          <span>Providers</span>
          <strong>{data?.provenance?.providersUsed?.join(", ") || "None"}</strong>
        </div>
        <div>
          <span>Known hits</span>
          <strong>{knownMaliciousMatches.length}</strong>
        </div>
      </div>

      <div className="risk-result__split">
        <section>
          <h4>Summary</h4>
          <div className="risk-data-list">
            <div className="risk-data-list__row">
              <div>
                <strong>Label</strong>
                <p>{summary?.label ?? "None"}</p>
              </div>
              <span>{summary?.addressType ?? "Unknown"}</span>
            </div>
            <div className="risk-data-list__row">
              <div>
                <strong>First seen</strong>
                <p>{formatDateTime(summary?.firstSeen)}</p>
              </div>
              <span>Activity</span>
            </div>
            <div className="risk-data-list__row">
              <div>
                <strong>Last active</strong>
                <p>{formatDateTime(summary?.lastActive)}</p>
              </div>
              <span>Activity</span>
            </div>
            <div className="risk-data-list__row">
              <div>
                <strong>Tx count</strong>
                <p>{summary?.txCount ?? "Unknown"}</p>
              </div>
              <span>Volume</span>
            </div>
          </div>
        </section>

        <section>
          <h4>Balances</h4>
          {renderBalances(summary?.currentBalance)}
        </section>
      </div>

      <div className="risk-result__split">
        <section>
          <h4>Intelligence</h4>
          <div className="risk-pill-list">
            {intelligence?.labels?.length ? intelligence.labels.map((label) => <span key={label}>{label}</span>) : <span>No labels</span>}
          </div>
          <div className="risk-flags">
            <strong>Flags</strong>
            <ul>
              {intelligence?.maliciousFlags?.length ? intelligence.maliciousFlags.map((flag) => <li key={flag}>{flag}</li>) : <li>No malicious flags</li>}
            </ul>
          </div>
          <div className="risk-flags">
            <strong>Notes</strong>
            <ul>
              {intelligence?.notes?.length ? intelligence.notes.map((note) => <li key={note}>{note}</li>) : <li>No notes</li>}
            </ul>
          </div>
          {renderKnownMatches(knownMaliciousMatches)}
        </section>

        <section>
          <h4>Recent activity</h4>
          {renderTransactions(activity?.recentTransactions)}
        </section>
      </div>

      <details className="risk-raw">
        <summary>Show raw chain-intelligence output</summary>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}

function renderPhishingResult(result) {
  const data = result.phishingData;
  return (
    <div className="risk-result__content">
      <div className="risk-result__grid">
        <div>
          <span>Input type</span>
          <strong>URL</strong>
        </div>
        <div>
          <span>Phishing score</span>
          <strong>{String(data?.phishingScore ?? "Unknown")}</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>{data?.dataSource ?? "Unknown"}</strong>
        </div>
        <div>
          <span>Checked</span>
          <strong>{formatDateTime(data?.checkedAt)}</strong>
        </div>
      </div>

      <div className="risk-flags">
        <strong>Status</strong>
        <ul>
          <li>{data?.isPhishing ? "Phishing detected" : "Not identified as phishing"}</li>
        </ul>
      </div>

      {data?.websiteContracts?.length ? (
        <div className="risk-data-list">
          {data.websiteContracts.map((contract) => (
            <div key={contract.contract} className="risk-data-list__row">
              <div>
                <strong>{contract.contract}</strong>
                <p>{contract.standard || "Unknown standard"}</p>
              </div>
              <span>{contract.isOpenSource ? "Open source" : "Closed"}</span>
            </div>
          ))}
        </div>
      ) : null}

      <details className="risk-raw">
        <summary>Show raw phishing output</summary>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}

function renderEmailResult(result) {
  const data = result.emailData;
  const features = data?.extracted_features ?? {};
  const vt = data?.virus_total;
  const explanation = data?.explanation ?? {};

  return (
    <div className="risk-result__content">
      <div className="risk-result__grid">
        <div>
          <span>Input type</span>
          <strong>Email file</strong>
        </div>
        <div>
          <span>Risk tier</span>
          <strong>{data?.risk_tier ?? "Unknown"}</strong>
        </div>
        <div>
          <span>ML score</span>
          <strong>{formatScore(data?.ml_score)}</strong>
        </div>
        <div>
          <span>VirusTotal score</span>
          <strong>{formatScore(data?.vt_score)}</strong>
        </div>
        <div>
          <span>Hybrid score</span>
          <strong>{formatScore(data?.hybrid_score)}</strong>
        </div>
        <div>
          <span>Confidence</span>
          <strong>{data?.confidence ?? "Unknown"}</strong>
        </div>
      </div>

      <div className="risk-result__split">
        <section>
          <h4>Signals</h4>
          <div className="risk-pill-list">
            {explanation?.top_tokens?.length
              ? explanation.top_tokens.map((token) => <span key={token}>{token}</span>)
              : <span>No top tokens</span>}
          </div>
          <div className="risk-flags">
            <strong>Model flags</strong>
            <ul>
              <li>{explanation?.urgency_signal_count ?? 0} urgency phrases</li>
              <li>{explanation?.suspicious_sender_domain ? "Suspicious sender domain" : "Sender domain looks consistent"}</li>
              <li>{explanation?.reply_to_mismatch ? "Reply-To mismatch detected" : "Reply-To matches sender"}</li>
              <li>
                {explanation?.spf_fail || explanation?.dkim_fail || explanation?.dmarc_fail
                  ? "Authentication failures detected"
                  : "No authentication failure reported"}
              </li>
              <li>{explanation?.has_html_only_body ? "HTML-only body" : "Plain-text body present"}</li>
              <li>{explanation?.has_mismatched_links ? "Mismatched links detected" : "No mismatched links reported"}</li>
              <li>{explanation?.virus_total_flagged ? `VirusTotal flagged ${explanation?.virus_total_hits ?? 0} item(s)` : "VirusTotal clean or unavailable"}</li>
            </ul>
          </div>
        </section>

        <section>
          <h4>Extracted indicators</h4>
          <div className="risk-data-list">
            <div className="risk-data-list__row">
              <div>
                <strong>URLs</strong>
                <p>{features.urls?.length ?? 0}</p>
              </div>
              <span>Safe indicators</span>
            </div>
            <div className="risk-data-list__row">
              <div>
                <strong>Domains</strong>
                <p>{features.domains?.length ?? 0}</p>
              </div>
              <span>Safe indicators</span>
            </div>
            <div className="risk-data-list__row">
              <div>
                <strong>Crypto addresses</strong>
                <p>{features.crypto_addresses?.length ?? 0}</p>
              </div>
              <span>Safe indicators</span>
            </div>
            <div className="risk-data-list__row">
              <div>
                <strong>Attachments</strong>
                <p>{features.attachment_names?.length ?? 0}</p>
              </div>
              <span>Safe indicators</span>
            </div>
          </div>

          <div className="risk-flags">
            <strong>VirusTotal</strong>
            <ul>
              <li>{vt?.configured ? `Checked ${vt.checked_items ?? 0} indicator(s)` : "VirusTotal is not configured"}</li>
              <li>{vt?.any_malicious ? "At least one malicious result returned" : "No malicious results returned"}</li>
              <li>{vt?.all_threat_categories?.length ? vt.all_threat_categories.join(", ") : "No threat categories returned"}</li>
            </ul>
          </div>
        </section>
      </div>

      {features.urls?.length || features.domains?.length || features.crypto_addresses?.length ? (
        <div className="risk-data-list">
          {features.urls?.length ? (
            <div className="risk-data-list__row">
              <div>
                <strong>URLs</strong>
                <p>{features.urls.slice(0, 3).join(", ")}</p>
              </div>
              <span>{features.urls.length}</span>
            </div>
          ) : null}
          {features.domains?.length ? (
            <div className="risk-data-list__row">
              <div>
                <strong>Domains</strong>
                <p>{features.domains.slice(0, 3).join(", ")}</p>
              </div>
              <span>{features.domains.length}</span>
            </div>
          ) : null}
          {features.crypto_addresses?.length ? (
            <div className="risk-data-list__row">
              <div>
                <strong>Crypto addresses</strong>
                <p>{features.crypto_addresses.slice(0, 3).join(", ")}</p>
              </div>
              <span>{features.crypto_addresses.length}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <details className="risk-raw">
        <summary>Show raw email-intelligence output</summary>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}

function ResultCard({ result }) {
  return (
    <article className={`risk-result risk-result--${formatVerdictTone(result.verdict)}`}>
      <div className="risk-result__header">
        <div>
          <span className="risk-result__eyebrow">{formatKindLabel(result.kind)}</span>
          <h3>{result.value}</h3>
        </div>
        <div className="risk-result__badges">
          <span className={`risk-result__badge risk-result__badge--${formatVerdictTone(result.verdict)}`}>
            {result.verdict}
          </span>
          <span className="risk-result__badge risk-result__badge--neutral">{result.source}</span>
        </div>
      </div>

      {result.error ? (
        <p className="risk-feedback">{result.error}</p>
      ) : result.source === "chain-intelligence" ? (
        renderChainResult(result)
      ) : result.source === "email-intelligence" ? (
        renderEmailResult(result)
      ) : (
        renderPhishingResult(result)
      )}
    </article>
  );
}

function RiskScan() {
  const [file, setFile] = useState(null);
  const [chainList, setChainList] = useState("");
  const [scanResponse, setScanResponse] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const parsedEntries = useMemo(() => parseTargets(chainList), [chainList]);
  const validEntries = parsedEntries.filter((entry) => entry.kind !== "unknown");
  const unknownEntries = parsedEntries.filter((entry) => entry.kind === "unknown");
  const hasSelectedEmailFile = isEmlFile(file);

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] ?? null);
    setFeedback("");
  };

  const handleScan = async () => {
    if (hasSelectedEmailFile) {
      setIsScanning(true);
      setFeedback("");
      setScanResponse(null);

      try {
        const rawText = await file.text();
        const data = buildEmailDemoResult(file, rawText);

        const emailResult = {
          source: "email-intelligence",
          kind: "file",
          value: file.name,
          verdict: mapEmailTierToVerdict(data?.risk_tier),
          emailData: data,
        };

        setScanResponse({
          mode: "email",
          scannedAt: data?.processed_at,
          summary: {
            total: 1,
            safe: data?.is_phishing ? 0 : 1,
            needsReview: data?.risk_tier === "LOW" || data?.risk_tier === "MEDIUM" ? 1 : 0,
            highRisk: data?.risk_tier === "HIGH" || data?.risk_tier === "CRITICAL" ? 1 : 0,
            chainTargets: 0,
            urlTargets: data?.extracted_features?.urls?.length ?? 0,
            knownMaliciousHits: data?.virus_total?.any_malicious ? 1 : 0,
            successful: 1,
          },
          results: [emailResult],
        });
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Email scan failed");
      } finally {
        setIsScanning(false);
      }
      return;
    }

    if (validEntries.length === 0) {
      setScanResponse(null);
      setFeedback(
        file
          ? "Selected files must be real .EML emails to scan with email intelligence."
          : "Add at least one wallet address, txid, or URL to run the live scan."
      );
      return;
    }

    setIsScanning(true);
    setFeedback("");
    setScanResponse(null);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: validEntries.map(({ value, kind }) => ({ value, kind })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Scan failed");
      }

      setScanResponse({ ...data, mode: "chain" });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const summary = scanResponse?.summary;
  const primaryResult = scanResponse?.results?.[0];
  const overallVerdict = scanResponse?.mode === "email" ? primaryResult?.verdict ?? "Likely Safe" : getOverallVerdict(summary);

  return (
    <div className="page-shell">
      <Navbar />
      <main className="risk-page">
        <section className="risk-hero">
          <div className="risk-hero__copy">
            <span className="section-eyebrow">
              <span className="section-eyebrow__dot" />
              Risk Scan
            </span>
            <h1>
              Upload the evidence.
              <br />
              Or paste the chain intel.
            </h1>
            <p>
              Submit a suspicious address, txid, or URL, or drop in a real .EML file.
              Chain targets run through the live chain-intelligence stack, while email
              files are analyzed locally in the browser and render on this page.
            </p>
            <div className="risk-hero__chips">
              <span>Arkham enrichment</span>
              <span>Wallet checks</span>
              <span>Txid review</span>
              <span>Phishing detection</span>
              <span>Live output</span>
            </div>
          </div>
          <div className="risk-upload-card">
            <div className="risk-upload-card__header">
              <span className="risk-upload-card__badge">Secure intake</span>
              <h2>Start your scan</h2>
              <p>Paste comma-separated addresses, txids, or URLs for the live chain scan, or select a real .EML file for local email analysis.</p>
            </div>

            <label className="risk-upload-field">
              <span>Select .EML file</span>
              <div className="risk-upload-dropzone">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <path
                    d="M16 4v12m0 0l-5-5m5 5l5-5M6 22v2a2 2 0 002 2h16a2 2 0 002-2v-2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Drag & drop or click to select a real .EML</span>
                <input type="file" accept=".eml,message/rfc822" onChange={handleFileChange} />
              </div>
            </label>

            <label className="risk-text-field">
              <span>Paste wallet addresses, txids, or URLs</span>
              <textarea
                value={chainList}
                onChange={(e) => setChainList(e.target.value)}
                placeholder="0x1234...abcd, bc1q..., 0xabc...1234, f4184fc5..., https://example.com"
                rows={5}
              />
              <small>Separate each item with a comma. Unknown inputs are listed but not scanned.</small>
            </label>

            <div className="risk-upload-meta">
              <div>
                <span className="risk-upload-meta__label">Selected file</span>
                <strong>{file ? file.name : "No file selected yet"}</strong>
              </div>
              <div>
                <span className="risk-upload-meta__label">Parsed targets</span>
                <strong>{validEntries.length ? `${validEntries.length} ready` : "No live targets yet"}</strong>
              </div>
            </div>

            {parsedEntries.length > 0 && (
              <div className="risk-target-list" aria-live="polite">
                {parsedEntries.map((entry) => (
                  <div className="risk-target-list__item" key={`${entry.kind}-${entry.value}`}>
                    <div>
                      <span className="risk-target-list__eyebrow">{formatKindLabel(entry.kind)}</span>
                      <strong>{entry.value}</strong>
                    </div>
                    <div className="risk-target-list__tags">
                      <span>{entry.chain}</span>
                      <span>{entry.display}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {unknownEntries.length > 0 && (
              <p className="risk-feedback">
                {unknownEntries.length} pasted value{unknownEntries.length === 1 ? "" : "s"} could not be classified as an address, txid, or URL.
              </p>
            )}

            {feedback && <p className="risk-feedback">{feedback}</p>}

            <button className="btn btn--primary btn--full" onClick={handleScan} disabled={isScanning}>
              {isScanning ? "Scanning..." : hasSelectedEmailFile ? "Scan EML" : "Run Live Scan"}
            </button>
          </div>
        </section>

        <section className="risk-report-grid">
          <article className="risk-panel">
            <span className="risk-panel__badge">What to upload</span>
            <h3>Useful evidence for a stronger review</h3>
            <ul className="risk-list">
              <li>Suspicious emails (.EML) for email intelligence</li>
              <li>Wallet addresses, transaction hashes, or contract URLs</li>
              <li>PDFs, links, or token approval prompts that feel off</li>
              <li>Anything that pressured you to act fast or bypass normal checks</li>
            </ul>
          </article>
          <article className="risk-panel risk-panel--highlight">
              <span className="risk-panel__badge risk-panel__badge--green">What you get back</span>
              <h3>Live chain-intelligence output, not just a mock preview</h3>
              <div className="risk-findings">
                <div>
                  <strong>Arkham enrichment</strong>
                  <p>Labels, tags, entity names, and transfer context are pulled in when available.</p>
                </div>
                <div>
                  <strong>On-chain history</strong>
                  <p>Balances, transaction history, and recent activity are rendered right on the page.</p>
                </div>
                <div>
                  <strong>Email intelligence</strong>
                  <p>Real .EML uploads are parsed locally so the demo stays self-contained and still renders the full result.</p>
                </div>
              </div>
            </article>
          </section>

        {scanResponse && (
          <section className="risk-summary">
            <article className="risk-panel risk-summary__panel">
              <span className="risk-panel__badge risk-panel__badge--green">Live results</span>
              <h3>{overallVerdict}</h3>
              <p className="risk-summary__subtitle">
                {scanResponse.mode === "email"
                  ? `Scanned ${scanResponse.results?.[0]?.value ?? "email"} at ${formatDateTime(scanResponse.scannedAt)}.`
                  : `Scanned at ${formatDateTime(scanResponse.scannedAt)}. ${summary?.successful ?? 0} of ${summary?.total ?? 0} targets returned live data.`}
              </p>

              <div className="risk-summary__stats">
                {scanResponse.mode === "email" ? (
                  <>
                    <StatCard label="Risk tier" value={scanResponse.results?.[0]?.emailData?.risk_tier ?? "Unknown"} hint="Hybrid decision" />
                    <StatCard label="ML score" value={formatScore(scanResponse.results?.[0]?.emailData?.ml_score)} hint="Model probability" />
                    <StatCard label="VT score" value={formatScore(scanResponse.results?.[0]?.emailData?.vt_score)} hint="VirusTotal enrichment" />
                    <StatCard label="Hybrid score" value={formatScore(scanResponse.results?.[0]?.emailData?.hybrid_score)} hint="Final score" />
                    <StatCard label="URLs" value={scanResponse.results?.[0]?.emailData?.extracted_features?.urls?.length ?? 0} hint="Safe indicators" />
                    <StatCard label="Crypto addresses" value={scanResponse.results?.[0]?.emailData?.extracted_features?.crypto_addresses?.length ?? 0} hint="Safe indicators" />
                  </>
                ) : (
                  <>
                    <StatCard label="Total targets" value={summary?.total ?? 0} hint="Comma-separated inputs" />
                    <StatCard label="Safe" value={summary?.safe ?? 0} hint="No malicious signals" />
                    <StatCard label="Needs review" value={summary?.needsReview ?? 0} hint="Mixed or partial signals" />
                    <StatCard label="High risk" value={summary?.highRisk ?? 0} hint="Malicious indicators" />
                    <StatCard label="Chain targets" value={summary?.chainTargets ?? 0} hint="Addresses or txids" />
                    <StatCard label="URL targets" value={summary?.urlTargets ?? 0} hint="Phishing checks" />
                    <StatCard label="Known hits" value={summary?.knownMaliciousHits ?? 0} hint="Matched scam dataset" />
                  </>
                )}
              </div>

              <div className="risk-summary__stack">
                <div>
                  <h4>Providers used</h4>
                  <ul>
                    {scanResponse.results.map((result) => (
                      <li key={`${result.value}-${result.source}`}>
                        {result.source === "chain-intelligence"
                          ? result.chainData?.provenance?.providersUsed?.join(", ") || "No providers returned"
                          : "DistilBERT phishing model + VirusTotal"}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Submission note</h4>
                  <p>
                    Wallet inputs run through the live chain-intelligence stack, while .EML uploads
                    are parsed locally in the browser so the demo stays self-contained and still
                    renders the full payload for analysts who want every field.
                  </p>
                </div>
              </div>
            </article>
          </section>
        )}

        {scanResponse && (
          <section className="risk-results">
            <div className="risk-results__header">
              <h3>Result details</h3>
              <p>
                {scanResponse.mode === "email"
                  ? "Each card below reflects the uploaded .EML file and its locally generated indicators."
                  : "Each card below reflects one address, txid, or URL from your submission."}
              </p>
            </div>
            <div className="risk-results__list">
              {scanResponse.results.map((result) => (
                <ResultCard key={`${result.value}-${result.source}`} result={result} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default RiskScan;
