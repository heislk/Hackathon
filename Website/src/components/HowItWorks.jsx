export default function HowItWorks() {
  return (
    <section className="how-it-works" id="how-it-works">
      <div className="how-it-works__container">
        <span className="section-eyebrow">
          <span className="section-eyebrow__dot" />
          How CryptoSecure Works
        </span>
        <h2>Three steps. One clear answer.</h2>
        <p className="how-it-works__subtitle">
          No technical expertise needed. Submit what looks suspicious and get a plain-English
          risk assessment in seconds.
        </p>
        <div className="how-it-works__steps">
          <div className="step-card">
            <div className="step-card__number">01</div>
            <div className="step-card__icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M16 4v12m0 0l-5-5m5 5l5-5M6 22v2a2 2 0 002 2h16a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>Submit the evidence</h3>
            <p>
              Upload a suspicious email (.EML), paste a wallet address or transaction hash, share
              a screenshot of a text message, drop in a suspicious URL, or paste multiple wallet
              addresses and txids separated by commas. Email files are analyzed in the email
              intelligence service, while live chain scans happen here.
            </p>
            <div className="step-card__tags">
              <span>.EML files</span>
              <span>Wallet addresses</span>
              <span>URLs</span>
              <span>Screenshots</span>
              <span>Tx hashes</span>
            </div>
          </div>
          <div className="step-card__connector">
            <svg width="40" height="24" viewBox="0 0 40 24" fill="none">
              <path d="M0 12h36m0 0l-6-6m6 6l-6 6" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="step-card">
            <div className="step-card__number">02</div>
            <div className="step-card__icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 11v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h3>AI-powered analysis</h3>
            <p>
              Our in-house AI cross-references Arkham-enriched chain intelligence, VirusTotal
              databases, known phishing patterns, and wallet behavior analytics to evaluate the
              risk.
            </p>
            <div className="step-card__tags">
              <span>Arkham intelligence</span>
              <span>On-chain analysis</span>
              <span>Phishing detection</span>
              <span>VirusTotal</span>
              <span>Wallet forensics</span>
            </div>
          </div>
          <div className="step-card__connector">
            <svg width="40" height="24" viewBox="0 0 40 24" fill="none">
              <path d="M0 12h36m0 0l-6-6m6 6l-6 6" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="step-card">
            <div className="step-card__number">03</div>
            <div className="step-card__icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M9 17l4 4 10-12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>Get your risk report</h3>
            <p>
              Receive a clear verdict — Likely Safe, Suspicious, or High Risk — with the exact
              red flags found and recommended next steps in plain language.
            </p>
            <div className="step-card__tags">
              <span>Risk score</span>
              <span>Red flags</span>
              <span>Plain English</span>
              <span>Next steps</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
