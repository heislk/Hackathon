/**
 * chain-intelligence/src/providers/virustotal.ts
 *
 * VirusTotal Provider — checks extracted URLs, domains, and file hashes
 * against the VirusTotal threat intelligence database.
 *
 * PRIVACY DESIGN:
 *   This provider ONLY sends:
 *     - SHA256 hashes of email attachments (not the attachment content)
 *     - Domain strings extracted from URLs (not email body text)
 *     - Full URLs (not email body text or any PII)
 *
 *   It NEVER receives or transmits:
 *     - Raw email content
 *     - Email addresses (sender, recipient)
 *     - Any PII from the email
 *
 * RATE LIMITING:
 *   VirusTotal free tier: 4 requests/minute, 500 requests/day.
 *   This provider implements queueing and backoff to respect these limits.
 *   Set VIRUSTOTAL_API_KEY in .env. Get a free key at virustotal.com.
 *
 * API DOCUMENTATION:
 *   https://developers.virustotal.com/reference/overview
 *
 * REQUIRED ENV VARS:
 *   VIRUSTOTAL_API_KEY — your VirusTotal API key (free tier works)
 */

import axios, { AxiosError } from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const VT_API_BASE = 'https://www.virustotal.com/api/v3';
const VT_API_KEY  = process.env.VIRUSTOTAL_API_KEY ?? '';

// Delay between requests to stay within free-tier rate limits (4 req/min = 1 per 15s)
const REQUEST_DELAY_MS = 15_000;

// ─── Result types ─────────────────────────────────────────────────────────────

export interface VTUrlResult {
  /** The URL that was checked */
  url: string;
  /** Domain extracted from the URL */
  domain: string;
  /** Number of AV engines that flagged this URL as malicious */
  maliciousVotes: number;
  /** Number of AV engines that flagged this URL as suspicious */
  suspiciousVotes: number;
  /** Total number of AV engines that analyzed this URL */
  totalEngines: number;
  /** Threat categories reported (e.g. ["phishing", "malware-distribution"]) */
  threatCategories: string[];
  /** True if >10% of engines flagged it as malicious */
  isMalicious: boolean;
  /** Date of the most recent VT analysis */
  lastAnalysisDate: string | null;
  /** Permalink to VirusTotal report for this URL */
  permalink: string;
}

export interface VTHashResult {
  /** The SHA256 hash that was checked */
  hash: string;
  /** Number of AV engines that detected it as malicious */
  maliciousVotes: number;
  /** Total engines */
  totalEngines: number;
  /** Detected threat name (e.g. "Trojan.GenericKD.12345") */
  threatName: string | null;
  /** File type as identified by VT */
  fileType: string | null;
  /** Whether any engine flagged this as malicious */
  isMalicious: boolean;
  /** Date of most recent analysis */
  lastAnalysisDate: string | null;
}

export interface VTScanSummary {
  /** URL-level results */
  urlResults: VTUrlResult[];
  /** Attachment hash results */
  hashResults: VTHashResult[];
  /** Computed 0.0–1.0 score: fraction of checked items flagged as malicious */
  vtScore: number;
  /** True if any URL or hash is flagged as malicious */
  anyMalicious: boolean;
  /** All unique threat category labels found */
  allThreatCategories: string[];
}

// ─── Provider class ───────────────────────────────────────────────────────────

export class VirusTotalProvider {
  private readonly apiKey: string;
  private lastRequestTime: number = 0;

  constructor(apiKey: string = VT_API_KEY) {
    this.apiKey = apiKey;
  }

  /** Returns true if a VirusTotal API key is configured. */
  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Scan a list of URLs and attachment hashes extracted from an email.
   *
   * @param urls     URLs extracted from the email body (not the email body itself)
   * @param hashes   SHA256 hashes of email attachments (not the attachment bytes)
   * @param maxChecks Max number of items to check (to conserve API quota)
   */
  async scanEmailFeatures(
    urls: string[],
    hashes: string[],
    maxChecks: number = 5
  ): Promise<VTScanSummary> {
    if (!this.isConfigured()) {
      console.warn('[WARN] VirusTotal: No API key configured. Skipping VT checks.');
      return this.emptySummary();
    }

    const urlResults:  VTUrlResult[]  = [];
    const hashResults: VTHashResult[] = [];

    // Check up to maxChecks items total (urls first, then hashes)
    const urlsToCheck   = urls.slice(0, maxChecks);
    const hashesRemaining = Math.max(0, maxChecks - urlsToCheck.length);
    const hashesToCheck = hashes.slice(0, hashesRemaining);

    for (const url of urlsToCheck) {
      try {
        const result = await this.checkUrl(url);
        urlResults.push(result);
      } catch (err) {
        console.warn(`[WARN] VirusTotal: URL check failed for ${url}: ${(err as Error).message}`);
      }
    }

    for (const hash of hashesToCheck) {
      try {
        const result = await this.checkHash(hash);
        hashResults.push(result);
      } catch (err) {
        console.warn(`[WARN] VirusTotal: Hash check failed for ${hash.slice(0,16)}...: ${(err as Error).message}`);
      }
    }

    return this.buildSummary(urlResults, hashResults);
  }

