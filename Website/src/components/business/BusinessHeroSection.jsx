import { Link } from "react-router-dom";
import "../../styles/business/hero.css";
const proofCards = [
  {
    value: "2024 IC3",
    label: "859,532 internet crime complaints and over $16B in reported losses.",
  },
  {
    value: "Chainalysis 2025",
    label: "Over $3.4B stolen in crypto theft, with personal wallet compromises surging.",
  },
  {
    value: "147 incidents",
    label: "Tracked 2025 cases in our repo dataset totaling about $3.2B in losses.",
  },
];
const capabilityPills = [
  "Withdrawal screening",
  "Address intelligence",
  "Phishing signal review",
  "Analyst escalation",
];
export default function BusinessHeroSection() {
  return (
    <section className="business-hero" aria-labelledby="business-hero-title">
      <div className="business-hero__container">
        <div className="business-hero__badge">
          <span className="business-hero__badge-dot" aria-hidden="true" />
          Enterprise risk intelligence for crypto exchanges
        </div>
        <h1 className="business-hero__title" id="business-hero-title">
          Help exchange customers avoid theft before it becomes your next loss event.
        </h1>
        <p className="business-hero__subtitle">
          CryptoSecure gives exchanges pre-withdrawal risk intelligence that surfaces suspicious
          activity before assets move, reduces scam-related support burden, and helps teams
          quantify the annual cost of user theft across the business.
        </p>
        <div className="business-hero__actions">
          <a className="btn btn--teal btn--lg" href="#contact">
            Book an Exchange Demo
          </a>
          <Link className="btn btn--outline btn--lg" to="/risk-scan">
            Explore Risk Scans
          </Link>
        </div>
        <div className="business-hero__capabilities" aria-label="Key capabilities">
          {capabilityPills.map((pill) => (
            <span key={pill} className="business-hero__pill">
              {pill}
            </span>
          ))}
        </div>
        <div className="business-hero__stats">
          {proofCards.map((card) => (
            <article key={card.value} className="business-hero__stat">
              <span className="business-hero__stat-value">{card.value}</span>
              <p className="business-hero__stat-label">{card.label}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}