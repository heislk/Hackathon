export default function SecuritySection() {
  return (
    <section className="security" id="security">
      <div className="security__container">
        <span className="section-eyebrow">
          <span className="section-eyebrow__dot" />
          Security &amp; Privacy
        </span>
        <h2>Your data never leaves our control.</h2>
        <p className="security__subtitle">
          We built our analysis pipeline to be fully in-house. No third-party data sharing,
          no external AI providers with unclear data policies, no loose routing.
        </p>
        <div className="security__grid">
          <article className="security__card">
            <div className="security__card-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 3L4 8v6c0 5.55 4.27 10.74 10 12 5.73-1.26 10-6.45 10-12V8L14 3z" stroke="var(--primary-dark)" strokeWidth="2" fill="var(--primary-lighter)"/>
                <path d="M10 14l3 3 5-6" stroke="var(--primary-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>Encrypted by default</h3>
            <p>
              All files and data are encrypted in transit (TLS 1.3) and at rest. Nothing is
              stored in plain text at any point in the pipeline.
            </p>
          </article>
          <article className="security__card">
            <div className="security__card-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="3" y="11" width="22" height="14" rx="3" stroke="var(--primary-dark)" strokeWidth="2" fill="var(--primary-lighter)"/>
                <path d="M8 11V8a6 6 0 1112 0v3" stroke="var(--primary-dark)" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="14" cy="19" r="2" fill="var(--primary-dark)"/>
              </svg>
            </div>
            <h3>In-house analysis only</h3>
            <p>
              Processing runs entirely within our own infrastructure. Submissions are never
              forwarded to external analysts or third-party tools.
            </p>
          </article>
          <article className="security__card">
            <div className="security__card-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="10" stroke="var(--primary-dark)" strokeWidth="2" fill="var(--primary-lighter)"/>
                <path d="M14 9v5l4 2" stroke="var(--primary-dark)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h3>Owned AI stack</h3>
            <p>
              Our AI is trained in-house on thousands of phishing emails, scam patterns, and
              on-chain attack vectors. We control every layer.
            </p>
          </article>
          <article className="security__card">
            <div className="security__card-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="3" y="5" width="22" height="18" rx="3" stroke="var(--primary-dark)" strokeWidth="2" fill="var(--primary-lighter)"/>
                <path d="M3 11h22M9 5v6M19 5v6" stroke="var(--primary-dark)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h3>Controlled outputs</h3>
            <p>
              Reports surface only the findings you need. No unnecessary data exposure,
              no bloated logs, no uncontrolled side effects.
            </p>
          </article>
        </div>
        <div className="security__workflow">
          <div className="security__workflow-step">
            <span className="security__workflow-dot" />
            Upload
          </div>
          <div className="security__workflow-line" />
          <div className="security__workflow-step">
            <span className="security__workflow-dot" />
            Encrypt
          </div>
          <div className="security__workflow-line" />
          <div className="security__workflow-step">
            <span className="security__workflow-dot" />
            Analyze in-house
          </div>
          <div className="security__workflow-line" />
          <div className="security__workflow-step">
            <span className="security__workflow-dot" />
            Deliver report
          </div>
        </div>
      </div>
    </section>
  );
}