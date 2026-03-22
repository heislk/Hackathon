import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useSubscription } from "../context/SubscriptionContext.jsx";
import "../styles/auth.css";
import "../styles/account.css";

function formatDate(value, options = {}) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, options);
}

function formatLimit(used, limit) {
  if (limit === Infinity) return `${used} used / Unlimited`;
  return `${used} used / ${Math.max(0, limit - used)} remaining`;
}

function verdictTone(verdict) {
  if (verdict === "High Risk") return "high";
  if (verdict === "Suspicious") return "suspicious";
  if (verdict === "Needs Review") return "review";
  return "safe";
}

export default function Account() {
  const { user, loading, logout, getScanHistory, usage, changeTier, resetAccountData } = useAuth();
  const { tier, limits } = useSubscription();
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 8, total: 0, totalPages: 1 });
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tierBusy, setTierBusy] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [demoMessage, setDemoMessage] = useState("");

  useEffect(() => {
    if (!user) return undefined;

    let active = true;

    async function loadHistory() {
      setHistoryLoading(true);
      const data = await getScanHistory(pagination.page, pagination.pageSize);
      if (!active) return;
      setHistory(data.history);
      setPagination((current) => ({ ...current, ...data.pagination }));
      setHistoryLoading(false);
    }

    loadHistory();

    return () => {
      active = false;
    };
  }, [getScanHistory, pagination.page, pagination.pageSize, user]);

  const initials = useMemo(() => {
    const source = user?.name?.trim() || user?.email || "CS";
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }, [user?.email, user?.name]);

  const loadHistoryPage = async (page = pagination.page, pageSize = pagination.pageSize) => {
    setHistoryLoading(true);
    const data = await getScanHistory(page, pageSize);
    setHistory(data.history);
    setPagination((current) => ({ ...current, ...data.pagination, page, pageSize }));
    setHistoryLoading(false);
  };

  const handleTierChange = async (nextTier) => {
    if (nextTier === tier) return;
    setTierBusy(nextTier);
    setDemoMessage("");
    const result = await changeTier(nextTier);
    if (result.ok) {
      setDemoMessage(`Plan switched to ${nextTier}.`);
    } else {
      setDemoMessage(result.error || "Could not update plan.");
    }
    setTierBusy("");
  };

  const handleResetData = async () => {
    setResetBusy(true);
    setDemoMessage("");
    const result = await resetAccountData();
    if (result.ok) {
      await loadHistoryPage(1, pagination.pageSize);
      setDemoMessage("Usage and scan history reset for this account.");
    } else {
      setDemoMessage(result.error || "Could not reset account data.");
    }
    setResetBusy(false);
  };

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="page-shell">
        <Navbar />
        <main className="account-page">
          <section className="account-shell">
            <div className="account-card">
              <p className="account-empty">Loading your account...</p>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <Navbar />
      <main className="account-page">
        <section className="account-shell">
          <header className="account-hero">
            <div className="account-hero__identity">
              <div className="account-avatar" aria-hidden="true">
                {initials}
              </div>
              <div>
                <p className="account-eyebrow">Member workspace</p>
                <h1>{user.name}</h1>
                <p className="account-subtitle">
                  {user.email} · Member since {formatDate(user.createdAt, { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
            </div>
            <div className="account-hero__meta">
              <span className={`tier-badge tier-badge--${tier}`}>{tier}</span>
              {tier === "enterprise" ? <span className="account-api-label">API access enabled</span> : null}
            </div>
          </header>

          <section className="account-grid">
            <article className="account-card subscription-card">
              <div className="account-card__header">
                <div>
                  <p className="account-card__eyebrow">Subscription</p>
                  <h2>{tier === "free" ? "Free plan" : tier === "pro" ? "Pro plan" : "Enterprise plan"}</h2>
                </div>
                <Link className="account-button" to="/for-business">
                  {tier === "free" ? "Upgrade plan" : "Contact sales"}
                </Link>
              </div>

              <div className="subscription-stats">
                <div className="subscription-stat">
                  <span>Weekly scans</span>
                  <strong>{formatLimit(usage.weeklyScans, limits.weeklyScans)}</strong>
                </div>
                <div className="subscription-stat">
                  <span>Monthly email checks</span>
                  <strong>{formatLimit(usage.monthlyEmails, limits.monthlyEmails)}</strong>
                </div>
              </div>

              <div className="subscription-details">
                <p>
                  Free accounts see basic verdicts only. Pro unlocks full chain intelligence, flags,
                  and transaction history. Enterprise adds unlimited usage and API access labeling.
                </p>
                <Link className="account-link" to="/risk-scan">
                  Run another scan
                </Link>
              </div>

              <div className="account-demo-tools">
                <div className="account-demo-tools__header">
                  <div>
                    <p className="account-card__eyebrow">Demo controls</p>
                    <h3>Switch plan instantly</h3>
                  </div>
                  <button
                    className="account-button account-button--muted"
                    type="button"
                    onClick={handleResetData}
                    disabled={resetBusy}
                  >
                    {resetBusy ? "Resetting..." : "Reset my data"}
                  </button>
                </div>
                <div className="account-tier-picker">
                  {["free", "pro", "enterprise"].map((option) => (
                    <button
                      key={option}
                      className={`account-tier-option${tier === option ? " account-tier-option--active" : ""}`}
                      type="button"
                      onClick={() => handleTierChange(option)}
                      disabled={Boolean(tierBusy) || resetBusy}
                    >
                      {tierBusy === option ? "Switching..." : option}
                    </button>
                  ))}
                </div>
                {demoMessage ? <p className="account-demo-message">{demoMessage}</p> : null}
              </div>
            </article>

            <article className="account-card">
              <div className="account-card__header">
                <div>
                  <p className="account-card__eyebrow">Settings</p>
                  <h2>Password</h2>
                </div>
              </div>
              <form className="account-settings">
                <label className="field">
                  <span className="field-label">Current password</span>
                  <input className="field-input" type="password" placeholder="Current password" disabled />
                </label>
                <label className="field">
                  <span className="field-label">New password</span>
                  <input className="field-input" type="password" placeholder="New password" disabled />
                </label>
                <label className="field">
                  <span className="field-label">Confirm new password</span>
                  <input className="field-input" type="password" placeholder="Confirm new password" disabled />
                </label>
                <p className="account-note">
                  Password updates are stubbed in this demo. Session management and usage tracking are live.
                </p>
                <button className="account-button account-button--muted" type="button" disabled>
                  Change password
                </button>
              </form>
            </article>
          </section>

          <section className="account-card">
            <div className="account-card__header">
              <div>
                <p className="account-card__eyebrow">Scan history</p>
                <h2>Recent investigations</h2>
              </div>
              <span className="account-table__count">{pagination.total} total scans</span>
            </div>

            {historyLoading ? (
              <p className="account-empty">Loading scan history...</p>
            ) : history.length === 0 ? (
              <div className="account-empty-state">
                <p className="account-empty">No saved scans yet.</p>
                <Link className="account-button" to="/risk-scan">
                  Start first scan
                </Link>
              </div>
            ) : (
              <>
                <div className="account-table-wrap">
                  <table className="account-table">
                    <thead>
                      <tr>
                        <th>Input</th>
                        <th>Kind</th>
                        <th>Verdict</th>
                        <th>Scanned at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => (
                        <tr key={item.id}>
                          <td className="account-table__value">{item.input_value}</td>
                          <td>{item.input_kind}</td>
                          <td>
                            <span className={`verdict-badge verdict-badge--${verdictTone(item.verdict)}`}>
                              {item.verdict}
                            </span>
                          </td>
                          <td>{formatDate(item.scanned_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="account-pagination">
                  <button
                    className="account-button account-button--muted"
                    type="button"
                    onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
                    disabled={pagination.page <= 1}
                  >
                    Previous
                  </button>
                  <span>
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    className="account-button account-button--muted"
                    type="button"
                    onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.totalPages, current.page + 1) }))}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="account-actions">
            <button className="account-button account-button--muted" type="button" onClick={logout}>
              Log out
            </button>
          </section>
        </section>
      </main>
      <Footer />
    </div>
  );
}
