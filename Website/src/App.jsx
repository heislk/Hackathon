import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import HeroSection from "./components/HeroSection.jsx";
import HowItWorks from "./components/HowItWorks.jsx";
import ThreatSimulator from "./components/ThreatSimulator.jsx";
import ImpactCalculator from "./components/ImpactCalculator.jsx";
import ChainLogos from "./components/ChainLogos.jsx";
import SecuritySection from "./components/SecuritySection.jsx";
import Footer from "./components/Footer.jsx";
import "./styles/styles.css";
export default function CryptoSecurityWebsite() {
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
    <div className="page-shell">
      <Navbar />
      <main>
        <HeroSection />
        <HowItWorks />
        <ThreatSimulator />
        <ImpactCalculator />
        <ChainLogos />
        <SecuritySection />
      </main>
      <Footer />
    </div>
  );
}