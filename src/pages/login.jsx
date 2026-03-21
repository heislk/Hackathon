import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout.jsx";

export default function Login() {
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
      switchHref="/sign-in"
      switchLabel="Request access"
    >
      <form className="auth-form">
        <label className="field">
          <span className="field-label">Email address</span>
          <input
            className="field-input"
            type="email"
            name="email"
            placeholder="name@company.com"
            autoComplete="email"
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
          />
        </label>

        <div className="auth-row">
          <label className="remember-row">
            <input type="checkbox" name="remember" defaultChecked />
            <span>Remember me</span>
          </label>

          <Link className="auth-link" to="/sign-in">
            Request access
          </Link>
        </div>

        <button className="auth-submit" type="submit">
          Continue
        </button>
      </form>
    </AuthLayout>
  );
}
