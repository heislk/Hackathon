import { useSubscription } from "../context/SubscriptionContext.jsx";
import { Link } from "react-router-dom";
import "../styles/gate-blur.css";

export default function GateBlur({ featureKey, children, label = "Pro feature" }) {
  const { isFeatureBlocked, tier } = useSubscription();

  if (!isFeatureBlocked(featureKey)) {
    return children;
  }

  return (
    <div className="gate-blur__wrapper">
      <div className="gate-blur__content" aria-hidden="true">
        {children}
      </div>
      <div className="gate-blur__overlay" role="region" aria-label={`${label} — upgrade required`}>
        <div className="gate-blur__card">
          <div className="gate-blur__icon">🔒</div>
          <strong className="gate-blur__title">{label}</strong>
          <p className="gate-blur__body">
            {tier === "free"
              ? "Upgrade to Pro to unlock full chain intelligence, risk flags, and transaction history."
              : "This feature requires an Enterprise plan."}
          </p>
          <Link className="gate-blur__cta" to="/account">
            Upgrade plan →
          </Link>
        </div>
      </div>
    </div>
  );
}
