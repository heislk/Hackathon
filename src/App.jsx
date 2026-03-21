import Navbar from './components/Navbar.jsx'
import "./styles/styles.css";

// Chat GPT
export default function CryptoSecurityWebsite() {
  return (
    <div className="container">
      <Navbar />

      {/* Hero Section */}
      <section className="hero">
        <h1>Protect Your Crypto Assets</h1>
        <p>
          Advanced blockchain security, smart contract auditing, and file
          scanning to keep your digital assets safe.
        </p>
        <button className="primary-btn">Get Started</button>
      </section>

      {/* Features */}
      <section id="features" className="features">
        <div className="feature-card">
          <h3>Smart Contract Audits</h3>
          <p>Identify vulnerabilities before hackers do.</p>
        </div>

        <div className="feature-card">
          <h3>Wallet Protection</h3>
          <p>Monitor and secure your crypto wallets in real time.</p>
        </div>

        <div className="feature-card">
          <h3>Blockchain Monitoring</h3>
          <p>Track suspicious transactions and threats instantly.</p>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="footer">
        <p>© 2026 CryptoSecure. All rights reserved.</p>
      </footer>
    </div>
  );
}
