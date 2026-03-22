import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import "../styles/navbar.css";
const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  const handleClose = () => setMobileOpen(false);

  return (
    <header className="navbar" id="top">
      <div className="navbar__inner">
        <Link className="brand" to="/" aria-label="CryptoSecure home">
          <span className="brand__mark" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="#21D66F"/>
              <path d="M8 14.5L12 18.5L20 10.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="brand__text">
            <span className="brand__name">CryptoSecure</span>
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            type="button"
            className={`navbar__hamburger${mobileOpen ? " is-open" : ""}`}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            aria-controls="primary-navigation"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        <div
          className={`nav-scrim${mobileOpen ? " is-open" : ""}`}
          role="presentation"
          onClick={handleClose}
        />
        <nav
          id="primary-navigation"
          className={`nav-links${mobileOpen ? " is-open" : ""}`}
          aria-label="Primary"
        >
          <div className="nav-links__header">
            <div className="nav-links__copy">
              <span className="nav-links__eyebrow">Mobile menu</span>
              <strong>CryptoSecure</strong>
              <p>Quick links for small screens.</p>
            </div>
            <button
              type="button"
              className="nav-links__close"
              onClick={handleClose}
              aria-label="Close navigation"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <Link className="nav-link" to={{ pathname: "/", hash: "#how-it-works" }}
            onClick={handleClose}>
            How It Works
          </Link>
          <Link className="nav-link" to={{ pathname: "/", hash: "#threat-simulator" }}
            onClick={handleClose}>
            Threat Simulator
          </Link>
          <Link className="nav-link" to="/for-business"
            onClick={handleClose}>
            For Business
          </Link>
          <NavLink className="nav-link" to="/risk-scan"
            onClick={handleClose}>
            Risk Scan
          </NavLink>
          <Link className="nav-cta" to="/sign-in"
            onClick={handleClose}>
            Get Protected
          </Link>
        </nav>
      </div>
    </header>
  );
};
export default Navbar;
