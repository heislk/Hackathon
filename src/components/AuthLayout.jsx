import { Link } from "react-router-dom";
import "../styles/auth.css";

export default function AuthLayout({
  badge,
  title,
  description,
  stats = [],
  points = [],
  switchText,
  switchHref,
  switchLabel,
  children,
}) {
  return (
    <main className="auth-shell">
      <section className="auth-hero" aria-label="Auth overview">
        <div className="auth-brand-row">
          <Link to="/" className="auth-logo">
            CryptoSecure
          </Link>
          <span className="auth-badge">{badge}</span>
        </div>

        <div className="auth-hero-copy">
          <p className="auth-eyebrow">Secure access</p>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
        </div>

        <div className="auth-summary">
          <div className="auth-stats" aria-label="Highlights">
            {stats.map((stat) => (
              <article className="auth-stat" key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </article>
            ))}
          </div>

          <ul className="auth-points">
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="auth-card" aria-label="Authentication form">
        <div className="auth-card-header">
          <p className="auth-card-kicker">Workspace access</p>
          <h2>{badge}</h2>
        </div>

        {children}

        <p className="auth-switch">
          {switchText}{" "}
          <Link className="auth-link" to={switchHref}>
            {switchLabel}
          </Link>
        </p>
      </section>
    </main>
  );
}
