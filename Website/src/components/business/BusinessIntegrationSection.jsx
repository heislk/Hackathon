import "../../styles/business/integration.css";
const FLOW_STEPS = [
  {
    number: "01",
    title: "Pre-withdrawal screening",
    description:
      "Screen every withdrawal, deposit, and address change before it reaches the blockchain. CryptoSecure evaluates destination risk, behavioral signals, and known scam patterns in-line.",
    tags: ["Withdrawal queue", "Address risk", "Behavioral signals"],
  },
  {
    number: "02",
    title: "Real-time scoring",
    description:
      "Return a clear risk score in milliseconds so your product can decide whether to allow, challenge, slow down, or block the action without breaking the user journey.",
    tags: ["Sub-second scoring", "Challenge rules", "Policy engine"],
  },
  {
    number: "03",
    title: "Analyst workflow",
    description:
      "Route high-risk events into an analyst queue with the evidence they need to resolve cases quickly. Every review keeps the operational context attached.",
    tags: ["Case queue", "Evidence bundle", "Audit trail"],
  },
  {
    number: "04",
    title: "User warning surface",
    description:
      "Show a branded warning panel or interstitial when the platform needs the customer to pause, verify, or acknowledge a risky transaction.",
    tags: ["Inline warning", "Risk modal", "Customer education"],
  },
];
const ARCHITECTURE_POINTS = [
  "Connect through API, webhook, or server-side middleware.",
  "Score deposits, withdrawals, wallet changes, and suspicious logins.",
  "Push high-risk cases into your fraud and compliance tooling.",
  "Return user-facing warnings that fit your existing brand.",
];
const ANALYST_CARDS = [
  {
    title: "Evidence first",
    text: "Every case bundles the address history, transaction context, and relevant threat indicators so analysts do not have to reconstruct the event manually.",
  },
  {
    title: "Policy-driven outcomes",
    text: "Define when to warn, step up verification, delay release, or escalate to manual review based on your own risk appetite.",
  },
  {
    title: "Audit-ready by default",
    text: "Keep a traceable record of what was scored, what was shown to the user, and which actions were taken across the review lifecycle.",
  },
];
export default function BusinessIntegrationSection() {
  return (
    <section className="business-integration" id="integration">
      <div className="business-integration__container">
        <div className="business-integration__header">
          <h2>Drop risk intelligence into the parts of your exchange that move money.</h2>
          <p className="business-integration__subtitle">
            CryptoSecure is built to sit inside the flow, not beside it. We help exchanges catch
            theft patterns at the moment a user tries to move funds, then route the right action to
            the right team.
          </p>
        </div>
        <div className="business-integration__grid">
          <div className="business-integration__flow">
            <div className="business-integration__flow-shell">
              {FLOW_STEPS.map((step) => (
                <article className="business-integration__step" key={step.number}>
                  <div className="business-integration__step-number">{step.number}</div>
                  <div className="business-integration__step-body">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    <div className="business-integration__tags">
                      {step.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <aside className="business-integration__sidebar">
            <div className="business-integration__panel business-integration__panel--architecture">
              <span className="business-integration__panel-label">Implementation surface</span>
              <h3>Works where your exchange already makes decisions.</h3>
              <ul className="business-integration__list">
                {ARCHITECTURE_POINTS.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
            <div className="business-integration__panel business-integration__panel--warning">
              <span className="business-integration__panel-label business-integration__panel-label--danger">
                User-facing warnings
              </span>
              <div className="business-integration__warning-card">
                <div className="business-integration__warning-top">
                  <span className="business-integration__warning-pill">High risk withdrawal</span>
                  <span className="business-integration__warning-score">92</span>
                </div>
                <p>
                  This address is associated with scam activity and recent wallet-draining
                  patterns. Ask the customer to pause and verify before continuing.
                </p>
                <div className="business-integration__warning-actions">
                  <span>Cancel withdrawal</span>
                  <span>Step-up verification</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
        <div className="business-integration__footer">
          {ANALYST_CARDS.map((card) => (
            <article className="business-integration__card" key={card.title}>
              <h4>{card.title}</h4>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}