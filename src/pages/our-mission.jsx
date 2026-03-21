import { Link } from "react-router-dom";
import MissionImpactSection from "../components/MissionImpactSection.jsx";
import Navbar from "../components/Navbar.jsx";
import SecuritySection from "../components/SecuritySection.jsx";
import "../styles/styles.css";

function OurMission() {
  return (
    <div className="page-shell">
      <Navbar />
      <main className="landing-page">
        <section className="landing-section section-shell">
          <div className="section-shell__copy">
            <span className="section-shell__eyebrow">Our mission</span>
            <h1 className="section-shell__title">Reduce preventable crypto losses before funds disappear.</h1>
            <p className="section-shell__description">
              CryptoSecure exists to make suspicious activity easier to verify in the moment it
              matters. We focus on fast evidence review, readable risk reporting, and private
              analysis workflows that stay under one roof.
            </p>
          </div>
          <div className="hero__actions">
            <Link className="primary-btn" to="/risk-scan">
              Run a Risk Scan
            </Link>
            <Link className="secondary-btn" to="/sign-in">
              Request Access
            </Link>
          </div>
        </section>
        <MissionImpactSection />
        <SecuritySection />
      </main>
    </div>
  );
}

export default OurMission;
