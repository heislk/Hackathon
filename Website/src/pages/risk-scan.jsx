import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import GateBlur from "../components/GateBlur.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useSubscription } from "../context/SubscriptionContext.jsx";
import "../styles/risk-scan.css";

const EMAIL_API_BASE = (import.meta.env.VITE_EMAIL_INTEL_URL || "").replace(/\/$/, "");
const PHONE_API_BASE = (import.meta.env.VITE_PHONE_INTEL_URL || "/api/phone-scan").replace(/\/$/, "");
const TRUSTED_EMAIL_DOMAINS = [
  "coinbase.com",
  "gemini.com",
  "kraken.com",
  "binance.com",
  "robinhood.com",
  "crypto.com",
  "paypal.com",
  "apple.com",
  "google.com",
  "microsoft.com",
  "amazon.com",
  "chase.com",
];

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

function scoreToRiskTier(score) {
  if (score >= 0.90) return "CRITICAL";
  if (score >= 0.75) return "HIGH";
  if (score >= 0.50) return "MEDIUM";
  if (score >= 0.25) return "LOW";
  return "CLEAN";
}

function confidenceFromScore(score) {
  return score < 0.25 || score > 0.75 ? "HIGH" : "MEDIUM";
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

function isTrustedEmailDomain(domain) {
  if (!domain) return false;
  return TRUSTED_EMAIL_DOMAINS.some((trusted) => domain === trusted || domain.endsWith(`.${trusted}`));
}

function extractAuthenticationState(headers) {
  const lowerHeaders = headers.toLowerCase();
  return {
    spfPass: /\bspf=pass\b/.test(lowerHeaders) || /\breceived-spf:\s*pass\b/.test(lowerHeaders),
    dkimPass: /\bdkim=pass\b/.test(lowerHeaders),
    dmarcPass: /\bdmarc=pass\b/.test(lowerHeaders),
  };
}

function normalizeEmailRiskScore(rawMlScore, vtScore, trustedSender, authPassed, cleanLinkProfile) {
  if (trustedSender && authPassed && cleanLinkProfile && vtScore <= 0.25) {
    return Math.min(rawMlScore, 0.20 + vtScore * 0.25);
  }

  if (trustedSender && authPassed && vtScore <= 0.15) {
    return Math.min(rawMlScore, 0.35 + vtScore * 0.25);
  }

  return rawMlScore;
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
  const authState = extractAuthenticationState(headers);
  const trustedSenderDomain = isTrustedEmailDomain(fromDomain);
  const replyToMismatch = Boolean(fromDomain && replyToDomain && fromDomain !== replyToDomain);
  const suspiciousSenderDomain = Boolean(
    fromDomain && !trustedSenderDomain && /(?:secure|verify|support|wallet|login|alert|update|mail)/i.test(fromDomain)
  );
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

  const checkedItems = Math.max(1, urls.length + domains.length + cryptoAddresses.length + attachmentNames.length);
  const rawMlScore = Math.min(0.98, 0.12 + riskPoints * 0.11 + Math.min(0.12, urls.length * 0.02));
  const hasAuthenticationPass =
    authState.spfPass && authState.dkimPass && authState.dmarcPass;
  const cleanLinkProfile = !mismatchedLinks && !replyToMismatch && !replyToDomain;
  const vtScore = Math.min(1, checkedItems > 0 ? (mismatchedLinks || suspiciousSenderDomain || riskPoints >= 5 ? Math.min(checkedItems, Math.ceil(riskPoints / 2)) : 0) / checkedItems : 0);
  const mlScore = normalizeEmailRiskScore(
    rawMlScore,
    vtScore,
    trustedSenderDomain,
    hasAuthenticationPass,
    cleanLinkProfile
  );
  const hybridScore = Math.min(0.99, Math.max(mlScore, vtScore));
  const riskTier = scoreToRiskTier(hybridScore);
  const confidence = confidenceFromScore(hybridScore);
  const virusTotalFlagged = vtScore >= 0.25;
  const virusTotalHits = virusTotalFlagged ? Math.max(1, Math.round(vtScore * checkedItems)) : 0;

  const threatCategories = uniqueStrings([
    virusTotalFlagged && urls.length ? "phishing" : "",
    virusTotalFlagged && cryptoAddresses.length ? "wallet-drain" : "",
    virusTotalFlagged && attachmentNames.length ? "malicious-attachment" : "",
    virusTotalFlagged && (replyToMismatch || mismatchedLinks) ? "credential-theft" : "",
    virusTotalFlagged && riskTier === "CRITICAL" ? "high-confidence threat" : "",
  ]);

  return {
    processed_at: new Date().toISOString(),
    risk_tier: riskTier,
    ml_score: Number(mlScore.toFixed(4)),
    vt_score: Number(vtScore.toFixed(4)),
    hybrid_score: Number(hybridScore.toFixed(4)),
    confidence,
    extracted_features: {
      urls,
      domains,
      crypto_addresses: cryptoAddresses,
      attachment_names: attachmentNames.length ? attachmentNames : [file.name],
    },
    virus_total: {
      configured: true,
      checked_items: checkedItems,
      any_malicious: virusTotalFlagged,
      all_threat_categories: threatCategories.length ? threatCategories : ["none"],
    },
    explanation: {
      top_tokens: topTokens,
      trusted_sender_domain: trustedSenderDomain,
      spf_fail: !authState.spfPass,
      dkim_fail: !authState.dkimPass,
      dmarc_fail: !authState.dmarcPass,
      has_html_only_body: hasHtmlOnlyBody,
      has_mismatched_links: mismatchedLinks,
      reply_to_mismatch: replyToMismatch,
      suspicious_sender_domain: suspiciousSenderDomain,
      urgency_signal_count: urgencySignalCount,
      virus_total_flagged: virusTotalFlagged,
      virus_total_hits: virusTotalHits,
    },
    is_phishing: hybridScore >= 0.5,
  };
}

function isImageFile(file) {
  if (!file) return false;
  return Boolean(file.type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(file.name || ""));
}

function normalizePhoneNumber(rawValue) {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, "US");
  return parsed || null;
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
  if (kind === "phone") return "SMS / phone";
  if (kind === "phone-file") return "Phone screenshot";
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

function summarizeEmailFindings(data) {
  const explanation = data?.explanation ?? {};
  const features = data?.extracted_features ?? {};
  const reasons = [];

  if (explanation.trusted_sender_domain && !(explanation.spf_fail || explanation.dkim_fail || explanation.dmarc_fail)) {
    reasons.push("The sender domain is trusted and the message passed authentication checks.");
  }
  if (explanation.has_mismatched_links) {
    reasons.push("The message contains links that do not appear to match where they really send you.");
  }
  if (explanation.reply_to_mismatch) {
    reasons.push("The reply-to address does not line up with the visible sender, which is a common impersonation trick.");
  }
  if (explanation.spf_fail || explanation.dkim_fail || explanation.dmarc_fail) {
    reasons.push("Email authentication checks failed, so the sender identity is not trustworthy.");
  }
  if (explanation.urgency_signal_count > 0) {
    reasons.push(`The message uses urgency language ${explanation.urgency_signal_count} time${explanation.urgency_signal_count === 1 ? "" : "s"} to pressure fast action.`);
  }
  if (explanation.suspicious_sender_domain) {
    reasons.push("The sender domain looks suspicious or inconsistent with a real exchange support domain.");
  }
  if ((features.urls?.length ?? 0) > 0) {
    if (explanation.trusted_sender_domain && !(explanation.has_mismatched_links || explanation.reply_to_mismatch || explanation.spf_fail || explanation.dkim_fail || explanation.dmarc_fail)) {
      reasons.push(`It includes ${features.urls.length} link${features.urls.length === 1 ? "" : "s"}, but the sender looks trusted and the message passed authentication.`);
    } else {
      reasons.push(`It includes ${features.urls.length} link${features.urls.length === 1 ? "" : "s"}, which increases the chance of redirecting to a phishing page.`);
    }
  }
  if (explanation.virus_total_flagged) {
    reasons.push("External threat intelligence also flagged one or more of the indicators in this email.");
  }

  if (reasons.length === 0) {
    reasons.push("The scan did not find strong phishing signals, but you should still verify the sender and links through the official exchange app or website.");
  }

  return reasons.slice(0, 4);
}

function mapRiskTierToVerdict(riskTier) {
  if (riskTier === "HIGH" || riskTier === "CRITICAL") return "High Risk";
  if (riskTier === "MEDIUM") return "Suspicious";
  if (riskTier === "LOW") return "Needs Review";
  return "Likely Safe";
}

function summarizePhoneFindings(data) {
  const explanation = data?.explanation ?? data?.signals ?? {};
  const features = data?.extracted_features ?? data?.features ?? {};
  const phone = data?.phone ?? {};
  const reasons = [];

  if (explanation?.has_urls || (features?.urls?.length ?? 0) > 0) {
    reasons.push("The message contains URLs, which increases the chance that it is a phishing or smishing lure.");
  }
  if (explanation?.urgency_signal_count > 0) {
    reasons.push("The message uses urgent language or pressure tactics, which is common in scam text messages.");
  }
  if (explanation?.keyword_hits?.some((token) => ["verify", "confirm", "locked", "suspended", "payment", "refund", "delivery", "wallet"].includes(token))) {
    reasons.push("The message contains common scam trigger words tied to account access, delivery issues, payments, or crypto wallets.");
  }
  if (explanation?.keyword_hits?.some((token) => ["otp", "one-time code", "verify", "confirm"].includes(token))) {
    reasons.push("The message appears to involve verification, account recovery, or one-time-code style language.");
  }
  if (phone?.risk_notes?.length) {
    reasons.push(`The sender number lookup returned risk notes: ${phone.risk_notes.slice(0, 2).join(", ")}.`);
  }
  if (explanation?.ocr_confidence && explanation.ocr_confidence < 0.75) {
    reasons.push("OCR confidence was not perfect, so the screenshot should be reviewed carefully.");
  }

  if (reasons.length === 0) {
    reasons.push("The scan did not find strong smishing signals, but the number and message should still be verified carefully.");
  }

  return reasons.slice(0, 4);
}

function formatPhoneDisplayNumber(rawValue, parsedPhone) {
  if (parsedPhone?.formatInternational) {
    return parsedPhone.formatInternational();
  }

  if (parsedPhone?.number) {
    return parsedPhone.number;
  }

  const trimmed = rawValue?.trim();
  return trimmed || "Unknown";
}

function buildPhoneResponsePayload(data, { phoneNumber, phoneMessage, phoneImage, normalizedPhone }) {
  const displayValue = formatPhoneDisplayNumber(
    phoneNumber || phoneMessage || phoneImage?.name || "Phone evidence",
    normalizedPhone
  );
  const fallbackPhoneData = data?.phoneData ?? data?.analysis ?? data;
  const fallbackVerdict = data?.verdict ?? mapRiskTierToVerdict(fallbackPhoneData?.risk_tier ?? fallbackPhoneData?.riskTier);
  const providedResults = Array.isArray(data?.results) ? data.results.filter(Boolean) : [];
  const results =
    providedResults.length > 0
      ? providedResults
      : [
          {
            source: "phone-intelligence",
            kind: phoneImage ? "phone-file" : "phone",
            value: displayValue,
            verdict: fallbackVerdict,
            phoneData: fallbackPhoneData,
          },
        ];

  return {
    ...data,
    mode: data?.mode ?? "phone",
    scannedAt: data?.scannedAt ?? data?.processed_at ?? data?.processedAt ?? new Date().toISOString(),
    summary: data?.summary ?? {
      total: results.length,
      safe: results.filter((result) => result.verdict === "Likely Safe").length,
      needsReview: results.filter((result) => result.verdict === "Needs Review" || result.verdict === "Suspicious").length,
      highRisk: results.filter((result) => result.verdict === "High Risk").length,
      phoneTargets: phoneNumber ? 1 : 0,
      messageTargets: phoneMessage ? 1 : 0,
      screenshotTargets: phoneImage ? 1 : 0,
      successful: results.length,
    },
    results: results.map((result) => ({
      source: result.source ?? "phone-intelligence",
      kind: result.kind ?? (phoneImage ? "phone-file" : "phone"),
      value: result.value ?? displayValue,
      verdict: result.verdict ?? fallbackVerdict,
      phoneData: result.phoneData ?? fallbackPhoneData,
      isMalicious: result.isMalicious ?? (result.verdict === "High Risk" || result.verdict === "Suspicious"),
      error: result.error,
    })),
  };
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

function ChainResultContent({ result }) {
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
        <GateBlur featureKey="fullChainData" label="Full chain data">
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
        </GateBlur>

        <GateBlur featureKey="fullChainData" label="Balance and chain context">
          <section>
            <h4>Balances</h4>
            {renderBalances(summary?.currentBalance)}
          </section>
        </GateBlur>
      </div>

      <div className="risk-result__split">
        <GateBlur featureKey="riskFlags" label="Risk flags and notes">
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
        </GateBlur>

        <GateBlur featureKey="transactionHistory" label="Transaction history">
          <section>
            <h4>Recent activity</h4>
            {renderTransactions(activity?.recentTransactions)}
          </section>
        </GateBlur>
      </div>

      <GateBlur featureKey="fullChainData" label="Raw chain output">
        <details className="risk-raw">
          <summary>Show raw chain-intelligence output</summary>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </details>
      </GateBlur>
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
  const summaryPoints = summarizeEmailFindings(data);

  return (
    <div className="risk-result__content">
      <section className="risk-plain-language">
        <h4>Why this looks {result.verdict === "Likely Safe" ? "safer" : "suspicious"}</h4>
        <ul>
          {summaryPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

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
          <h4>Summary</h4>
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

function renderPhoneResult(result) {
  const data = result.phoneData ?? result.smsData ?? result.analysis ?? result.data ?? {};
  const features = data?.extracted_features ?? data?.features ?? {};
  const signals = data?.explanation ?? data?.signals ?? {};
  const ocr = data?.ocr ?? data?.ocr_result ?? {};
  const phone = data?.phone ?? {};
  const summaryPoints = summarizePhoneFindings(data);
  const urls = features?.urls ?? [];
  const domains = features?.domains ?? [];
  const brands = features?.brands ?? features?.impersonated_brands ?? [];
  const senderNumbers =
    features?.sender_numbers ??
    features?.sender_ids ??
    [features?.sender_number, phone?.formatted_international, phone?.normalized_e164, ...(features?.phone_numbers ?? [])].filter(Boolean);
  const phoneNumber =
    phone?.normalized_e164 ??
    phone?.formatted_international ??
    features?.sender_number ??
    data?.phone_number ??
    result.value;
  const displayMessage = features?.message_preview ?? data?.message ?? data?.normalized_message ?? data?.text ?? ocr?.text ?? "";
  const screenshotLabel = ocr?.image_name ?? data?.image_name ?? data?.screenshot_name ?? (result.kind === "phone-file" ? "Uploaded image" : "Not uploaded");
  const screenshotType = data?.image_detected ?? (result.kind === "phone-file" ? "Image" : "Text");
  const messageLength = signals?.message_length ?? features?.message_length ?? (displayMessage ? displayMessage.length : null);
  const modelScore = data?.model_probability ?? data?.ml_score ?? data?.probability ?? data?.sms_score ?? data?.scam_score;

  return (
    <div className="risk-result__content">
      <section className="risk-plain-language">
        <h4>Why this looks {result.verdict === "Likely Safe" ? "safer" : "suspicious"}</h4>
        <ul>
          {summaryPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <div className="risk-result__grid risk-result__grid--phone">
        <div>
          <span>Input type</span>
          <strong>{formatKindLabel(result.kind)}</strong>
        </div>
        <div>
          <span>Risk tier</span>
          <strong>{data?.risk_tier ?? data?.riskTier ?? "Unknown"}</strong>
        </div>
        <div>
          <span>Model score</span>
          <strong>{formatScore(modelScore)}</strong>
        </div>
        <div>
          <span>Confidence</span>
          <strong>{data?.confidence ?? signals?.confidence ?? "Unknown"}</strong>
        </div>
        <div>
          <span>OCR confidence</span>
          <strong>{formatScore(signals?.ocr_confidence ?? ocr?.confidence ?? data?.ocr_confidence)}</strong>
        </div>
        <div>
          <span>Message length</span>
          <strong>{messageLength ?? "Unknown"}</strong>
        </div>
      </div>

      <div className="risk-result__split">
        <GateBlur featureKey="riskFlags" label="Detailed phone signals">
          <section>
            <h4>Message and sender</h4>
            <div className="risk-data-list">
              <div className="risk-data-list__row">
                <div>
                  <strong>Sender</strong>
                  <p>{phoneNumber ?? "Unknown"}</p>
                </div>
                <span>{phone?.carrier ?? "Lookup"}</span>
              </div>
              <div className="risk-data-list__row">
                <div>
                  <strong>Region</strong>
                  <p>{phone?.region_code ?? "Unknown"}</p>
                </div>
                <span>{phone?.location ?? "Country / location"}</span>
              </div>
              <div className="risk-data-list__row">
                <div>
                  <strong>Number type</strong>
                  <p>{phone?.number_type ?? "Unknown"}</p>
                </div>
                <span>{phone?.valid ? "Valid" : "Unverified"}</span>
              </div>
              <div className="risk-data-list__row">
                <div>
                  <strong>Screenshot</strong>
                  <p>{screenshotLabel}</p>
                </div>
                <span>{screenshotType}</span>
              </div>
              <div className="risk-data-list__row">
                <div>
                  <strong>Message preview</strong>
                  <p>{displayMessage ? displayMessage.slice(0, 180) : "No message text returned."}</p>
                </div>
                <span>{displayMessage ? `${displayMessage.length} chars` : "Preview"}</span>
              </div>
            </div>
            {ocr?.text ? (
              <details className="risk-raw risk-raw--compact">
                <summary>Show OCR text</summary>
                <pre>{ocr.text}</pre>
              </details>
            ) : null}
          </section>
        </GateBlur>

        <GateBlur featureKey="riskFlags" label="Extracted phone indicators">
          <section>
            <h4>Extracted indicators</h4>
            <div className="risk-pill-list">
              {urls.length ? urls.slice(0, 4).map((url) => <span key={url}>{url}</span>) : <span>No URLs found</span>}
              {brands.length ? brands.slice(0, 4).map((brand) => <span key={brand}>{brand}</span>) : null}
              {senderNumbers.length ? senderNumbers.slice(0, 4).map((sender) => <span key={sender}>{sender}</span>) : null}
            </div>
            <div className="risk-flags">
              <strong>Signals</strong>
              <ul>
                <li>{signals?.has_urls || urls.length ? "URL present" : "No URL present"}</li>
                <li>{signals?.urgency_signal_count > 0 ? "Urgency language detected" : "No urgency language reported"}</li>
                <li>{signals?.keyword_hits?.length ? `Keyword hits: ${signals.keyword_hits.join(", ")}` : "No keyword hits reported"}</li>
                <li>{phone?.risk_notes?.length ? phone.risk_notes.join(", ") : "No number lookup risk notes"}</li>
                <li>{signals?.sender_voip ? "VOIP sender detected" : "No VOIP signal detected"}</li>
                <li>{signals?.ocr_confidence && signals.ocr_confidence < 0.75 ? "OCR confidence is low" : "OCR confidence acceptable"}</li>
              </ul>
            </div>
            {domains.length ? (
              <div className="risk-data-list">
                {domains.slice(0, 4).map((domain) => (
                  <div className="risk-data-list__row" key={domain}>
                    <div>
                      <strong>Domain</strong>
                      <p>{domain}</p>
                    </div>
                    <span>Indicator</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </GateBlur>
      </div>

      <GateBlur featureKey="fullChainData" label="Full phone payload">
        <details className="risk-raw">
          <summary>Show raw phone-intelligence output</summary>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </details>
      </GateBlur>
    </div>
  );
}

function UpgradeModal({ title, body }) {
  return (
    <div className="risk-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="risk-modal__card">
        <span className="risk-modal__eyebrow">Upgrade required</span>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="risk-modal__actions">
          <Link className="risk-modal__link risk-modal__link--primary" to="/account">
            View account
          </Link>
          <Link className="risk-modal__link risk-modal__link--secondary" to="/for-business">
            Explore plans
          </Link>
        </div>
      </div>
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
        <ChainResultContent result={result} />
      ) : result.source === "email-intelligence" ? (
        renderEmailResult(result)
      ) : result.source === "phone-intelligence" ? (
        renderPhoneResult(result)
      ) : (
        renderPhishingResult(result)
      )}
    </article>
  );
}

function RiskScan() {
  const { user, saveScan, recordEmailCheck } = useAuth();
  const { tier, usage, limits, canScan, canCheckEmail } = useSubscription();
  const [file, setFile] = useState(null);
  const [chainList, setChainList] = useState("");
  const [scanResponse, setScanResponse] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneMessage, setPhoneMessage] = useState("");
  const [phoneImage, setPhoneImage] = useState(null);
  const [phoneFeedback, setPhoneFeedback] = useState("");
  const normalizedPhone = useMemo(() => normalizePhoneNumber(phoneNumber), [phoneNumber]);
  const phonePreviewUrl = useMemo(() => {
    if (!phoneImage || !isImageFile(phoneImage)) return "";
    return URL.createObjectURL(phoneImage);
  }, [phoneImage]);

  useEffect(() => {
    return () => {
      if (phonePreviewUrl) {
        URL.revokeObjectURL(phonePreviewUrl);
      }
    };
  }, [phonePreviewUrl]);

  const parsedEntries = useMemo(() => parseTargets(chainList), [chainList]);
  const validEntries = parsedEntries.filter((entry) => entry.kind !== "unknown");
  const unknownEntries = parsedEntries.filter((entry) => entry.kind === "unknown");
  const hasSelectedEmailFile = isEmlFile(file);
  const hasPhonePayload = Boolean(phoneNumber.trim() || phoneMessage.trim() || phoneImage);
  const phoneDisplayValue = formatPhoneDisplayNumber(phoneNumber, normalizedPhone);

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] ?? null);
    setFeedback("");
  };

  const handlePhoneFileChange = (e) => {
    const selected = e.target.files?.[0] ?? null;
    setPhoneImage(selected);
    setPhoneFeedback("");
  };

  const persistResults = async (results) => {
    if (!user || !Array.isArray(results) || results.length === 0) return;
    await Promise.allSettled(
      results.map((result) =>
        saveScan(
          result.value,
          result.kind,
          result.verdict,
          result.isMalicious ?? result.emailData?.is_phishing ?? result.phishingData?.isPhishing ?? false,
          result.chainData || result.emailData || result.phishingData || null,
        )
      )
    );
  };

  const persistPhoneResults = async (results) => {
    if (!user || !Array.isArray(results) || results.length === 0) return;
    await Promise.allSettled(
      results.map((result) =>
        saveScan(
          result.value,
          result.kind,
          result.verdict,
          result.isMalicious ?? false,
          result.phoneData || null,
        )
      )
    );
  };

  const handleScan = async () => {
    if (hasSelectedEmailFile) {
      if (user && !canCheckEmail()) {
        setUpgradePrompt({
          title: "Monthly email check limit reached",
          body: "Your current plan has used all available email checks for this month. Upgrade to keep scanning suspicious inbox evidence.",
        });
        return;
      }

      setIsScanning(true);
      setFeedback("");
      setScanResponse(null);
      setUpgradePrompt(null);

      try {
        let data = null;
        let backendFailed = false;

        if (EMAIL_API_BASE) {
          try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`${EMAIL_API_BASE}/scan`, {
              method: "POST",
              body: formData,
            });

            if (response.ok) {
              data = await response.json();
            } else {
              const detail = await response.json().catch(() => null);
              backendFailed = true;
              setFeedback(detail?.detail || `Email scan failed with ${response.status}; using local fallback.`);
            }
          } catch (error) {
            backendFailed = true;
            setFeedback(error instanceof Error ? error.message : "Email backend unavailable; using local fallback.");
          }
        }

        if (!data) {
          const rawText = await file.text();
          data = buildEmailDemoResult(file, rawText);
          if (!backendFailed) {
            setFeedback("Used local trust-aware email fallback.");
          }
        }

        const emailResult = {
          source: "email-intelligence",
          kind: "file",
          value: file.name,
          verdict: mapEmailTierToVerdict(data?.risk_tier),
          emailData: data,
        };

        const responsePayload = {
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
        };

        setScanResponse(responsePayload);
        await Promise.allSettled([persistResults(responsePayload.results), recordEmailCheck()]);
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

    const projectedScanUsage = usage.weeklyScans + Math.max(1, validEntries.length);

    if (user && (!canScan() || (limits.weeklyScans !== Infinity && projectedScanUsage > limits.weeklyScans))) {
      setUpgradePrompt({
        title: "Weekly scan limit reached",
        body: "Your Free plan has used all available live scans for this week. Upgrade to Pro or Enterprise to keep investigating with full chain context.",
      });
      return;
    }

    setIsScanning(true);
    setFeedback("");
    setScanResponse(null);
    setUpgradePrompt(null);

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

      const responsePayload = { ...data, mode: "chain" };
      setScanResponse(responsePayload);
      void persistResults(responsePayload.results);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const handlePhoneScan = async () => {
    if (!hasPhonePayload) {
      setPhoneFeedback("Enter a phone number, message, or attach a screenshot to run the phone-intelligence scan.");
      return;
    }

    const projectedScanUsage = usage.weeklyScans + 1;
    if (user && (!canScan() || (limits.weeklyScans !== Infinity && projectedScanUsage > limits.weeklyScans))) {
      setUpgradePrompt({
        title: "Weekly scan limit reached",
        body: "Your Free plan has used all available live scans for this week. Upgrade to Pro or Enterprise to keep checking phone numbers and message screenshots.",
      });
      return;
    }

    setIsScanning(true);
    setFeedback("");
    setPhoneFeedback("");
    setScanResponse(null);
    setUpgradePrompt(null);

    try {
      const formData = new FormData();
      formData.append("phone_number", phoneNumber.trim());
      formData.append("normalized_phone_number", normalizedPhone?.number || "");
      formData.append("message", phoneMessage.trim());
      formData.append("mode", "phone");
      if (normalizedPhone?.country) {
        formData.append("country", normalizedPhone.country);
      }
      if (phoneImage) {
        formData.append("image", phoneImage);
        formData.append("screenshot_name", phoneImage.name);
      }

      const response = await fetch(`${PHONE_API_BASE}/scan`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Phone scan failed");
      }

      const responsePayload = buildPhoneResponsePayload(data, {
        phoneNumber: phoneNumber.trim(),
        phoneMessage: phoneMessage.trim(),
        phoneImage,
        normalizedPhone,
      });

      setScanResponse(responsePayload);
      void persistPhoneResults(responsePayload.results);
    } catch (error) {
      setPhoneFeedback(error instanceof Error ? error.message : "Phone scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const summary = scanResponse?.summary;
  const primaryResult = scanResponse?.results?.[0];
  const overallVerdict = primaryResult?.verdict ?? getOverallVerdict(summary);
  const scanLimitLabel = limits.weeklyScans === Infinity ? "Unlimited" : `${usage.weeklyScans}/${limits.weeklyScans}`;
  const emailLimitLabel = limits.monthlyEmails === Infinity ? "Unlimited" : `${usage.monthlyEmails}/${limits.monthlyEmails}`;

  return (
    <div className="page-shell">
      <Navbar />
      <main className="risk-page">
        <section className="risk-hero">
          <div className="risk-hero__copy">
            <h1>
              Upload the evidence.
              <br />
              Or paste the chain intel or phone evidence.
            </h1>
            <p>
              Submit a suspicious address, txid, or URL, or drop in a real .EML file.
              You can also paste a phone number plus message or upload a screenshot of the
              conversation. Chain targets run through the live chain-intelligence stack,
              while email files and phone evidence render on this page.
            </p>
            <div className="risk-hero__chips">
              <span>Arkham enrichment</span>
              <span>Wallet checks</span>
              <span>Txid review</span>
              <span>Phishing detection</span>
              <span>SMS / smishing</span>
              <span>OCR screenshots</span>
              <span>Live output</span>
            </div>
            <div className="risk-tier-strip">
              <div>
                <span className="risk-tier-strip__label">Current tier</span>
                <strong>{user ? tier : "Guest"}</strong>
              </div>
              <div>
                <span className="risk-tier-strip__label">Weekly scans</span>
                <strong>{user ? scanLimitLabel : "Create an account to track usage"}</strong>
              </div>
              <div>
                <span className="risk-tier-strip__label">Monthly email checks</span>
                <strong>{user ? emailLimitLabel : "Guest scans are not saved"}</strong>
              </div>
            </div>
          </div>
          <div className="risk-hero__stack">
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

              <p className="risk-upload-note">
                {user
                  ? "Signed-in scans are saved to your account and count against your current tier limits."
                  : "You can scan as a guest, but history and tracked limits unlock after you create an account."}
              </p>
            </div>
            <div className="risk-phone-card">
              <div className="risk-upload-card__header">
                <span className="risk-upload-card__badge">Phone intelligence</span>
                <h2>Check a number or text message</h2>
                <p>Paste the sender phone number and message, or upload a screenshot/photo so the phone-intelligence backend can OCR and score it.</p>
              </div>

              <label className="risk-phone-field">
                <span>Phone number</span>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 555-5555"
                  autoComplete="tel"
                  inputMode="tel"
                />
                <small>{normalizedPhone ? `Parsed as ${phoneDisplayValue}${normalizedPhone.country ? ` • ${normalizedPhone.country}` : ""}` : "Paste the sender number as-is. We normalize it before sending to the backend."}</small>
              </label>

              <label className="risk-text-field">
                <span>Message text</span>
                <textarea
                  value={phoneMessage}
                  onChange={(e) => setPhoneMessage(e.target.value)}
                  placeholder="Your package is on hold. Verify your address now: https://example.com"
                  rows={5}
                />
                <small>The backend can use the typed message, OCR text from screenshots, or both.</small>
              </label>

              <label className="risk-upload-field">
                <span>Phone screenshot</span>
                <div className="risk-upload-dropzone risk-upload-dropzone--image">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <path
                      d="M8 6h16a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2Zm3 4h10m-10 4h10m-10 4h6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Drop a screenshot or phone photo, or click to attach</span>
                  <input type="file" accept="image/*,.heic,.heif" onChange={handlePhoneFileChange} />
                </div>
              </label>

              <div className="risk-phone-preview">
                <div>
                  <span className="risk-upload-meta__label">Selected image</span>
                  <strong>{phoneImage ? phoneImage.name : "No screenshot selected yet"}</strong>
                </div>
                <div>
                  <span className="risk-upload-meta__label">Normalized number</span>
                  <strong>{normalizedPhone ? phoneDisplayValue : "Waiting on a number"}</strong>
                </div>
              </div>

              {phonePreviewUrl ? (
                <div className="risk-phone-preview__image">
                  <img src={phonePreviewUrl} alt="Selected phone screenshot preview" />
                </div>
              ) : null}

              {phoneFeedback ? <p className="risk-feedback">{phoneFeedback}</p> : null}

              <button className="btn btn--primary btn--full" onClick={handlePhoneScan} disabled={isScanning}>
                {isScanning ? "Scanning..." : "Run Phone Scan"}
              </button>

              <p className="risk-upload-note">
                {user
                  ? "Phone scans are stored in your account history when you are signed in."
                  : "Phone scans still run as a guest, but saving and usage tracking unlock after you create an account."}
              </p>
            </div>
          </div>
        </section>

        <section className="risk-report-grid">
          <article className="risk-panel">
            <span className="risk-panel__badge">What to upload</span>
            <h3>Useful evidence for a stronger review</h3>
            <ul className="risk-list">
              <li>Suspicious emails (.EML) for email intelligence</li>
              <li>Phone numbers, SMS threads, or message screenshots for smishing review</li>
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
                  <strong>Email and phone intelligence</strong>
                  <p>Real .EML uploads are parsed locally, and pasted SMS evidence or screenshots can flow into the phone-intelligence backend for OCR and smishing scoring.</p>
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
                ) : scanResponse.mode === "phone" ? (
                  <>
                    <StatCard label="Total targets" value={summary?.total ?? 0} hint="Phone messages or screenshots" />
                    <StatCard label="Safe" value={summary?.safe ?? 0} hint="Low-risk signals" />
                    <StatCard label="Needs review" value={summary?.needsReview ?? 0} hint="Mixed or partial signals" />
                    <StatCard label="High risk" value={summary?.highRisk ?? 0} hint="Likely scam text" />
                    <StatCard label="Phone inputs" value={summary?.phoneTargets ?? 1} hint="Numbers supplied" />
                    <StatCard label="Screenshot inputs" value={summary?.screenshotTargets ?? 0} hint="OCR-assisted" />
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
                          : result.source === "phone-intelligence"
                            ? "Phone classifier + OCR + phone-number enrichment"
                            : "Email phishing model + local indicator analysis"}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Submission note</h4>
                  <p>
                    Wallet inputs run through the live chain-intelligence stack, while .EML uploads
                    are parsed locally in the browser so the demo stays self-contained and still
                    renders the full payload for analysts who want every field. Phone screenshots
                    and pasted messages are forwarded to the phone-intelligence backend for OCR,
                    metadata enrichment, and smishing classification.
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
                  : scanResponse.mode === "phone"
                    ? "Each card below reflects the phone number, message, or screenshot you submitted."
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

        {upgradePrompt ? <UpgradeModal title={upgradePrompt.title} body={upgradePrompt.body} /> : null}
      </main>
      <Footer />
    </div>
  );
}

export default RiskScan;
