import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { queryChainIntelligence, checkPhishingUrl } from './src/index';
import { logger } from './src/utils/logger';
import type { InputType, NormalizedOutput } from './src/types';

type ScanInputKind = InputType | 'unknown';

interface ScanInputPayload {
  value: string;
  kind?: ScanInputKind;
}

interface ScanResultPayload {
  value: string;
  kind: ScanInputKind;
  inputType: InputType;
  verdict: 'Likely Safe' | 'Needs Review' | 'Suspicious' | 'High Risk';
  isMalicious: boolean;
  source: 'chain-intelligence' | 'phishing';
  chainData?: NormalizedOutput | null;
  phishingData?: any;
  error?: string;
}

interface BatchScanResponse {
  scannedAt: string;
  summary: {
    total: number;
    processed: number;
    successful: number;
    safe: number;
    needsReview: number;
    suspicious: number;
    highRisk: number;
    chainTargets: number;
    urlTargets: number;
  };
  results: ScanResultPayload[];
}

const PORT = Number(process.env.CHAIN_INTEL_PORT ?? 8787);
const JSON_LIMIT_BYTES = 1_000_000;

function isUrlLike(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (trimmed.includes(' ') || trimmed.includes(',')) return false;
  if (trimmed.startsWith('0x')) return false;
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return false;
  return trimmed.includes('.') || trimmed.includes('/');
}

function inferInputType(value: string): InputType {
  const trimmed = value.trim();
  if (trimmed.startsWith('0x') && trimmed.length >= 64) return 'txhash';
  if (trimmed.startsWith('0x')) return 'address';
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return 'txhash';
  return 'address';
}

function inferKind(value: string, kind?: ScanInputKind): ScanInputKind {
  if (kind && kind !== 'unknown') return kind;
  if (isUrlLike(value)) return 'url';
  return inferInputType(value);
}

function getVerdict(isMalicious: boolean, source: 'chain-intelligence' | 'phishing', data: any): ScanResultPayload['verdict'] {
  if (source === 'phishing') {
    return data?.isPhishing ? 'High Risk' : 'Likely Safe';
  }

  if (!isMalicious) return 'Likely Safe';

  const flags = data?.intelligence?.maliciousFlags?.length ?? 0;
  const txCount = data?.summary?.txCount ?? 0;
  if (flags >= 3 || txCount >= 25) return 'High Risk';
  if (flags >= 1) return 'Suspicious';
  return 'Needs Review';
}

function getJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let bytesRead = 0;
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      bytesRead += chunk.length;
      if (bytesRead > JSON_LIMIT_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendNoContent(res: ServerResponse) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
}

async function scanTarget(input: ScanInputPayload): Promise<ScanResultPayload> {
  const kind = inferKind(input.value, input.kind);

  if (kind === 'url') {
    const phishingData = await checkPhishingUrl(input.value);
    const isMalicious = Boolean(phishingData?.isPhishing);
    return {
      value: input.value,
      kind,
      inputType: 'url',
      verdict: getVerdict(isMalicious, 'phishing', phishingData),
      isMalicious,
      source: 'phishing',
      phishingData
    };
  }

  const inputType = inferInputType(input.value);
  const chainData = await queryChainIntelligence({
    inputType,
    value: input.value,
  });

  const isMalicious = Boolean(chainData?.intelligence?.isMalicious);
  return {
    value: input.value,
    kind,
    inputType,
    verdict: getVerdict(isMalicious, 'chain-intelligence', chainData),
    isMalicious,
    source: 'chain-intelligence',
    chainData
  };
}

function summarizeResults(results: ScanResultPayload[]): BatchScanResponse['summary'] {
  const chainTargets = results.filter((result) => result.source === 'chain-intelligence').length;
  const urlTargets = results.filter((result) => result.source === 'phishing').length;
  const successful = results.filter((result) => !result.error).length;
  const safe = results.filter((result) => !result.error && result.verdict === 'Likely Safe').length;
  const needsReview = results.filter((result) => !result.error && result.verdict === 'Needs Review').length;
  const suspicious = results.filter((result) => !result.error && result.verdict === 'Suspicious').length;
  const highRisk = results.filter((result) => !result.error && result.verdict === 'High Risk').length;

  return {
    total: results.length,
    processed: results.length,
    successful,
    safe,
    needsReview,
    suspicious,
    highRisk,
    chainTargets,
    urlTargets,
  };
}

async function handleScan(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await getJsonBody(req);
    const inputs: ScanInputPayload[] = Array.isArray(body?.inputs)
      ? body.inputs
      : body?.value
        ? [{ value: String(body.value), kind: body?.kind }]
        : [];

    const cleanedInputs = inputs
      .map((input) => ({
        value: String(input?.value ?? '').trim(),
        kind: input?.kind,
      }))
      .filter((input) => Boolean(input.value));

    if (cleanedInputs.length === 0) {
      sendJson(res, 400, { error: 'Provide at least one address, txid, or URL.' });
      return;
    }

    const results: ScanResultPayload[] = [];
    for (const input of cleanedInputs) {
      try {
        results.push(await scanTarget(input));
      } catch (err: any) {
        results.push({
          value: input.value,
          kind: inferKind(input.value, input.kind),
          inputType: inferInputType(input.value),
          verdict: 'Needs Review',
          isMalicious: false,
          source: 'chain-intelligence',
          error: err?.message ?? 'Unexpected scan error'
        });
      }
    }

    const payload: BatchScanResponse = {
      scannedAt: new Date().toISOString(),
      summary: summarizeResults(results),
      results
    };

    sendJson(res, 200, payload);
  } catch (err: any) {
    logger.error('Chain intelligence scan failed', err?.message ?? err);
    sendJson(res, 500, { error: err?.message ?? 'Scan failed' });
  }
}

const server = createServer((req, res) => {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (method === 'OPTIONS') {
    sendNoContent(res);
    return;
  }

  if (method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'chain-intelligence', port: PORT });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/scan') {
    void handleScan(req, res);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  logger.info(`Chain intelligence API listening on http://127.0.0.1:${PORT}`);
});
