import { useState } from "react";
import Navbar from "../components/Navbar.jsx";
import "../styles/risk-scan.css";

function RiskScan() {
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = () => {
    if (!file) {
      alert("Please select a file first.");
      return;
    }
    alert(`File "${file.name}" uploaded successfully!`);
  };

  return (
    <div className="page-shell">
      <Navbar />
      <main className="landing-page risk-scan-page">
        <section className="risk-hero">
          <div className="risk-hero__copy">
            <span className="risk-hero__eyebrow">Risk scan</span>
            <h1>Upload the evidence. We’ll help you decide if it is safe.</h1>
            <p>
              Submit a suspicious file, call log, screenshot, or exported detail and review it in
              one clean flow. The goal is not noise. It is a fast answer before a bad interaction
              turns into a loss.
            </p>
            <div className="risk-hero__chips">
              <span>Wallet checks</span>
              <span>Message review</span>
              <span>Readable findings</span>
            </div>
          </div>

          <div className="risk-upload-card">
            <div className="risk-upload-card__header">
              <span className="risk-upload-card__eyebrow">Secure intake</span>
              <h2>Start your scan</h2>
              <p>Choose a file to begin the review workflow.</p>
            </div>

            <label className="risk-upload-field">
              <span>Select evidence file</span>
              <input type="file" onChange={handleFileChange} />
            </label>

            <div className="risk-upload-meta">
              <div>
                <span className="risk-upload-meta__label">Selected file</span>
                <strong>{file ? file.name : "No file selected yet"}</strong>
              </div>
              <div>
                <span className="risk-upload-meta__label">Workflow</span>
                <strong>Encrypted intake to internal review to summary</strong>
              </div>
            </div>

            <button className="primary-btn" onClick={handleUpload}>
              Upload and Scan
            </button>
          </div>
        </section>

        <section className="risk-report-grid">
          <article className="risk-panel">
            <span className="risk-panel__eyebrow">What to upload</span>
            <h3>Useful evidence for a stronger review</h3>
            <ul className="risk-list">
              <li>Call logs, screenshots, wallet addresses, or transaction hashes</li>
              <li>Suspicious PDFs, links, token approval prompts, or contract pages</li>
              <li>Anything that pressured you to act fast or bypass normal checks</li>
            </ul>
          </article>

          <article className="risk-panel risk-panel--highlight">
            <span className="risk-panel__eyebrow">What you get back</span>
            <h3>A short decision brief instead of a wall of technical output</h3>
            <div className="risk-findings">
              <div>
                <strong>Risk score</strong>
                <p>How dangerous the interaction looks right now.</p>
              </div>
              <div>
                <strong>Red flags</strong>
                <p>The exact behaviors, approvals, or signals that triggered concern.</p>
              </div>
              <div>
                <strong>Recommended action</strong>
                <p>Proceed, pause, revoke, block, or escalate.</p>
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

export default RiskScan;
