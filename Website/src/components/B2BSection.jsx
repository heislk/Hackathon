import { useState } from "react";
export default function B2BSection() {
  const [customers, setCustomers] = useState(5000);
  const [avgPortfolio, setAvgPortfolio] = useState(15000);
  const AVG_LOSS_RATE = 0.042;
  const DETECTION_RATE = 0.68; 
  const PLATFORM_COST_PER_USER = 2.25; 
  const totalAtRisk = customers * avgPortfolio * AVG_LOSS_RATE;
  const prevented = totalAtRisk * DETECTION_RATE;
  const annualPlatformCost = customers * PLATFORM_COST_PER_USER * 12;
  const roi = annualPlatformCost > 0 ? prevented / annualPlatformCost : 0;
  const netSavings = prevented - annualPlatformCost;
  const formatUSD = (val) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${Math.round(val).toLocaleString()}`;
  };
  return (
    <section className="b2b" id="for-business">
      <div className="b2b__container">
        <div className="b2b__header">
          <h2>Protect your customers. Reduce your losses.</h2>
          <p>
            Integrate CryptoSecure's risk engine into your platform to catch fraud before it
            impacts your users. See how much you could save.
          </p>
        </div>
        <div className="b2b__grid">
          <div className="b2b__calculator">
            <h3>ROI Calculator</h3>
            <div className="b2b__input-group">
              <label>
                <span>Number of customers</span>
                <span className="b2b__input-value">{customers.toLocaleString()}</span>
              </label>
              <input
                type="range"
                min="1000"
                max="500000"
                step="1000"
                value={customers}
                onChange={(e) => setCustomers(Number(e.target.value))}
                className="b2b__slider"
              />
              <div className="b2b__range-labels">
                <span>1K</span>
                <span>250K</span>
                <span>500K</span>
              </div>
            </div>
            <div className="b2b__input-group">
              <label>
                <span>Average customer portfolio</span>
                <span className="b2b__input-value">{formatUSD(avgPortfolio)}</span>
              </label>
              <input
                type="range"
                min="1000"
                max="100000"
                step="1000"
                value={avgPortfolio}
                onChange={(e) => setAvgPortfolio(Number(e.target.value))}
                className="b2b__slider"
              />
              <div className="b2b__range-labels">
                <span>$1K</span>
                <span>$50K</span>
                <span>$100K</span>
              </div>
            </div>
          </div>
          <div className="b2b__results">
            <div className="b2b__result-card b2b__result-card--danger">
              <span className="b2b__result-label">Annual theft exposure (without protection)</span>
              <span className="b2b__result-value">{formatUSD(totalAtRisk)}</span>
            </div>
            <div className="b2b__result-card b2b__result-card--success">
              <span className="b2b__result-label">Theft prevented with CryptoSecure</span>
              <span className="b2b__result-value">{formatUSD(prevented)}</span>
            </div>
            <div className="b2b__result-card">
              <span className="b2b__result-label">Annual platform cost</span>
              <span className="b2b__result-value">{formatUSD(annualPlatformCost)}</span>
            </div>
            <div className="b2b__result-card b2b__result-card--highlight">
              <span className="b2b__result-label">Net savings</span>
              <span className="b2b__result-value b2b__result-value--lg">{formatUSD(netSavings)}</span>
            </div>
            <div className="b2b__roi">
              <span className="b2b__roi-label">Return on Investment</span>
              <span className="b2b__roi-value">{roi.toFixed(0)}x</span>
            </div>
            <a className="btn btn--teal btn--full" href="#contact">
              Schedule a Demo
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}