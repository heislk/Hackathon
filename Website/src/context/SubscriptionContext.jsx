/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from "react";
import { useAuth } from "./AuthContext.jsx";

const SubscriptionContext = createContext(null);

export const TIER_LIMITS = {
  free: { weeklyScans: 3, monthlyEmails: 5, label: "Free" },
  pro: { weeklyScans: 25, monthlyEmails: 50, label: "Pro" },
  enterprise: { weeklyScans: Infinity, monthlyEmails: Infinity, label: "Enterprise" },
};

export const TIER_FEATURES = {
  free: {
    fullChainData: false,
    transactionHistory: false,
    addressIntelligence: false,
    riskFlags: false,
    exportReports: false,
  },
  pro: {
    fullChainData: true,
    transactionHistory: true,
    addressIntelligence: true,
    riskFlags: true,
    exportReports: false,
  },
  enterprise: {
    fullChainData: true,
    transactionHistory: true,
    addressIntelligence: true,
    riskFlags: true,
    exportReports: true,
  },
};

export function SubscriptionProvider({ children }) {
  const auth = useAuth();
  const tier = auth.user?.tier || "free";
  const features = TIER_FEATURES[tier] || TIER_FEATURES.free;
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

  const canScan = () => {
    if (!auth.user) return true;
    if (limits.weeklyScans === Infinity) return true;
    return auth.usage.weeklyScans < limits.weeklyScans;
  };

  const canCheckEmail = () => {
    if (!auth.user) return true;
    if (limits.monthlyEmails === Infinity) return true;
    return auth.usage.monthlyEmails < limits.monthlyEmails;
  };

  const isFeatureBlocked = (featureKey) => {
    return !features[featureKey];
  };

  const scansRemaining = () => {
    if (limits.weeklyScans === Infinity) return Infinity;
    return Math.max(0, limits.weeklyScans - auth.usage.weeklyScans);
  };

  const emailsRemaining = () => {
    if (limits.monthlyEmails === Infinity) return Infinity;
    return Math.max(0, limits.monthlyEmails - auth.usage.monthlyEmails);
  };

  return (
    <SubscriptionContext.Provider value={{
      tier, features, limits, usage: auth.usage,
      canScan, canCheckEmail, isFeatureBlocked,
      scansRemaining, emailsRemaining,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used inside SubscriptionProvider");
  return ctx;
}
