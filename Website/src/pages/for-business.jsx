import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import BusinessHeroSection from "../components/business/BusinessHeroSection.jsx";
import BusinessRiskSection from "../components/business/BusinessRiskSection.jsx";
import BusinessIntegrationSection from "../components/business/BusinessIntegrationSection.jsx";
import BusinessSavingsSection from "../components/business/BusinessSavingsSection.jsx";
import BusinessTrustSection from "../components/business/BusinessTrustSection.jsx";
import "../styles/styles.css";
import "../styles/business/page.css";
const MARKET_FACTS = [
  {
    value: "$3.4B+",
    label: "stolen in crypto theft through December 2025",
    source: "Chainalysis",
  },
  {
    value: "158K",
    label: "personal wallet compromise incidents tracked in 2025",
    source: "Chainalysis",
  },
  {
    value: "$16B+",
    label: "reported internet crime losses in the 2024 IC3 report",
    source: "FBI / IC3",
  },
  {
    value: "147",
    label: "incidents in our 2025 loss dataset totaling $3.2B",
    source: "Internal incident dataset",
  },
];
const JUMP_LINKS = [
  { href: "#risk", label: "Risk Overview" },
  { href: "#integration", label: "Integration Flow" },
  { href: "#roi", label: "Savings Model" },
  { href: "#contact", label: "Book Demo" },
];
export default function ForBusiness() {
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace("#", "");
    const element = document.getElementById(id);
    if (element) {
      window.requestAnimationFrame(() => {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [location.hash]);
  return (
    <div className="page-shell business-page">
      <Navbar />
      <main>
        <BusinessHeroSection />
        <section className="business-page__market" aria-labelledby="market-context-title">
          <div className="business-page__market-inner">
            <div className="business-page__market-copy">
              <span className="section-eyebrow">
                <span className="section-eyebrow__dot section-eyebrow__dot--teal" />
                Market Context
              </span>
              <h2 id="market-context-title">
                Exchange operators are now expected to stop scam-driven loss before settlement.
              </h2>
              <p>
                The pressure is not just reputational. Theft events create fraud review, support
                backlog, leadership escalation, and customer churn. This page frames the problem in
                the metrics enterprise teams actually care about.
              </p>
            </div>
            <div className="business-page__market-grid">
              {MARKET_FACTS.map((fact) => (
                <article className="business-page__market-card" key={fact.label}>
                  <span className="business-page__market-value">{fact.value}</span>
                  <p className="business-page__market-label">{fact.label}</p>
                  <span className="business-page__market-source">{fact.source}</span>
                </article>
              ))}
            </div>
            <div className="business-page__market-footer">
              <p className="business-page__source-note">
                Sources used in page framing: FBI / IC3 report published April 23, 2025,
                Chainalysis 2025 theft reporting, and the repo&apos;s 2025 incident dataset.
              </p>
              <nav className="business-page__jump-nav" aria-label="Business page sections">
                {JUMP_LINKS.map((link) => (
                  <a key={link.href} href={link.href}>
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </section>
        <BusinessRiskSection />
        <BusinessIntegrationSection />
        <BusinessSavingsSection />
        <BusinessTrustSection />
      </main>
      <Footer />
    </div>
  );
}