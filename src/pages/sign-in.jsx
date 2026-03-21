import AuthLayout from "../components/AuthLayout.jsx";

export default function SignIn() {
  return (
    <AuthLayout
      badge="Request access"
      title="Create your access request"
      description="Send the details we need to verify your workspace and route you to the right review flow."
      stats={[
        { value: "Encrypted", label: "transport and intake are protected" },
        { value: "In-house", label: "review stays inside our stack" },
      ]}
      points={[
        "Use the company email tied to the workspace you want to review.",
        "Add a short note so we can route your access faster.",
      ]}
      switchText="Already have an account?"
      switchHref="/login"
      switchLabel="Log in"
    >
      <form className="auth-form">
        <label className="field">
          <span className="field-label">Work email</span>
          <input
            className="field-input"
            type="email"
            name="email"
            placeholder="name@company.com"
            autoComplete="email"
          />
          <span className="field-help">
            We only use this to verify the workspace owner or analyst.
          </span>
        </label>

        <label className="field">
          <span className="field-label">Organization</span>
          <input
            className="field-input"
            type="text"
            name="organization"
            placeholder="Company or team name"
            autoComplete="organization"
          />
        </label>

        <label className="field">
          <span className="field-label">Access reason</span>
          <select className="field-input" name="reason" defaultValue="">
            <option value="" disabled>
              Choose one
            </option>
            <option value="review">Review a scan</option>
            <option value="onboarding">Onboard my team</option>
            <option value="audit">Audit and reporting</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">Verification note</span>
          <textarea
            className="field-input field-textarea"
            name="note"
            rows="4"
            placeholder="Tell us what you want to access and who should be approved."
          />
        </label>

        <button className="auth-submit" type="submit">
          Submit request
        </button>
      </form>
    </AuthLayout>
  );
}
