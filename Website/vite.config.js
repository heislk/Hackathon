import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import Papa from 'papaparse'
import { createAuthApiPlugin } from './server/auth-plugin.mjs'

const chainIntelEntry = pathToFileURL(
  path.resolve(process.cwd(), 'chain-intelligence/dist/src/index.js')
).href

function normalizeKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

function loadKnownMaliciousIndex() {
  const dataDir = path.resolve(process.cwd(), 'chain-intelligence/Scammer Transaction Data')
  const txHashes = new Map()
  const addresses = new Map()
  let totalRows = 0

  if (!fs.existsSync(dataDir)) {
    return { txHashes, addresses, totalRows }
  }

  for (const fileName of fs.readdirSync(dataDir)) {
    if (!fileName.toLowerCase().endsWith('.csv')) continue

    const filePath = path.join(dataDir, fileName)
    const csvText = fs.readFileSync(filePath, 'utf8')
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    })

    for (const row of parsed.data) {
      if (!row || typeof row !== 'object') continue
      totalRows += 1

      const detail = {
        sourceFile: fileName,
        transactionHash: row['Transaction Hash'] || null,
        from: row.From || null,
        to: row.To || null,
        fromNameTag: row.From_Nametag || null,
        toNameTag: row.To_Nametag || null,
        status: row.Status || null,
        method: row.Method || null,
        datetimeUtc: row['DateTime (UTC)'] || null,
        amount: row.Amount || null,
        valueUsd: row['Value (USD)'] || null,
        txnFee: row['Txn Fee'] || null,
      }

      const txHash = normalizeKey(detail.transactionHash)
      const from = normalizeKey(detail.from)
      const to = normalizeKey(detail.to)

      if (txHash) {
        if (!txHashes.has(txHash)) txHashes.set(txHash, [])
        txHashes.get(txHash).push(detail)
      }

      if (from) {
        if (!addresses.has(from)) addresses.set(from, [])
        addresses.get(from).push({ ...detail, matchField: 'from' })
      }

      if (to) {
        if (!addresses.has(to)) addresses.set(to, [])
        addresses.get(to).push({ ...detail, matchField: 'to' })
      }
    }
  }

  return { txHashes, addresses, totalRows }
}

const knownMaliciousIndex = loadKnownMaliciousIndex()

function findKnownMaliciousMatches(value) {
  const key = normalizeKey(value)
  if (!key) return []

  const matches = []

  if (knownMaliciousIndex.txHashes.has(key)) {
    for (const detail of knownMaliciousIndex.txHashes.get(key)) {
      matches.push({
        matchType: 'transaction_hash',
        ...detail,
      })
    }
  }

  if (knownMaliciousIndex.addresses.has(key)) {
    for (const detail of knownMaliciousIndex.addresses.get(key)) {
      matches.push({
        matchType: detail.matchField || 'address',
        ...detail,
      })
    }
  }

  const seen = new Set()
  return matches.filter((match) => {
    const dedupeKey = `${match.matchType}:${normalizeKey(match.transactionHash)}:${normalizeKey(match.from)}:${normalizeKey(match.to)}`
    if (seen.has(dedupeKey)) return false
    seen.add(dedupeKey)
    return true
  })
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }

  if (chunks.length === 0) return {}

  const raw = Buffer.concat(chunks).toString('utf8')
  return JSON.parse(raw)
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.end(JSON.stringify(payload, null, 2))
}

