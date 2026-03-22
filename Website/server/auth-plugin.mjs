import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'auth.db')

function getDb() {
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'free',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scan_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      input_value TEXT NOT NULL,
      input_kind TEXT NOT NULL DEFAULT 'address',
      verdict TEXT NOT NULL,
      is_malicious INTEGER NOT NULL DEFAULT 0,
      result_json TEXT,
      scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  return db
}

function generateToken() {
  return randomUUID()
}

function getUserFromToken(db, token) {
  if (!token) return null
  const session = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.name, u.email, u.tier, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token)
  return session || null
}

function getUsage(db, userId) {
  const weeklyScans = db.prepare(`
    SELECT COUNT(*) as count FROM scan_history
    WHERE user_id = ? AND scanned_at >= datetime('now', '-7 days')
  `).get(userId)?.count ?? 0

  const monthlyEmails = db.prepare(`
    SELECT COUNT(*) as count FROM email_checks
    WHERE user_id = ? AND scanned_at >= datetime('now', '-30 days')
  `).get(userId)?.count ?? 0

  return { weeklyScans, monthlyEmails }
}

const TIER_LIMITS = {
  free: { weeklyScans: 3, monthlyEmails: 5 },
  pro: { weeklyScans: 25, monthlyEmails: 50 },
  enterprise: { weeklyScans: Infinity, monthlyEmails: Infinity },
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return {} }
}

function clampPageSize(value) {
  const pageSize = Number.parseInt(String(value ?? '10'), 10)
  if (Number.isNaN(pageSize)) return 10
  return Math.min(50, Math.max(1, pageSize))
}

function clampPage(value) {
  const page = Number.parseInt(String(value ?? '1'), 10)
  if (Number.isNaN(page)) return 1
  return Math.max(1, page)
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.end(JSON.stringify(body))
}

export function createAuthApiPlugin() {
  return {
    name: 'auth-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const method = req.method || 'GET'
        const requestUrl = new URL(req.url || '/', 'http://localhost')
        const url = requestUrl.pathname

        if (method === 'OPTIONS' && url.startsWith('/api/auth')) {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
          res.end()
          return
        }

        if (!url.startsWith('/api/auth')) { next(); return }

        const db = getDb()
        const authHeader = req.headers['authorization'] || ''
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

        try {
          // POST /api/auth/register
          if (method === 'POST' && url === '/api/auth/register') {
            const { name, email, password } = await readBody(req)
            if (!name || !email || !password) {
              return send(res, 400, { error: 'name, email, and password are required' })
            }
            if (password.length < 8) {
              return send(res, 400, { error: 'Password must be at least 8 characters' })
            }
            const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
            if (existing) {
              return send(res, 409, { error: 'An account with this email already exists' })
            }
            const password_hash = bcrypt.hashSync(password, 10)
            const result = db.prepare(
              'INSERT INTO users (name, email, password_hash, tier) VALUES (?, ?, ?, ?)'
            ).run(name.trim(), email.trim().toLowerCase(), password_hash, 'free')
            return send(res, 201, { ok: true, userId: result.lastInsertRowid })
          }

          // POST /api/auth/login
          if (method === 'POST' && url === '/api/auth/login') {
            const { email, password } = await readBody(req)
            if (!email || !password) {
              return send(res, 400, { error: 'email and password are required' })
            }
            const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase())
            if (!user || !bcrypt.compareSync(password, user.password_hash)) {
              return send(res, 401, { error: 'Invalid email or password' })
            }
            const sessionToken = generateToken()
            db.prepare("DELETE FROM sessions WHERE user_id = ? OR expires_at <= datetime('now')").run(user.id)
            db.prepare(
              "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+30 days'))"
            ).run(user.id, sessionToken)
            const usage = getUsage(db, user.id)
            const limits = TIER_LIMITS[user.tier] || TIER_LIMITS.free
            return send(res, 200, {
              token: sessionToken,
              user: { id: user.id, name: user.name, email: user.email, tier: user.tier, createdAt: user.created_at },
              usage,
              limits,
            })
          }

          // POST /api/auth/logout
          if (method === 'POST' && url === '/api/auth/logout') {
            if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
            return send(res, 200, { ok: true })
          }

          // GET /api/auth/me
          if (method === 'GET' && url === '/api/auth/me') {
            const session = getUserFromToken(db, token)
            if (!session) return send(res, 401, { error: 'Not authenticated' })
            const usage = getUsage(db, session.id)
            const limits = TIER_LIMITS[session.tier] || TIER_LIMITS.free
            return send(res, 200, {
              user: { id: session.id, name: session.name, email: session.email, tier: session.tier, createdAt: session.created_at },
              usage,
              limits,
            })
          }

          // POST /api/auth/scan-history
          if (method === 'POST' && url === '/api/auth/scan-history') {
            const session = getUserFromToken(db, token)
            if (!session) return send(res, 401, { error: 'Not authenticated' })
            const { inputValue, inputKind, verdict, isMalicious, resultJson } = await readBody(req)
            if (!inputValue || !verdict) {
              return send(res, 400, { error: 'inputValue and verdict are required' })
            }
            db.prepare(
              'INSERT INTO scan_history (user_id, input_value, input_kind, verdict, is_malicious, result_json) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(session.id, inputValue, inputKind || 'address', verdict, isMalicious ? 1 : 0, resultJson ? JSON.stringify(resultJson) : null)
            return send(res, 201, { ok: true })
          }

          // POST /api/auth/email-check
          if (method === 'POST' && url === '/api/auth/email-check') {
            const session = getUserFromToken(db, token)
            if (!session) return send(res, 401, { error: 'Not authenticated' })
            db.prepare('INSERT INTO email_checks (user_id) VALUES (?)').run(session.id)
            return send(res, 201, { ok: true })
          }

          // GET /api/auth/scan-history
          if (method === 'GET' && url === '/api/auth/scan-history') {
            const session = getUserFromToken(db, token)
            if (!session) return send(res, 401, { error: 'Not authenticated' })
            const page = clampPage(requestUrl.searchParams.get('page'))
            const pageSize = clampPageSize(requestUrl.searchParams.get('pageSize'))
            const offset = (page - 1) * pageSize
            const total = db.prepare(
              'SELECT COUNT(*) as count FROM scan_history WHERE user_id = ?'
            ).get(session.id)?.count ?? 0
            const rows = db.prepare(
              `SELECT id, input_value, input_kind, verdict, is_malicious, result_json, scanned_at
               FROM scan_history
               WHERE user_id = ?
               ORDER BY scanned_at DESC
               LIMIT ? OFFSET ?`
            ).all(session.id, pageSize, offset)
            return send(res, 200, {
              history: rows.map((row) => ({
                ...row,
                result_json: row.result_json ? JSON.parse(row.result_json) : null,
              })),
              pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.max(1, Math.ceil(total / pageSize)),
              },
            })
          }

          // GET /api/auth/usage
          if (method === 'GET' && url === '/api/auth/usage') {
            const session = getUserFromToken(db, token)
            if (!session) return send(res, 401, { error: 'Not authenticated' })
            const usage = getUsage(db, session.id)
            const limits = TIER_LIMITS[session.tier] || TIER_LIMITS.free
            return send(res, 200, { usage, limits, tier: session.tier })
          }

          next()
        } catch (err) {
          console.error('[auth-api]', err)
          send(res, 500, { error: 'Internal server error' })
        } finally {
          db.close()
        }
      })
    },
  }
}
