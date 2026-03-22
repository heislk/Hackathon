import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Footer() {
  const { user } = useAuth();

  return (
    <footer className="footer" id="contact">
      <div className="footer__inner">
        <div className="footer__brand">
          <Link to="/" className="footer__logo">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="#21D66F"/>
              <path d="M8 14.5L12 18.5L20 10.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>CryptoSecure</span>
          </Link>
          <p>Protecting crypto holders and platforms from scams and theft through AI-powered analysis.</p>
        </div>
        <div className="footer__links">
          <div className="footer__col">
            <h4>Product</h4>
            <Link to="/risk-scan">Risk Scan</Link>
            <Link to="/#threat-simulator">Threat Simulator</Link>
            <Link to="/wiki">Scam Wiki</Link>
            <Link to="/#impact">Impact Calculator</Link>
          </div>
          <div className="footer__col">
            <h4>Company</h4>
            <Link to="/our-mission">Our Mission</Link>
            <Link to="/#security">Security</Link>
            <Link to="/for-business">For Business (B2B)</Link>
          </div>
          <div className="footer__col">
            <h4>Account</h4>
            <Link to={user ? "/account" : "/login"}>{user ? "My Account" : "Login"}</Link>
            <Link to={user ? "/risk-scan" : "/register"}>{user ? "Run a Scan" : "Sign Up"}</Link>
          </div>
        </div>
        <div className="footer__bottom">
          <p>© 2026 CryptoSecure. All rights reserved.</p>
          <div className="footer__bottom-links">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
