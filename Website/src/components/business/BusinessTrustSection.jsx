import "../../styles/business/trust.css";
export default function BusinessTrustSection() {
  return (
    <section className="business-trust" aria-labelledby="business-trust-title">
      <div className="business-trust__inner">
        <div className="business-trust__header">
          <span className="section-eyebrow business-trust__eyebrow">
            <span className="section-eyebrow__dot section-eyebrow__dot--teal" />
            Enterprise trust layer
          </span>
          <h2 id="business-trust-title" className="business-trust__title">
            Security teams should approve it. Product teams should ship it. Users should never see the risk.
          </h2>
          <p className="business-trust__subtitle">
            CryptoSecure is designed for exchanges that need stronger protection without giving up privacy,
            operational visibility, or control over how risk signals are used. Keep the intelligence close to your
            environment, surface only what matters, and give your team tools to stop theft before it becomes a support
            escalation.
          </p>
        </div>
        <div className="business-trust__proof">
          <div className="business-trust__proof-item">
            <span className="business-trust__proof-value">~70%</span>
            <span className="business-trust__proof-label">
              of stolen funds in 2024 came from infrastructure attacks, including private key and seed phrase compromise
            </span>
          </div>
          <div className="business-trust__proof-item">
            <span className="business-trust__proof-value">$3.4B+</span>
            <span className="business-trust__proof-label">
              was stolen in 2025, with centralized services still exposed to private-key and signing-process attacks
            </span>
          </div>
        </div>
        <div className="business-trust__grid">
          <article className="business-trust__card">
            <div className="business-trust__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M14 3L4 8v6c0 5.55 4.27 10.74 10 12 5.73-1.26 10-6.45 10-12V8L14 3z"
                  stroke="var(--primary-dark)"
                  strokeWidth="2"
                  fill="var(--primary-lighter)"
                />
                <path d="M10 14l3 3 5-6" stroke="var(--primary-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3>Deployment control</h3>
            <p>
              Deployment patterns can be aligned to your architecture, with private, managed, or controlled workflow
              options depending on the implementation path you choose.
            </p>
            <ul className="business-trust__list">
              <li>Architecture-aligned rollout options</li>
              <li>Role-based access and approval checkpoints</li>
              <li>Policy enforcement before execution where configured</li>
            </ul>
          </article>
          <article className="business-trust__card">
            <div className="business-trust__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="3" y="11" width="22" height="14" rx="3" stroke="var(--teal)" strokeWidth="2" fill="var(--teal-light)" />
                <path d="M8 11V8a6 6 0 1112 0v3" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" />
                <circle cx="14" cy="19" r="2" fill="var(--teal)" />
              </svg>
            </div>
            <h3>Privacy by design</h3>
            <p>
              Keep sensitive transaction context inside your environment. Share only the minimal findings needed to act,
              with redaction controls that limit exposure across logs, reports, and downstream teams.
            </p>
            <ul className="business-trust__list">
              <li>Minimal-data outputs for analysts and support teams</li>
              <li>Retention and redaction controls for sensitive records</li>
              <li>Audit-friendly reporting without broad data leakage</li>
            </ul>
          </article>
          <article className="business-trust__card business-trust__card--wide">
            <div className="business-trust__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="3" y="5" width="22" height="18" rx="3" stroke="var(--danger-dark)" strokeWidth="2" fill="var(--danger-bg)" />
                <path d="M3 11h22M9 5v6M19 5v6" stroke="var(--danger-dark)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Operational fit for exchanges</h3>
            <p>
              Built to support the reality of exchange operations: high request volume, compliance review, customer support
              escalation, and the need for explainable signals that analysts can trust quickly.
            </p>
            <div className="business-trust__metrics">
              <div className="business-trust__metric">
                <span className="business-trust__metric-value">RBAC</span>
                <span className="business-trust__metric-label">Controlled analyst access</span>
              </div>
              <div className="business-trust__metric">
                <span className="business-trust__metric-value">SSO</span>
                <span className="business-trust__metric-label">Enterprise identity support</span>
              </div>
              <div className="business-trust__metric">
                <span className="business-trust__metric-value">Logs</span>
                <span className="business-trust__metric-label">Auditable decision trails</span>
              </div>
              <div className="business-trust__metric">
                <span className="business-trust__metric-value">API</span>
                <span className="business-trust__metric-label">Workflow-ready integration</span>
              </div>
            </div>
          </article>
        </div>
        <div className="business-trust__cta">
          <div className="business-trust__cta-copy">
            <span className="business-trust__cta-kicker">Ready for a private walkthrough?</span>
            <h3>See how CryptoSecure fits into your exchange stack.</h3>
            <p>
              We'll walk your team through integration options, privacy controls, and the product directions that can
              reduce theft-related losses and support overhead.
            </p>
          </div>
          <div className="business-trust__cta-actions">
            <a className="btn btn--teal btn--lg" href="#contact">
              Request a demo
            </a>
            <a className="btn btn--outline btn--lg business-trust__secondary" href="#top">
              Review the platform
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}