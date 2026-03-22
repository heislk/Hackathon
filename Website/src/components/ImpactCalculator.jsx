import { useState } from "react";
export default function ImpactCalculator() {
  const [portfolio, setPortfolio] = useState(10000);

  const RISK_PERCENTAGE = 0.042;
  const DETECTION_RATE = 0.94;

  const atRisk = portfolio * RISK_PERCENTAGE;
  const preventable = atRisk * DETECTION_RATE;
  const safeAmount = portfolio - atRisk;

  const safeWidth = (safeAmount / portfolio) * 100;
  const riskWidth = (atRisk / portfolio) * 100;

  const formatUSD = (val) =>
    val >= 1000000
      ? `$${(val / 1000000).toFixed(2)}M`
      : `$${Math.round(val).toLocaleString()}`;

  return (
    <section className="impact" id="impact">
      <div className="impact__container">
        <h2>How much of your portfolio is at risk?</h2>
        <p className="impact__subtitle">
          Based on FBI IC3 2024 data: Americans lost $9.3B in crypto fraud out of an estimated
          $220B in individual holdings — a 4.2% annual exposure rate. Adjust the slider to see your
          estimated exposure.
        </p>
        <div className="impact__grid" style={{ gridTemplateColumns: "1fr", maxWidth: "800px", margin: "48px auto 0" }}>
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
                <div
                  className="impact__bar-safe"
                  style={{ width: `${safeWidth}%`, transition: "width 0.3s ease" }}
                >
                  {safeWidth > 15 && <span>Protected {formatUSD(safeAmount)}</span>}
                </div>
                <div
                  className="impact__bar-risk"
                  style={{ width: `${riskWidth}%`, transition: "width 0.3s ease" }}
                >
                  {riskWidth > 8 && <span>At Risk</span>}
                </div>
              </div>
              <div className="impact__bar-legend">
                <span className="impact__bar-legend-item impact__bar-legend-item--safe">
                  <span className="impact__bar-legend-dot" />
                  Protected ({(100 - RISK_PERCENTAGE * 100).toFixed(1)}%)
                </span>
                <span className="impact__bar-legend-item impact__bar-legend-item--risk">
                  <span className="impact__bar-legend-dot" />
                  At Risk ({(RISK_PERCENTAGE * 100).toFixed(1)}% per year)
                </span>
              </div>
            </div>
            <div className="impact__breakdown">
              <div className="impact__breakdown-item">
                <span className="impact__breakdown-icon">⚠️</span>
                <div>
                  <strong>{formatUSD(atRisk)}</strong>
                  <span> estimated annual exposure without protection</span>
                </div>
              </div>
              <div className="impact__breakdown-item impact__breakdown-item--safe">
                <span className="impact__breakdown-icon">🛡️</span>
                <div>
                  <strong>{formatUSD(preventable)}</strong>
                  <span> preventable with early detection (94% of exposure)</span>
                </div>
              </div>
            </div>
            <p className="impact__source">
              Sources: FBI IC3 2024 Internet Crime Report (Apr 23, 2025) — $9.3B in crypto fraud losses.
              Chainalysis 2025 Crypto Crime Report — 158K personal wallet compromise incidents.
              Detection rate based on Chainalysis-reported prevention benchmarks.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}