import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'chain-intelligence/.env')
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const secrets = [
  process.env.ETHERSCAN_API_KEY,
  process.env.COINBASE_CDP_API_KEY,
  process.env.COINBASE_CDP_API_SECRET,
  process.env.GOPLUS_APP_KEY,
  process.env.GOPLUS_APP_SECRET,
  process.env.ARKHAM_API_KEY,
  process.env.CODEX_API_KEY
].filter(Boolean) as string[];

/**
 * Safe logger that prevents leaking sensitive env vars.
 */
export const logger = {
  info: (msg: string, ...args: any[]) => {
    console.log(`[INFO] ${maskSecrets(msg)}`, ...args.map(a => typeof a === 'string' ? maskSecrets(a) : a));
  },
  warn: (msg: string, ...args: any[]) => {
    console.warn(`[WARN] ${maskSecrets(msg)}`, ...args.map(a => typeof a === 'string' ? maskSecrets(a) : a));
  },
  error: (msg: string, ...args: any[]) => {
    console.error(`[ERROR] ${maskSecrets(msg)}`, ...args.map(a => typeof a === 'string' ? maskSecrets(a) : a));
  }
};

function maskSecrets(text: string): string {
  let masked = text;
  for (const secret of secrets) {
    if (secret && secret.length > 3) {
      // Basic regex replacement for the secret literal
      const regex = new RegExp(secret, 'g');
      masked = masked.replace(regex, '***REDACTED***');
    }
  }
  return masked;
}
