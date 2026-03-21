import React from "react";
import "../styles/navbar.css";

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="logo">
        <a href="/">CryptoSecure</a>
      </div>
      <div className="nav-links">
        {/* <a href="#features">Features</a> */}
        <a href="/risk-scan">Risk Score</a>
        <a href="/our-mission">Our Mission</a>
      </div>
    </nav>
  );
};

export default Navbar;
