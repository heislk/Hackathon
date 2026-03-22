import { useState } from "react";
import "../../styles/business/savings.css";
const BASE_ASSUMPTIONS = {
  exposureRate: 0.042,
  preventionRate: 0.68,
  ticketRatePerThousand: 42,
  ticketReductionRate: 0.26,
  ticketCost: 18,
  platformCostPerUserMonth: 2.25,
};
const BENCHMARKS = [
  {
    source: "FBI (Apr 23, 2025)",
    value: ">$16B",
    label: "internet crime losses in 2024",
  },
  {
    source: "FBI (Apr 23, 2025)",
    value: ">$6.5B",
    label: "crypto investment fraud losses in 2024",
  },
  {
    source: "TRM",
    value: "$2.2B",
    label: "stolen in crypto-related hacks in 2024",
  },
  {
    source: "TRM",
    value: "$14M",
    label: "average hack size in 2024",
  },
  {
    source: "Repo dataset",
    value: "147",
    label: "incidents tracked across 2025 data",
  },
  {
    source: "Repo dataset",
    value: "~$3.2B",
    label: "total losses represented in the dataset",
  },
];
function formatUSD(value) {
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}
function formatNumber(value) {
  return Math.round(value).toLocaleString();
}
function formatPercent(value) {
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}
function MetricCard({ label, value, helper, tone = "default" }) {
  return (
    <article className={`b-savings__metric b-savings__metric--${tone}`}>
      <span className="b-savings__metric-label">{label}</span>
      <span className="b-savings__metric-value">{value}</span>
      <span className="b-savings__metric-helper">{helper}</span>
    </article>
  );
}
export default function BusinessSavingsSection() {
  const [customers, setCustomers] = useState(50000);
  const [annualValuePerCustomer, setAnnualValuePerCustomer] = useState(12000);
  const annualExposure =
    customers * annualValuePerCustomer * BASE_ASSUMPTIONS.exposureRate;
  const preventedLoss = annualExposure * BASE_ASSUMPTIONS.preventionRate;
  const ticketsAvoided =
    (customers / 1000) *
    BASE_ASSUMPTIONS.ticketRatePerThousand *
    BASE_ASSUMPTIONS.ticketReductionRate;
  const supportSavings = ticketsAvoided * BASE_ASSUMPTIONS.ticketCost;
  const annualPlatformCost =
    customers * BASE_ASSUMPTIONS.platformCostPerUserMonth * 12;
  const netSavings = preventedLoss + supportSavings - annualPlatformCost;
  const roiMultiple =
    annualPlatformCost > 0
      ? (preventedLoss + supportSavings) / annualPlatformCost
      : 0;
  const exposurePerCustomer = annualValuePerCustomer * BASE_ASSUMPTIONS.exposureRate;
  return (
    <section className="b-savings" id="roi">
      <div className="b-savings__container">
        <div className="b-savings__header">
          <span className="section-eyebrow">
            <span className="section-eyebrow__dot section-eyebrow__dot--teal" />
            ROI Model for Exchanges
          </span>
          <h2>See the annual savings from stopping user theft earlier.</h2>
          <p>
            This calculator translates exchange-scale risk into business terms: annual exposure,
            prevented loss, theft-related support burden, and net savings after platform cost.
          </p>
        </div>
        <div className="b-savings__grid">
          <div className="b-savings__panel b-savings__panel--inputs">
            <div className="b-savings__panel-header">
              <h3>Model inputs</h3>
              <p>Adjust the size of the protected user base and the annual value at risk.</p>
            </div>
            <div className="b-savings__control">
              <label className="b-savings__label" htmlFor="customers">
                <span>Protected customers</span>
                <strong>{formatNumber(customers)}</strong>
              </label>
              <input
                id="customers"
                className="b-savings__slider"
                type="range"
                min="1000"
                max="500000"
                step="1000"
                value={customers}
                onChange={(event) => setCustomers(Number(event.target.value))}
              />
              <div className="b-savings__scale">
                <span>1K</span>
                <span>250K</span>
                <span>500K</span>
              </div>
            </div>
            <div className="b-savings__control">
              <label className="b-savings__label" htmlFor="value">
                <span>Average annual value at risk per customer</span>
                <strong>{formatUSD(annualValuePerCustomer)}</strong>
              </label>
              <input
                id="value"
                className="b-savings__slider"
                type="range"
                min="1000"
                max="50000"
                step="500"
                value={annualValuePerCustomer}
                onChange={(event) => setAnnualValuePerCustomer(Number(event.target.value))}
              />
              <div className="b-savings__scale">
                <span>$1K</span>
                <span>$25K</span>
                <span>$50K</span>
              </div>
            </div>
            <div className="b-savings__assumptions-card">
              <div className="b-savings__assumptions-title">Visible assumptions, not guarantees</div>
              <p>
                The calculator uses benchmarked modeling inputs, not customer-specific guarantees:
                4.2% exposure rate, 68% prevention of attempted loss, 26% theft-ticket reduction,
                $18 average support cost per avoided ticket, and $2.25 per protected customer per
                month.
              </p>
            </div>
            <div className="b-savings__benchmark-card">
              <div className="b-savings__assumptions-title">Benchmark context</div>
              <p>
                These figures are here to ground the model in public data and our own 2025 corpus.
                Swap in your exchange’s actual loss, ticket, and cost data for a more precise forecast.
              </p>
              <div className="b-savings__benchmark-grid">
                {BENCHMARKS.map((item) => (
                  <article className="b-savings__benchmark" key={`${item.source}-${item.value}`}>
                    <span className="b-savings__benchmark-source">{item.source}</span>
                    <strong className="b-savings__benchmark-value">{item.value}</strong>
                    <span className="b-savings__benchmark-label">{item.label}</span>
                  </article>
                ))}
              </div>
            </div>
          </div>
          <div className="b-savings__panel b-savings__panel--results">
            <div className="b-savings__panel-header">
              <h3>Annualized impact</h3>
              <p>Outputs update instantly as you adjust the exchange profile.</p>
            </div>
            <div className="b-savings__metrics">
              <MetricCard
                label="Annual exposure"
                value={formatUSD(annualExposure)}
                helper={`${formatUSD(exposurePerCustomer)} per customer at risk`}
                tone="danger"
              />
              <MetricCard
                label="Loss prevented"
                value={formatUSD(preventedLoss)}
                helper={`${formatPercent(BASE_ASSUMPTIONS.preventionRate)} of exposure reduced`}
                tone="success"
              />
              <MetricCard
                label="Support tickets avoided"
                value={formatNumber(ticketsAvoided)}
                helper="Theft-related cases reduced through earlier intervention"
                tone="teal"
              />
              <MetricCard
                label="Support cost saved"
                value={formatUSD(supportSavings)}
                helper={`At ${formatUSD(BASE_ASSUMPTIONS.ticketCost)} per avoided ticket`}
                tone="default"
              />
            </div>
            <div className="b-savings__summary">
              <div>
                <span className="b-savings__summary-label">Net annual savings</span>
                <strong className="b-savings__summary-value">
                  {formatUSD(netSavings)}
                </strong>
              </div>
              <div className="b-savings__summary-meta">
                <span>Estimated ROI</span>
                <strong>{roiMultiple.toFixed(1)}x</strong>
              </div>
            </div>
            <div className="b-savings__note">
              Platform cost is modeled at {formatUSD(BASE_ASSUMPTIONS.platformCostPerUserMonth)} per
              customer per month. This is a benchmarked estimate, not a guarantee of outcome; replace
              the assumptions with your exchange’s actual data for a precise forecast.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}