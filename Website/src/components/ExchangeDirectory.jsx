const EXCHANGES = [
  {
    name: "Coinbase",
    websites: "coinbase.com, help.coinbase.com",
    emails: "coinbase.com only",
    phone: "Does not offer random inbound support calls for account recovery",
    lookFor: "Security emails direct you back into the app or official site",
    never: "Seed phrase requests, remote desktop help, or wallet recovery over email",
  },
  {
    name: "Binance",
    websites: "binance.com",
    emails: "binance.com only",
    phone: "Be cautious with caller ID claims; verify inside the app",
    lookFor: "Withdrawal alerts should match your real account context",
    never: "Requests for 2FA codes, passwords, or wallet access through email/SMS",
  },
  {
    name: "Kraken",
    websites: "kraken.com, support.kraken.com",
    emails: "email.kraken.com, kraken.com",
    phone: "Support should be verified through the help center, not random callbacks",
    lookFor: "Clear case references and guidance to log in normally",
    never: "Private key or seed phrase collection",
  },
  {
    name: "Gemini",
    websites: "gemini.com",
    emails: "gemini.com only",
    phone: "Unexpected recovery calls should be treated as suspicious",
    lookFor: "Messages should align with activity visible in your account",
    never: "Requests to install remote-access software or move funds for safety",
  },
  {
    name: "Cash App / Block",
    websites: "cash.app",
    emails: "cash.app or square.com domains",
    phone: "Many scams impersonate support by phone and text",
    lookFor: "Support flows start in the app, not from a cold caller",
    never: "Requests for PINs, one-time codes, or Bitcoin transfers to 'secure' funds",
  },
];

export default function ExchangeDirectory() {
  return (
    <section className="exchange-directory" id="exchange-directory">
      <div className="exchange-directory__container">
        <div className="exchange-directory__header">
          <h2>A quick reference table for real exchange communication.</h2>
          <p>
            When people panic, they need a trusted reference fast. This table gives them the
            official domains, common contact patterns, and the specific things real exchanges do
            not ask for.
          </p>
        </div>

        <div className="exchange-directory__table-wrap">
          <table className="exchange-directory__table">
            <thead>
              <tr>
                <th>Exchange</th>
                <th>Official websites</th>
                <th>Real email pattern</th>
                <th>Phone / contact warning</th>
                <th>What to look for</th>
                <th>Red-line rule</th>
              </tr>
            </thead>
            <tbody>
              {EXCHANGES.map((exchange) => (
                <tr key={exchange.name}>
                  <td data-label="Exchange">{exchange.name}</td>
                  <td data-label="Official websites">{exchange.websites}</td>
                  <td data-label="Real email pattern">{exchange.emails}</td>
                  <td data-label="Phone / contact warning">{exchange.phone}</td>
                  <td data-label="What to look for">{exchange.lookFor}</td>
                  <td data-label="Red-line rule">{exchange.never}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
