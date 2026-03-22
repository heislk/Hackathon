import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import SecuritySection from "../components/SecuritySection.jsx";
import Footer from "../components/Footer.jsx";
import "../styles/styles.css";
function OurMission() {
  return (
    <div className="page-shell">
      <Navbar />
      <main>
        <section className="mission-hero">
          <div className="mission-hero__container">
            <h1>Reduce preventable crypto losses before funds disappear.</h1>
            <p>
              CryptoSecure exists to make suspicious activity easier to verify in the moment it
              matters. We focus on fast evidence review, readable risk reporting, and private
              analysis workflows that stay under one roof.
            </p>
            <div className="mission-hero__stats">
              <div className="mission-hero__stat">
                <strong>$3.5B+</strong>
                <span>stolen in crypto theft incidents in 2025</span>
              </div>
              <div className="mission-hero__stat">
                <strong>$283M</strong>
                <span>average stolen per month in 2025</span>
              </div>
              <div className="mission-hero__stat">
                <strong>300K+</strong>
                <span>wallet compromise incidents in 2025</span>
              </div>
              <div className="mission-hero__stat">
                <strong>$2.87B</strong>
                <span>stolen across ~150 hacks (TRM Labs)</span>
              </div>
            </div>
            <div className="mission-hero__actions">
              <Link className="btn btn--primary btn--lg" to="/risk-scan">
                Run a Risk Scan
              </Link>
              <Link className="btn btn--outline btn--lg" to="/sign-in">
                Request Access
              </Link>
            </div>
          </div>
        </section>
        <SecuritySection />
        <section className="mission-why">
          <div className="mission-why__container">
            <h2>Why this exists</h2>
            <p>
              The biggest losses are not abstract. They usually start with a leaked key, a spoofed
              message, a poisoned file, or a compromised workflow. Our goal is to catch that risk
              while there is still time to stop the transfer.
            </p>
            <p className="mission-why__sources">
              Sources: Chainalysis 2026 Crypto Crime Report and TRM Labs 2026 Crypto Crime Report.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
export default OurMission;