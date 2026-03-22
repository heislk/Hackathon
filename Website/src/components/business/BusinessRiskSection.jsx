import "../../styles/business/risk.css";
const RISK_POINTS = [
  {
    eyebrow: "User theft pressure",
    title: "Loss events do not stay isolated.",
    body:
      "A single phishing campaign or wallet compromise can turn into chargeback-style escalation, executive attention, and repeated support contacts across deposits, withdrawals, and account recovery.",
  },
  {
    eyebrow: "Phishing-driven withdrawals",
    title: "The withdrawal path is where false confidence becomes loss.",
    body:
      "When a user has been socially engineered, the platform often sees a perfectly valid transaction that should have been stopped earlier by address risk, behavioral signals, or a warning surface.",
  },
  {
    eyebrow: "Account takeovers",
    title: "ATO events create silent exposure before the report arrives.",
    body:
      "Credential reuse, session hijacking, SIM swap fraud, and mule activity can move funds quickly. Fraud teams need signals early enough to flag the account, not just the aftermath.",
  },
];
const OPERATIONAL_SIGNALS = [
  "Repeated support tickets after a scam transfer",
  "Withdrawal attempts to newly seen or high-risk destinations",
  "Login anomalies followed by recovery flows",
  "Users requesting urgent reversals after funds settle",
];
const PROOF_PILLARS = [
  {
    value: "Faster triage",
    label: "Give analysts a clear reason code instead of a raw alert stream.",
  },
  {
    value: "Fewer escalations",
    label: "Reduce the back-and-forth that happens when support and fraud do not share context.",
  },
  {
    value: "Stronger intervention",
    label: "Surface a warning before the user finalizes a risky transaction.",
  },
];
const SUPPORTING_STATS = [
  {
    value: "859K",
    label: "IC3 fraud complaints filed with the FBI in 2024 — the highest volume ever recorded",
  },
  {
    value: "43.8%",
    label: "of 2024 crypto thefts stemmed from private key compromise — the most common attack vector",
  },
  {
    value: "$62K",
    label: "average loss per crypto fraud victim in 2024, based on FBI IC3 complaint data",
  },
  {
    value: "$452M",
    label: "in phishing-linked losses captured in our 2025 incident dataset — one third of incidents",
  },
];
export default function BusinessRiskSection() {
  return (
    <section className="business-risk" id="risk">
      <div className="business-risk__container">
        <div className="business-risk__header">
          <h2>When users get scammed, the platform absorbs the operating cost.</h2>
          <p className="business-risk__lede">
            CryptoSecure helps exchanges, compliance teams, and fraud operators spot the
            patterns that turn into avoidable loss: phishing-led withdrawals, account takeover,
            and the support churn that follows a theft event.
          </p>
        </div>
        <div className="business-risk__grid">
          <div className="business-risk__cards">
            {RISK_POINTS.map((point) => (
              <article className="business-risk__card" key={point.title}>
                <div className="business-risk__card-eyebrow">{point.eyebrow}</div>
                <h3>{point.title}</h3>
                <p>{point.body}</p>
              </article>
            ))}
            <div className="business-risk__stats">
              <div className="business-risk__stats-header">
                <span className="business-risk__panel-label">Supporting evidence</span>
                <h3>Signals that justify a tighter intervention layer.</h3>
                <p>
                  These figures are useful as context, not as a promise. They show why exchanges
                  are under pressure to catch theft, fraud, and phishing earlier in the customer
                  journey.
                </p>
              </div>
              <div className="business-risk__stats-grid">
                {SUPPORTING_STATS.map((stat) => (
                  <article className="business-risk__stat" key={stat.label}>
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </article>
                ))}
              </div>
            </div>
          </div>
          <aside className="business-risk__panel">
            <div className="business-risk__panel-top">
              <span className="business-risk__panel-label">What teams typically see</span>
              <h3>Operational signals that are already in the data.</h3>
              <p>
                The challenge is rarely a lack of data. The challenge is joining the signals fast
                enough to interrupt the theft path before it becomes a loss, a complaint, or a
                repeat incident.
              </p>
            </div>
            <ul className="business-risk__signals">
              {OPERATIONAL_SIGNALS.map((signal) => (
                <li key={signal}>
                  <span className="business-risk__signal-dot" aria-hidden="true" />
                  {signal}
                </li>
              ))}
            </ul>
            <div className="business-risk__proof">
              {PROOF_PILLARS.map((pillar) => (
                <div className="business-risk__proof-item" key={pillar.value}>
                  <strong>{pillar.value}</strong>
                  <span>{pillar.label}</span>
                </div>
              ))}
            </div>
            <div className="business-risk__note">
              <span className="business-risk__note-title">Proof point</span>
              <p>
                Illustrative outcome: fewer risky withdrawals reach settlement, and support sees
                fewer urgent recovery requests because intervention happens earlier in the flow.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}