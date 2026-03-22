Real demo `.eml` files copied from the local `Phishing Pot` dataset.

These are not synthetic. Each file is an unchanged copy of a source email from:
`data/raw/phishing_pot/email/`

Included files:
- `real_coinbase_was_this_you_sample-6072.eml`
- `real_coinbase_account_restricted_sample-5779.eml`
- `real_coinbase_wallet_not_verified_sample-5678.eml`
- `real_wallet_recovery_due_inactivity_sample-5682.eml`
- `real_coinbase_nft_claim_sample-2852.eml`
- `real_self_custody_wallets_sample-5349.eml`

Notes:
- `sample-5349` is one of the held-out Coinbase-themed test examples.
- The others are real Coinbase-themed phishing emails from the same local corpus but
  may belong to train or external buckets when matched against the current split files.
- The current local corpora do not contain real legitimate Coinbase emails, so this
  folder only includes real phishing emails.