function createChainIntelApiPlugin() {
  return {
    name: 'chain-intelligence-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const method = req.method || 'GET'
        const url = req.url || '/'

        if (method === 'OPTIONS' && (url === '/api/scan' || url === '/health')) {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.end()
          return
        }

        if (method === 'GET' && url === '/health') {
          sendJson(res, 200, { ok: true, service: 'chain-intelligence', mode: 'vite-middleware' })
          return
        }

        if (method !== 'POST' || url !== '/api/scan') {
          next()
          return
        }

        try {
          const body = await readJsonBody(req)
          const inputs = Array.isArray(body?.inputs)
            ? body.inputs
            : body?.value
              ? [{ value: String(body.value), kind: body?.kind }]
              : []

          const cleanedInputs = inputs
            .map((input) => ({
              value: String(input?.value ?? '').trim(),
              kind: input?.kind,
            }))
            .filter((input) => Boolean(input.value))

          if (cleanedInputs.length === 0) {
            sendJson(res, 400, { error: 'Provide at least one address, txid, or URL.' })
            return
          }

          const chainIntelModule = await import(chainIntelEntry)
          const queryChainIntelligence =
            chainIntelModule.queryChainIntelligence || chainIntelModule.default?.queryChainIntelligence
          const checkPhishingUrl =
            chainIntelModule.checkPhishingUrl || chainIntelModule.default?.checkPhishingUrl

          const results = []
          for (const input of cleanedInputs) {
            const kind = input.kind === 'url' || input.kind === 'address' || input.kind === 'txhash'
              ? input.kind
              : undefined
            const value = input.value
            try {
              if (kind === 'url' || /^https?:\/\//i.test(value) || (!value.startsWith('0x') && value.includes('.'))) {
                const phishingData = await checkPhishingUrl(value)
                results.push({
                  value,
                  kind: 'url',
                  inputType: 'url',
                  verdict: phishingData?.isPhishing ? 'High Risk' : 'Likely Safe',
                  isMalicious: Boolean(phishingData?.isPhishing),
                  source: 'phishing',
                  phishingData
                })
                continue
              }

              const inputType = value.startsWith('0x') && value.length >= 64
                ? 'txhash'
                : value.startsWith('0x')
                  ? 'address'
                  : /^[0-9a-fA-F]{64}$/.test(value)
                    ? 'txhash'
                    : 'address'

              const chainData = await queryChainIntelligence({ inputType, value })
              const knownMaliciousMatches = findKnownMaliciousMatches(value)
              const augmentedChainData = knownMaliciousMatches.length > 0
                ? {
                    ...chainData,
                    intelligence: {
                      ...chainData?.intelligence,
                      isMalicious: true,
                      maliciousFlags: [
                        ...(chainData?.intelligence?.maliciousFlags || []),
                        `Known malicious dataset match (${knownMaliciousMatches.length})`,
                      ],
                      notes: [
                        ...(chainData?.intelligence?.notes || []),
                        'Matched against the local scam transaction dataset.',
                      ],
                    },
                    knownMaliciousMatches,
                  }
                : chainData

              const malicious = Boolean(augmentedChainData?.intelligence?.isMalicious)
              const flags = augmentedChainData?.intelligence?.maliciousFlags?.length ?? 0
              const txCount = augmentedChainData?.summary?.txCount ?? 0
              const verdict = !malicious
                ? 'Likely Safe'
                : flags >= 3 || txCount >= 25
                  ? 'High Risk'
                  : flags >= 1
                    ? 'Suspicious'
                    : 'Needs Review'

              results.push({
                value,
                kind: kind || inputType,
                inputType,
                verdict,
                isMalicious: malicious,
                source: 'chain-intelligence',
                chainData: augmentedChainData,
                knownMaliciousMatches
              })
            } catch (error) {
              results.push({
                value,
                kind: kind || 'unknown',
                inputType: 'address',
                verdict: 'Needs Review',
                isMalicious: false,
                source: 'chain-intelligence',
                error: error instanceof Error ? error.message : 'Unexpected scan error'
              })
            }
          }

          const summary = {
            total: results.length,
            processed: results.length,
            successful: results.filter((result) => !result.error).length,
            safe: results.filter((result) => !result.error && result.verdict === 'Likely Safe').length,
            needsReview: results.filter((result) => !result.error && result.verdict === 'Needs Review').length,
            suspicious: results.filter((result) => !result.error && result.verdict === 'Suspicious').length,
            highRisk: results.filter((result) => !result.error && result.verdict === 'High Risk').length,
            chainTargets: results.filter((result) => result.source === 'chain-intelligence').length,
            urlTargets: results.filter((result) => result.source === 'phishing').length,
            knownMaliciousHits: results.filter((result) => result.knownMaliciousMatches?.length > 0).length,
          }

          sendJson(res, 200, {
            scannedAt: new Date().toISOString(),
            knownMaliciousIndexSize: {
              txHashes: knownMaliciousIndex.txHashes.size,
              addresses: knownMaliciousIndex.addresses.size,
              rows: knownMaliciousIndex.totalRows,
            },
            summary,
            results,
          })
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : 'Scan failed' })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), createChainIntelApiPlugin(), createAuthApiPlugin()],
})
