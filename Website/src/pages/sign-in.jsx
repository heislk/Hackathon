import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function SignIn() {
  const navigate = useNavigate();
  const { user, register, loading } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!loading && user) {
    return <Navigate to="/account" replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const result = await register(form.name, form.email, form.password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess("Account created. Redirecting you to login...");
    window.setTimeout(() => navigate("/login"), 600);
  };

  return (
    <AuthLayout
      badge="Create account"
      title="Set up your workspace access"
      description="Create a secure CryptoSecure account to track scans, view your tier limits, and unlock richer investigation details."
      stats={[
        { value: "Free", label: "starts with 3 weekly scans and 5 email checks" },
        { value: "Secure", label: "passwords stay protected with server-side hashing" },
      ]}
      points={[
        "Use the email you want tied to your scan history and account profile.",
        "You can upgrade later to unlock full chain details, flags, and API access.",
      ]}
      switchText="Already have an account?"
      switchHref="/login"
      switchLabel="Log in"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Full name</span>
          <input
            className="field-input"
            type="text"
            name="name"
            placeholder="Alex Morgan"
            autoComplete="name"
            value={form.name}
            onChange={handleChange}
            required
          />
          <span className="field-help">
            This is what will appear on your account profile.
          </span>
        </label>
        <label className="field">
          <span className="field-label">Email address</span>
          <input
            className="field-input"
            type="email"
            name="email"
            placeholder="name@company.com"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="field-input"
            type="password"
            name="password"
            placeholder="Create a password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Confirm password</span>
          <input
            className="field-input"
            type="password"
            name="confirmPassword"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
          />
        </label>
        {error ? <p className="auth-status auth-status--error">{error}</p> : null}
        {success ? <p className="auth-status auth-status--success">{success}</p> : null}
        <button className="auth-submit" type="submit">
          {submitting ? "Creating account..." : "Create account"}
        </button>
        <p className="auth-inline-note">
          Registration creates a Free tier account first. Upgrade options appear in your{" "}
          <Link className="auth-link" to="/account">
            account area
          </Link>{" "}
          after login.
        </p>
      </form>
    </AuthLayout>
  );
}
