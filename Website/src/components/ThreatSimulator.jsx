import { useState } from "react";
const ATTACKS = [
  {
    id: "phishing",
    tab: "Phishing Email",
    icon: "✉️",
    title: "Phishing Email Attack",
    description: "A spoofed email that impersonates a trusted exchange, urging you to 'verify your account' through a malicious link.",
    before: {
      label: "What you see",
      content: (
        <div className="sim-email">
          <div className="sim-email__header">
            <div className="sim-email__from">
              <strong>Coinbase Support</strong>
              <span className="sim-email__address">security@c0inbase-support.com</span>
            </div>
            <div className="sim-email__subject">⚠️ Urgent: Unusual Login Detected — Verify Now</div>
          </div>
          <div className="sim-email__body">
            <p>Dear Valued Customer,</p>
            <p>We detected an unauthorized login attempt from <strong>Moscow, Russia</strong> on your account. Your account has been temporarily limited.</p>
            <p>To restore full access, please verify your identity immediately:</p>
            <a className="sim-email__btn" href="#threat-simulator" onClick={(e) => e.preventDefault()}>
              Verify My Account →
            </a>
            <p className="sim-email__footer">If you don't verify within 24 hours, your account will be permanently suspended.</p>
          </div>
        </div>
      ),
    },
    after: {
      label: "What's really happening",
      flags: [
        { icon: "🚩", text: "Sender domain is 'c0inbase-support.com' — a zero replaces the 'o'" },
        { icon: "🚩", text: "Link redirects to a credential-harvesting phishing page" },
        { icon: "🚩", text: "Urgency language designed to bypass rational thinking" },
        { icon: "🚩", text: "Coinbase never threatens permanent suspension via email" },
      ],
      result: "Once you enter your credentials, attackers gain full access to your exchange account and drain your funds within minutes.",
    },
  },
  {
    id: "extension",
    tab: "Wallet Drain",
    icon: "🧩",
    title: "Malicious Chrome Extension",
    description: "A fake 'portfolio tracker' extension that silently replaces destination addresses when you make transactions.",
    before: {
      label: "What you see",
      content: (
        <div className="sim-extension">
          <div className="sim-extension__bar">
            <div className="sim-extension__dots">
              <span /><span /><span />
            </div>
            <div className="sim-extension__url">chrome-web-store/extension/crypto-portfolio-pro</div>
          </div>
          <div className="sim-extension__body">
            <div className="sim-extension__icon">📊</div>
            <h4>CryptoPortfolio Pro</h4>
            <p>Track your portfolio across all chains in real-time.</p>
            <div className="sim-extension__rating">★★★★★ 4.8 (2,341 reviews)</div>
            <div className="sim-extension__perms">
              <span className="sim-extension__perms-title">Permissions requested:</span>
              <ul>
                <li>Read and change all your data on all websites</li>
                <li>Manage your extensions</li>
              </ul>
            </div>
            <button className="sim-extension__install" onClick={(e) => e.preventDefault()}>Add to Chrome</button>
          </div>
        </div>
      ),
    },
    after: {
      label: "What's really happening",
      flags: [
        { icon: "🚩", text: "Extension requests 'read and change ALL data' — far beyond what a portfolio tracker needs" },
        { icon: "🚩", text: "It injects code into MetaMask and other wallet pages" },
        { icon: "🚩", text: "Silently replaces recipient wallet addresses during transactions" },
        { icon: "🚩", text: "Fake reviews inflate trust score" },
      ],
      result: "When you send a transfer, the extension swaps the recipient address to the attacker's wallet. Your funds go to them, not your intended recipient.",
    },
  },
  {
    id: "sms",
    tab: "SMS Scam",
    icon: "💬",
    title: "SMS Impersonation Attack",
    description: "A text message that spoofs your exchange's phone number, directing you to a fake 'security' page.",
    before: {
      label: "What you see",
      content: (
        <div className="sim-sms">
          <div className="sim-sms__header">
            <span className="sim-sms__contact">Binance</span>
            <span className="sim-sms__time">2:34 PM</span>
          </div>
          <div className="sim-sms__messages">
            <div className="sim-sms__bubble sim-sms__bubble--received">
              ALERT: A withdrawal of 2.5 BTC was initiated from your account. If this was NOT you, cancel immediately: https://binance-secure.xyz/cancel
            </div>
            <div className="sim-sms__bubble sim-sms__bubble--received">
              Reply STOP to ignore. This request will process in 15 minutes.
            </div>
          </div>
        </div>
      ),
    },
    after: {
      label: "What's really happening",
      flags: [
        { icon: "🚩", text: "Domain 'binance-secure.xyz' is not Binance's real domain" },
        { icon: "🚩", text: "SMS sender IDs can be spoofed — it appears in the same thread as real Binance texts" },
        { icon: "🚩", text: "The 15-minute timer creates false urgency" },
        { icon: "🚩", text: "The 'cancel' link leads to a phishing page that captures your login + 2FA code" },
      ],
      result: "The fake cancellation page captures your credentials and 2FA token. Attackers use them instantly to actually withdraw your funds.",
    },
  },
  {
    id: "transaction",
    tab: "Malicious Approval",
    icon: "📝",
    title: "Hidden Token Approval Attack",
    description: "A DeFi interaction that hides an unlimited token approval, giving attackers the ability to drain your wallet later.",
    before: {
      label: "What you see",
      content: (
        <div className="sim-tx">
          <div className="sim-tx__header">
            <span className="sim-tx__wallet-icon">🦊</span>
            <span>MetaMask — Confirm Transaction</span>
          </div>
          <div className="sim-tx__body">
            <div className="sim-tx__site">app.defi-yield-boost.io</div>
            <div className="sim-tx__action">Stake 0.1 ETH</div>
            <div className="sim-tx__detail">
              <div className="sim-tx__row">
                <span>Estimated Gas Fee</span>
                <span>0.002 ETH</span>
              </div>
              <div className="sim-tx__row">
                <span>Network</span>
                <span>Ethereum Mainnet</span>
              </div>
            </div>
            <div className="sim-tx__buttons">
              <button className="sim-tx__reject" onClick={(e) => e.preventDefault()}>Reject</button>
              <button className="sim-tx__confirm" onClick={(e) => e.preventDefault()}>Confirm</button>
            </div>
          </div>
        </div>
      ),
    },
    after: {
      label: "What's really happening",
      flags: [
        { icon: "🚩", text: "The transaction includes a hidden 'approve()' call granting UNLIMITED access to your USDC, USDT, and WETH" },
        { icon: "🚩", text: "The smart contract is unverified on Etherscan" },
        { icon: "🚩", text: "The DeFi protocol has no audit and was deployed 3 days ago" },
        { icon: "🚩", text: "Gas is unusually high because multiple approval txns are batched" },
      ],
      result: "Days or weeks later, attackers use the approval to drain all approved tokens from your wallet — no additional confirmation needed.",
    },
  },
];
export default function ThreatSimulator() {
  const [activeTab, setActiveTab] = useState(0);
  const [showAfter, setShowAfter] = useState(false);
  const attack = ATTACKS[activeTab];
  const handleTabChange = (index) => {
    setActiveTab(index);
    setShowAfter(false);
  };
  return (
    <section className="threat-sim" id="threat-simulator">
      <div className="threat-sim__container">
        <div className="threat-sim__header">
          <span className="section-eyebrow">
            <span className="section-eyebrow__dot section-eyebrow__dot--danger" />
            Interactive Threat Simulator
          </span>
          <h2>See what an attack looks like — before it happens to you.</h2>
          <p>
            These simulations are based on real attack patterns that have stolen billions from
            crypto holders. Click through each one to understand how they work.
          </p>
        </div>
        <div className="threat-sim__tabs">
          {ATTACKS.map((a, i) => (
            <button
              key={a.id}
              className={`threat-sim__tab${i === activeTab ? " is-active" : ""}`}
              onClick={() => handleTabChange(i)}
            >
              <span className="threat-sim__tab-icon">{a.icon}</span>
              {a.tab}
            </button>
          ))}
        </div>
        <div className="threat-sim__content">
          <div className="threat-sim__info">
            <h3>{attack.title}</h3>
            <p>{attack.description}</p>
          </div>
          <div className="threat-sim__panels">
            <div className={`threat-sim__panel${!showAfter ? " is-active" : ""}`}>
              <span className="threat-sim__panel-label">{attack.before.label}</span>
              {attack.before.content}
            </div>
            <div className={`threat-sim__panel threat-sim__panel--after${showAfter ? " is-active" : ""}`}>
              <span className="threat-sim__panel-label threat-sim__panel-label--danger">{attack.after.label}</span>
              <div className="threat-sim__flags">
                {attack.after.flags.map((flag, i) => (
                  <div className="threat-sim__flag" key={i}>
                    <span>{flag.icon}</span>
                    <span>{flag.text}</span>
                  </div>
                ))}
              </div>
              <div className="threat-sim__result">
                <strong>The result:</strong> {attack.after.result}
              </div>
            </div>
          </div>
          <button
            className={`btn ${showAfter ? "btn--primary" : "btn--danger"} btn--full`}
            onClick={() => setShowAfter(!showAfter)}
          >
            {showAfter ? "← Back to what you'd see" : "Reveal what's really happening →"}
          </button>
        </div>
      </div>
    </section>
  );
}