import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/navbar.css";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navShellRef = useRef(null);
  const { user, logout } = useAuth();

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
    const handlePointerDown = (event) => {
      if (navShellRef.current && !navShellRef.current.contains(event.target)) {
        setMobileOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [mobileOpen]);

  const handleClose = () => setMobileOpen(false);
  const handleLogout = async () => {
    await logout();
    handleClose();
  };

  return (
    <header className="navbar" id="top" ref={navShellRef}>
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
        <nav
          id="primary-navigation"
          className={`nav-links${mobileOpen ? " is-open" : ""}`}
          aria-label="Primary"
        >
          <Link className="nav-link" to={{ pathname: "/", hash: "#how-it-works" }}
            onClick={handleClose}>
            How It Works
          </Link>
          <Link className="nav-link" to={{ pathname: "/", hash: "#threat-simulator" }}
            onClick={handleClose}>
            Threat Simulator
          </Link>
          <Link className="nav-link" to="/wiki"
            onClick={handleClose}>
            Scam Wiki
          </Link>
          <Link className="nav-link" to="/for-business"
            onClick={handleClose}>
            For Business
          </Link>
          <NavLink className="nav-link" to="/risk-scan"
            onClick={handleClose}>
            Risk Scan
          </NavLink>
          {user ? (
            <>
              <Link className="nav-link" to="/account" onClick={handleClose}>
                Account
              </Link>
              <button type="button" className="nav-cta nav-cta--button" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <Link className="nav-cta" to="/register"
              onClick={handleClose}>
              Get Protected
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};
export default Navbar;
