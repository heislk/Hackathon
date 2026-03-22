const COMPARISONS = [
  {
    exchange: "Coinbase",
    legit: {
      from: "security@coinbase.com",
      subject: "New device confirmation",
      items: [
        "Uses the real `coinbase.com` domain",
        "References the sign-in event without threatening immediate suspension",
        "Tells you to sign in through the app or official website",
      ],
    },
    fake: {
      from: "security@coinbase-recovery-help.com",
      subject: "Urgent wallet recovery required",
      items: [
        "Uses a lookalike support domain",
        "Pushes a deadline and emotional urgency",
        "Sends you to a link asking for your seed phrase or password",
      ],
    },
  },
  {
    exchange: "Binance",
    legit: {
      from: "do-not-reply@binance.com",
      subject: "Withdrawal confirmation",
      items: [
        "Matches Binance's real domain and transaction details",
        "Asks you to confirm through the official app or account center",
        "Never asks for your 2FA code by email or SMS",
      ],
    },
    fake: {
      from: "alerts@binance-secure.xyz",
      subject: "Cancel 2.5 BTC withdrawal now",
      items: [
        "Uses a non-Binance domain",
        "Invents a countdown to force fast action",
        "Routes you to a fake cancellation page that steals credentials",
      ],
    },
  },
  {
    exchange: "Kraken",
    legit: {
      from: "no-reply@email.kraken.com",
      subject: "Security alert for your account",
      items: [
        "Comes from Kraken's real mail domain",
        "Tells you where to verify the alert inside your account",
        "Does not ask for wallet recovery phrases or remote access",
      ],
    },
    fake: {
      from: "support@kraken-verification.net",
      subject: "Identity verification needed today",
      items: [
        "Adds generic compliance language without exact account context",
        "Pushes you to upload secrets outside the real dashboard",
        "Often asks for screenshots, 2FA codes, or private keys",
      ],
    },
  },
];

export default function PhishingExamples() {
  return (
    <section className="phishing-examples" id="phishing-examples">
      <div className="phishing-examples__container">
        <div className="phishing-examples__header">
          <h2>Train your eye with side-by-side examples.</h2>
          <p>
            The fastest way to spot phishing is to compare what real exchange communication looks
            like against the most common scam patterns attackers use.
          </p>
        </div>

        <div className="phishing-examples__list">
          {COMPARISONS.map((comparison) => (
            <article key={comparison.exchange} className="example-card">
              <div className="example-card__top">
                <strong>{comparison.exchange}</strong>
                <span>What good and bad messages usually look like</span>
              </div>
              <div className="example-card__grid">
                <section className="example-card__panel example-card__panel--legit">
                  <span className="example-card__label">Legitimate</span>
                  <div className="example-card__meta">
                    <strong>{comparison.legit.from}</strong>
                    <p>{comparison.legit.subject}</p>
                  </div>
                  <ul>
                    {comparison.legit.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="example-card__panel example-card__panel--fake">
                  <span className="example-card__label">Phishing</span>
                  <div className="example-card__meta">
                    <strong>{comparison.fake.from}</strong>
                    <p>{comparison.fake.subject}</p>
                  </div>
                  <ul>
                    {comparison.fake.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