  /**
   * Check a single URL against VirusTotal.
   * Sends only the URL string — no email context.
   */
  async checkUrl(url: string): Promise<VTUrlResult> {
    await this.throttle();

    // VT v3 URL endpoint requires base64url-encoded URL as the id
    const urlId = Buffer.from(url).toString('base64url');

    try {
      const response = await axios.get(`${VT_API_BASE}/urls/${urlId}`, {
        headers: { 'x-apikey': this.apiKey },
        timeout: 15_000,
      });

      const attrs = response.data?.data?.attributes ?? {};
      const stats = attrs.last_analysis_stats ?? {};
      const totalEngines = (stats.malicious ?? 0) + (stats.undetected ?? 0) + (stats.suspicious ?? 0) + (stats.harmless ?? 0);

      const categories: string[] = Object.values(attrs.categories ?? {}) as string[];
      const uniqueCategories = [...new Set(categories)];

      const malicious = stats.malicious ?? 0;
      const suspicious = stats.suspicious ?? 0;

      const hostname = (() => {
        try { return new URL(url).hostname; } catch { return url; }
      })();

      return {
        url,
        domain: hostname,
        maliciousVotes: malicious,
        suspiciousVotes: suspicious,
        totalEngines,
        threatCategories: uniqueCategories,
        isMalicious: totalEngines > 0 && (malicious / totalEngines) > 0.10,
        lastAnalysisDate: attrs.last_analysis_date
          ? new Date(attrs.last_analysis_date * 1000).toISOString()
          : null,
        permalink: `https://www.virustotal.com/gui/url/${urlId}`,
      };

    } catch (err) {
      const axErr = err as AxiosError;
      if (axErr.response?.status === 404) {
        // URL not yet in VT database — submit it
        return this.submitAndReturnPlaceholder(url);
      }
      throw err;
    }
  }

  /**
   * Check a SHA256 file hash against VirusTotal.
   * Sends only the hash string — no file content.
   */
  async checkHash(sha256: string): Promise<VTHashResult> {
    await this.throttle();

    try {
      const response = await axios.get(`${VT_API_BASE}/files/${sha256}`, {
        headers: { 'x-apikey': this.apiKey },
        timeout: 15_000,
      });

      const attrs = response.data?.data?.attributes ?? {};
      const stats = attrs.last_analysis_stats ?? {};
      const malicious = stats.malicious ?? 0;
      const total = Object.values(stats as Record<string, number>).reduce((a: number, b: number) => a + b, 0);

      return {
        hash: sha256,
        maliciousVotes: malicious,
        totalEngines: total,
        threatName: attrs.popular_threat_classification?.suggested_threat_label ?? null,
        fileType: attrs.type_description ?? null,
        isMalicious: total > 0 && (malicious / total) > 0.05,
        lastAnalysisDate: attrs.last_analysis_date
          ? new Date(attrs.last_analysis_date * 1000).toISOString()
          : null,
      };

    } catch (err) {
      const axErr = err as AxiosError;
      if (axErr.response?.status === 404) {
        // Hash not found in VT — unknown file, not necessarily malicious
        return {
          hash: sha256,
          maliciousVotes: 0,
          totalEngines: 0,
          threatName: null,
          fileType: null,
          isMalicious: false,
          lastAnalysisDate: null,
        };
      }
      throw err;
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Rate limiter — ensures minimum gap between requests to respect VT free tier. */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < REQUEST_DELAY_MS) {
      const waitMs = REQUEST_DELAY_MS - elapsed;
      console.log(`[INFO] VirusTotal: Rate limiting — waiting ${Math.ceil(waitMs / 1000)}s...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
    this.lastRequestTime = Date.now();
  }

  /** Submit a new URL to VT and return a placeholder (VT analysis takes ~60s). */
  private async submitAndReturnPlaceholder(url: string): Promise<VTUrlResult> {
    try {
      await axios.post(
        `${VT_API_BASE}/urls`,
        new URLSearchParams({ url }),
        { headers: { 'x-apikey': this.apiKey, 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
    } catch {
      // Submission failure is non-fatal
    }

    const hostname = (() => {
      try { return new URL(url).hostname; } catch { return url; }
    })();

    return {
      url,
      domain: hostname,
      maliciousVotes: 0,
      suspiciousVotes: 0,
      totalEngines: 0,
      threatCategories: [],
      isMalicious: false,
      lastAnalysisDate: null,
      permalink: `https://www.virustotal.com/gui/url/${Buffer.from(url).toString('base64url')}`,
    };
  }

  private buildSummary(urlResults: VTUrlResult[], hashResults: VTHashResult[]): VTScanSummary {
    const totalItems = urlResults.length + hashResults.length;
    const maliciousItems =
      urlResults.filter(r => r.isMalicious).length +
      hashResults.filter(r => r.isMalicious).length;

    const vtScore = totalItems > 0 ? maliciousItems / totalItems : 0;
    const anyMalicious = maliciousItems > 0;

    const allCategories = [
      ...urlResults.flatMap(r => r.threatCategories),
    ];

    return {
      urlResults,
      hashResults,
      vtScore: Math.min(1.0, vtScore),
      anyMalicious,
      allThreatCategories: [...new Set(allCategories)],
    };
  }

  private emptySummary(): VTScanSummary {
    return {
      urlResults: [],
      hashResults: [],
      vtScore: 0,
      anyMalicious: false,
      allThreatCategories: [],
    };
  }
}
