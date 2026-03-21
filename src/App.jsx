import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import AboutSection from "./components/AboutSection.jsx";
import MissionImpactSection from "./components/MissionImpactSection.jsx";
import Navbar from "./components/Navbar.jsx";
import SecuritySection from "./components/SecuritySection.jsx";
import "./styles/styles.css";

const heroMetrics = [
  {
    value: "$3.4B",
    label: "reported stolen across crypto theft incidents in 2025.",
  },
  {
    value: "158K",
    label: "wallet compromise incidents tracked by Chainalysis in 2025.",
  },
  {
    value: "Private",
    label: "analysis flows designed to keep intake, review, and reporting contained.",
  },
];

export default function CryptoSecurityWebsite() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const id = location.hash.replace("#", "");
    const element = document.getElementById(id);

    if (element) {
      window.requestAnimationFrame(() => {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [location.hash]);

  return (
    <div className="page-shell">
      <Navbar />
      <main className="landing-page">
        <section className="hero">
          <div className="hero__copy">
            <span className="hero__eyebrow">Crypto security for high-risk decisions</span>
            <h1>
              Verify the threat
              <span className="hero__highlight"> before you sign.</span>
            </h1>
            <p className="hero__lede">
              CryptoSecure reviews suspicious wallet activity, DMs, links, transaction hashes, and
              uploaded evidence so holders can catch red flags before a rushed approval turns into
              a permanent loss.
            </p>
            <div className="hero__actions">
              <Link className="primary-btn" to="/risk-scan">
                Run a Risk Scan
              </Link>
              <Link className="secondary-btn" to="/login">
                Open Workspace
              </Link>
            </div>
            <div className="hero__pills" aria-label="Key product promises">
              <span className="hero__pill">Built for crypto holders</span>
              <span className="hero__pill">No wallet custody</span>
              <span className="hero__pill">Readable risk findings</span>
            </div>
          </div>

          <aside className="hero__panel" aria-label="Product overview">
            <div className="hero__panel-card">
              <span className="hero__panel-label">Review flow</span>
              <h2 className="hero__panel-title">A cleaner way to inspect suspicious activity.</h2>
              <div className="hero__panel-list">
                <div className="hero__step">
                  <span className="hero__step-index">01</span>
                  <div>
                    <h3>Submit the evidence</h3>
                    <p>Start with the message, wallet, file, or contract link that looks wrong.</p>
                  </div>
                </div>
                <div className="hero__step">
                  <span className="hero__step-index">02</span>
                  <div>
                    <h3>Run internal analysis</h3>
                    <p>Check for phishing cues, risky approvals, spoofing, and compromise patterns.</p>
                  </div>
                </div>
                <div className="hero__step">
                  <span className="hero__step-index">03</span>
                  <div>
                    <h3>Act on the brief</h3>
                    <p>Get a risk score, the exact findings, and the safest next move.</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="metric-strip" aria-label="Platform highlights">
          {heroMetrics.map((metric) => (
            <article className="metric-card" key={metric.value}>
              <div className="metric-card__value">{metric.value}</div>
              <p className="metric-card__label">{metric.label}</p>
            </article>
          ))}
        </section>

        <AboutSection />
        <MissionImpactSection />
        <SecuritySection />
      </main>

      <footer className="footer">
        <p>© 2026 CryptoSecure. All rights reserved.</p>
        <div className="footer__links">
          <Link to="/risk-scan">Risk Score</Link>
          <Link to="/our-mission">Our Mission</Link>
          <Link to="/login">Login</Link>
          <Link to="/sign-in">Sign In</Link>
        </div>
      </footer>
    </div>
  );
}
