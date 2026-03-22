import { Link } from "react-router-dom";

const plans = [
  {
    name: "Free",
    badge: "Default access",
    price: "$0",
    cadence: "to start",
    description: "Basic protection for individual users who want verdicts and a lightweight history trail.",
    ctaLabel: "Start free",
    ctaHref: "/register",
  },
  {
    name: "Pro",
    badge: "Full investigation",
    price: "$19",
    cadence: "/month",
    description: "For people who want the full chain view, richer flags, more weekly scans, and more monthly email checks.",
    ctaLabel: "View account",
    ctaHref: "/account",
  },
  {
    name: "Enterprise",
    badge: "Exchange only",
    price: "???",
    cadence: "negotiable",
    description: "Reserved for exchanges. Usually priced through a negotiated contract based on workflow, volume, and support needs.",
    ctaLabel: "For exchanges",
    ctaHref: "/for-business",
  },
];

const comparisonRows = [
  { label: "Weekly live scans", free: "3", pro: "25", enterprise: "???", note: "Negotiable in contract" },
  { label: "Monthly email checks", free: "5", pro: "50", enterprise: "???", note: "Negotiable in contract" },
  { label: "Basic verdict", free: "Yes", pro: "Yes", enterprise: "Yes", note: "" },
  { label: "Full chain data", free: "Blurred", pro: "Included", enterprise: "Included", note: "" },
  { label: "Risk flags and notes", free: "Blurred", pro: "Included", enterprise: "Included", note: "" },
  { label: "Transaction history", free: "Blurred", pro: "Included", enterprise: "Included", note: "" },
  { label: "Saved scan history", free: "Included", pro: "Included", enterprise: "Included", note: "" },
  { label: "API access label", free: "No", pro: "No", enterprise: "Yes", note: "Exchange workflows only" },
  { label: "Team / contract support", free: "No", pro: "Self-serve", enterprise: "Negotiated", note: "Exchange only" },
];

function toneClass(value) {
  if (value === "Yes" || value === "Included") return "is-positive";
  if (value === "Blurred" || value === "No") return "is-muted";
  if (value === "???") return "is-negotiable";
  return "";
}

export default function PricingSection() {
  return (
    <section className="pricing" id="plans">
      <div className="pricing__container">
        <div className="pricing__intro">
          <span className="pricing__eyebrow">Plans</span>
          <h2>Upgrade only if you want the deeper layer.</h2>
          <p>
            Free gives people a usable verdict. Pro unlocks the investigation detail behind that
            verdict. Enterprise is exchange-only and handled as a negotiable contract, so the exact
            terms are intentionally not fixed on-site.
          </p>
        </div>

        <div className="pricing__cards">
          {plans.map((plan) => (
            <article key={plan.name} className={`pricing-card pricing-card--${plan.name.toLowerCase()}`}>
              <span className="pricing-card__badge">{plan.badge}</span>
              <h3>{plan.name}</h3>
              <p className="pricing-card__price">
                <strong>{plan.price}</strong>
                <span>{plan.cadence}</span>
              </p>
              <p className="pricing-card__description">{plan.description}</p>
              <Link className="pricing-card__cta" to={plan.ctaHref}>
                {plan.ctaLabel}
              </Link>
            </article>
          ))}
        </div>

        <div className="pricing-table-wrap">
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Free</th>
                <th>Pro</th>
                <th>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label}>
                  <td>
                    <strong>{row.label}</strong>
                    {row.note ? <span>{row.note}</span> : null}
                  </td>
                  <td className={toneClass(row.free)}>{row.free}</td>
                  <td className={toneClass(row.pro)}>{row.pro}</td>
                  <td className={toneClass(row.enterprise)}>{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
