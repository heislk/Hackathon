import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const navigate = useNavigate();
  const { user, login, loading } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!loading && user) {
    return <Navigate to="/account" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const result = await login(form.email, form.password);

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    navigate("/account");
  };

  return (
    <AuthLayout
      badge="Welcome back"
      title="Log in"
      description="Return to your workspace and continue reviewing scans and reports."
      stats={[
        { value: "Private", label: "session stays tied to this device" },
        { value: "Fast", label: "straight into your workspace" },
      ]}
      points={[
        "Use the email and password tied to your account.",
        "Turn on Remember me only on a device you trust.",
      ]}
      switchText="Need an account?"
      switchHref="/register"
      switchLabel="Create one"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Email address</span>
          <input
            className="field-input"
            type="email"
            name="email"
            placeholder="name@company.com"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            required
          />
          <span className="field-help">Use the email associated with your workspace.</span>
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="field-input"
            type="password"
            name="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            required
          />
        </label>
        <div className="auth-row">
          <label className="remember-row">
            <input type="checkbox" name="remember" defaultChecked />
            <span>Remember me</span>
          </label>
          <Link className="auth-link" to="/register">
            Create account
          </Link>
        </div>
        {error ? <p className="auth-status auth-status--error">{error}</p> : null}
        <button className="auth-submit" type="submit">
          {submitting ? "Signing in..." : "Continue"}
        </button>
      </form>
    </AuthLayout>
  );
}
