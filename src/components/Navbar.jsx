import { Link, NavLink } from "react-router-dom";
import "../styles/navbar.css";

const navLinkClassName = ({ isActive }) => `nav-link${isActive ? " is-active" : ""}`;

const Navbar = () => {
  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link className="brand" to="/" aria-label="CryptoSecure home">
          <span className="brand__mark" aria-hidden="true" />
          <span className="brand__text">
            <span className="brand__name">CryptoSecure</span>
            <span className="brand__tagline">Security review for crypto holders</span>
          </span>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          <Link className="nav-link nav-link--muted" to={{ pathname: "/", hash: "#about" }}>
            About
          </Link>
          <Link className="nav-link nav-link--muted" to={{ pathname: "/", hash: "#mission" }}>
            Impact
          </Link>
          <Link className="nav-link nav-link--muted" to={{ pathname: "/", hash: "#security" }}>
            Security
          </Link>
          <NavLink className={navLinkClassName} to="/risk-scan">
            Risk Score
          </NavLink>
          <NavLink className={navLinkClassName} to="/login">
            Login
          </NavLink>
          <Link className="nav-cta" to="/sign-in">
            Get Protected
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
