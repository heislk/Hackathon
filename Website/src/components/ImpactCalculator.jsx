import { useState, useEffect, useRef } from "react";
export default function ImpactCalculator() {
  const [portfolio, setPortfolio] = useState(10000);
  const RISK_PERCENTAGE = 0.067; 
  const atRisk = portfolio * RISK_PERCENTAGE;
  const riskWidth = Math.min(RISK_PERCENTAGE * 100, 100);
  const formatUSD = (val) =>
    val >= 1000000
      ? `$${(val / 1000000).toFixed(2)}M`
      : `$${Math.round(val).toLocaleString()}`;
  return (
    <section className="impact" id="impact">
      <div className="impact__container">
        <span className="section-eyebrow">
          <span className="section-eyebrow__dot section-eyebrow__dot--danger" />
          Portfolio Risk Calculator
        </span>
        <h2>How much of your portfolio is at risk?</h2>
        <p className="impact__subtitle">
          Based on 2025 crypto theft data, here's what you could be exposed to without proper
          security measures.
        </p>
        <div className="impact__grid" style={{ gridTemplateColumns: '1fr', maxWidth: '800px', margin: '48px auto 0' }}>
          <div className="impact__calculator">
            <label className="impact__label">
              <span>Your portfolio value</span>
              <span className="impact__value">{formatUSD(portfolio)}</span>
            </label>
            <input
              type="range"
              min="1000"
              max="1000000"
              step="1000"
              value={portfolio}
              onChange={(e) => setPortfolio(Number(e.target.value))}
              className="impact__slider"
            />
            <div className="impact__range-labels">
              <span>$1K</span>
              <span>$500K</span>
              <span>$1M</span>
            </div>
            <div className="impact__bar-container">
              <div className="impact__bar-label">
                <span>Estimated annual risk exposure</span>
                <span className="impact__bar-value">{formatUSD(atRisk)}</span>
              </div>
              <div className="impact__bar">
                <div className="impact__bar-safe" style={{ width: `${100 - riskWidth}%` }}>
                  <span>Protected</span>
                </div>
                <div className="impact__bar-risk" style={{ width: `${riskWidth}%` }}>
                  <span>At Risk</span>
                </div>
              </div>
            </div>
            <div className="impact__breakdown">
              <div className="impact__breakdown-item">
                <span className="impact__breakdown-icon">⚠️</span>
                <div>
                  <strong>{formatUSD(atRisk)}</strong>
                  <span>could be stolen annually without protection</span>
                </div>
              </div>
              <div className="impact__breakdown-item impact__breakdown-item--safe">
                <span className="impact__breakdown-icon">🛡️</span>
                <div>
                  <strong>{formatUSD(atRisk * 0.94)}</strong>
                  <span>preventable with CryptoSecure's detection</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}