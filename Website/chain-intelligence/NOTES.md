# Provider Limitations & Scam-Risk Suggestions

## Notes on Provider Limitations

**Etherscan:**
- The free tier rate limit is heavily restricted (5 calls/sec), which means bulk data fetching or concurrent queries will quickly trigger `429 Too Many Requests`. The custom `withRetry` utility mitigates this by applying exponential backoff.
- "Labels" or "Name Tags" are currently only accessible via web scraping or premium Enterprise APIs. A public key allows pulling raw balances, but advanced labels are not always given in standard API responses. Treat any scraped labels as non-absolute.

**Mempool.space:**
- Highly reliable for standard UTXO address data. 
- The public REST API has generous rate limits compared to corporate explorers, but they still exist. 
- "First Seen" or complex behavioral heuristics require custom indexers. Mempool provides funded/spent stats which gives you total inflow/outflow.

**Coinbase CDP:**
- Coinbase CDP acts well for historical portfolio aggregation. However, querying comprehensive multi-chain history requires robust authenticated endpoints, and coverage for lesser-known tokens is sometimes delayed relative to pure RPC queries.

## Suggestions for Scam-Risk Scoring Engine

1. **Rule-based Heuristics**: Use the normalized fields (`activity.netFlow`, `activity.recentTransactions.length`) to flag addresses that have massive single-day outflows followed by immediate dormancy. (often seen in rug-pulls or hacks).
2. **Entity Label Overlap**: If `intelligence.labels` contains "tornado-cash", "mixer", or known phishing labels, attach a high risk multiplier. Always surface the `confidenceWarnings` metadata to the analysts so they know these labels can be spoofed or statistically inferred.
3. **Age & Velocity**: Calculate `velocity` (total transactions / days since `firstSeen`). Scam addresses typically have extremely high velocity over a 24-48 hr period before being abandoned.
4. **Graph Traversal Limits**: You can recursively query this ingestion layer. If Address A transferred 99% of its holdings to Address B, the engine should automatically enqueue Address B to check for further hops.
