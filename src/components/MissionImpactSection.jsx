import AreaChart from "./AreaChart.jsx";
import "../styles/mission-impact.css";

const stats = [
  {
    value: "$3.4B",
    label: "stolen in crypto theft incidents in 2025, based on Chainalysis reporting",
  },
  {
    value: "$283M",
    label: "average stolen per month in 2025, derived from the yearly total",
  },
  {
    value: "158K",
    label: "personal wallet compromise incidents recorded in 2025 by Chainalysis",
  },
  {
    value: "$2.87B",
    label: "stolen across nearly 150 hacks in 2025, according to TRM Labs",
  },
];

export default function MissionImpactSection() {
  return (
    <section className="mission-impact" id="mission">
      <div className="mission-impact__eyebrow">Mission and impact</div>
      <div className="mission-impact__header">
        <h2>Stop crypto theft before the loss becomes irreversible.</h2>
        <p>
          We want to give crypto holders a practical way to spot risk early: scan suspicious
          contacts, files, wallet behavior, and approval flows with analysis that stays encrypted
          and in-house, then surface the risk in plain language before assets move.
        </p>
      </div>

      <div className="mission-impact__stats">
        {stats.map((stat) => (
          <article className="mission-impact__stat" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </div>

      <div className="mission-impact__grid">
          <div className="mission-impact__chart-card">
          <div className="mission-impact__card-label">Annual crypto theft trend</div>
          <AreaChart />
          <p className="mission-impact__caption">
            Chainalysis reported about $3.7B stolen in 2022, $1.8B in 2023, $2.2B in 2024,
            and $3.4B in 2025. The monthly average above is derived from the 2025 annual figure.
          </p>
        </div>

        <div className="mission-impact__callout">
          <h3>Why this exists</h3>
          <p>
            The biggest losses are not abstract. They usually start with a leaked key, a spoofed
            message, a poisoned file, or a compromised workflow. Our goal is to catch that risk
            while there is still time to stop the transfer.
          </p>
          <p className="mission-impact__sources">
            Sources: Chainalysis 2026 Crypto Crime Report and TRM Labs 2026 Crypto Crime Report.
          </p>
        </div>
      </div>
    </section>
  );
}
