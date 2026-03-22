import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
const TARGET_STATS = [
  { value: 3.5, prefix: "$", suffix: "B+", label: "stolen from crypto holders in 2025" },
  { value: 300, prefix: "", suffix: "K+", label: "wallets compromised last year" },
  { value: 4.7, prefix: "", suffix: "M", label: "phishing attempts detected monthly" },
];
function useCountUp(target, duration = 2000) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const hasRun = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRun.current) {
          hasRun.current = true;
          const start = performance.now();
          const animate = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(eased * target);
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);
  return { value, ref };
}
function StatCounter({ stat }) {
  const { value, ref } = useCountUp(stat.value);
  const display = stat.value >= 100
    ? `${stat.prefix}${Math.round(value).toLocaleString()}${stat.suffix}`
    : `${stat.prefix}${value.toFixed(1)}${stat.suffix}`;
  return (
    <div className="hero-stat" ref={ref}>
      <span className="hero-stat__value">{display}</span>
      <span className="hero-stat__label">{stat.label}</span>
    </div>
  );
}
function LiveTheftCounter() {
  const [secondsOnPage, setSecondsOnPage] = useState(0);
  const timerRef = useRef(null);
  const STOLEN_PER_SECOND = 111; 
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsOnPage((s) => s + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);
  const globalStolen = secondsOnPage * STOLEN_PER_SECOND;
  const formatUSD = (val) =>
    val >= 1000000
      ? `$${(val / 1000000).toFixed(2)}M`
      : `$${Math.round(val).toLocaleString()}`;
  const formatTime = (totalSeconds) => {
    if (totalSeconds < 60) return `(${totalSeconds}s ago)`;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return `(${parts.join(' ')} ago)`;
  };
  return (
    <div className="hero-stat impact__live" style={{ padding: '20px', textAlign: 'left', borderRadius: '16px', gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div className="impact__live-counter" style={{ background: 'rgba(255, 255, 255, 0.15)' }}>
          <div className="impact__live-dot" />
          <span>Live global theft counter</span>
        </div>
        <p className="impact__live-caption" style={{ marginTop: '12px' }}>
          stolen globally since you opened this page
        </p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="impact__live-value" style={{ marginTop: 0, fontSize: '2.5rem' }}>{formatUSD(globalStolen)}</div>
        <div className="impact__live-time">{formatTime(secondsOnPage)}</div>
      </div>
    </div>
  );
}
export default function HeroSection() {
  return (
    <section className="hero">
      <div className="hero__container">
        <div className="hero__badge">
          <span className="hero__badge-dot" />
          Protecting crypto holders worldwide
        </div>
        <h1 className="hero__title">
          Learn to spot phishing. <br />
          <span className="hero__title-accent">Before it costs you everything.</span>
        </h1>
        <p className="hero__subtitle">
          CryptoSecure helps people learn what phishing looks like, compare real vs fake exchange
          messages, and scan suspicious emails, links, wallet addresses, and transaction activity
          <em> before </em> they make a costly mistake.
        </p>
        <div className="hero__actions">
          <Link className="btn btn--primary btn--lg" to="/risk-scan">
            Analyze a Suspicious Message
          </Link>
          <a className="btn btn--outline btn--lg" href="#phishing-examples">
            Compare Legit vs Fake
          </a>
        </div>
        <div className="hero__stats">
          {TARGET_STATS.map((stat) => (
            <StatCounter key={stat.label} stat={stat} />
          ))}
          <LiveTheftCounter />
        </div>
      </div>
      <div className="hero__scroll-indicator">
        <span>Scroll to learn more</span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 4V16M10 16L5 11M10 16L15 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </section>
  );
}
