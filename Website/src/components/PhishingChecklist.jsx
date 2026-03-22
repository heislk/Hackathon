const CHECKLIST = [
  {
    title: "Pause before you tap",
    description: "If a message pressures you to act in minutes, that pressure is usually the scam.",
  },
  {
    title: "Check the real sender",
    description: "Look at the full email domain, not just the display name or logo.",
  },
  {
    title: "Never trust contact details inside the message",
    description: "Open the exchange app or official website yourself to verify support numbers and links.",
  },
  {
    title: "Assume passwords, seed phrases, and 2FA codes are never requested",
    description: "If a message asks for them, treat it as hostile immediately.",
  },
  {
    title: "Cross-check the claim in your account",
    description: "If the email says your account is locked or funds are moving, confirm it inside the real platform.",
  },
  {
    title: "Forward suspicious messages for a second opinion",
    description: "Use the Risk Scan flow or your intake mailbox instead of guessing alone.",
  },
];

export default function PhishingChecklist() {
  return (
    <section className="phishing-checklist" id="phishing-checklist">
      <div className="phishing-checklist__container">
        <div className="phishing-checklist__intro">
          <h2>A simple checklist people can actually remember.</h2>
          <p>
            Most phishing attacks work because they create stress and confusion. This checklist is
            built to slow people down and give them a repeatable routine before they click.
          </p>
        </div>

        <div className="phishing-checklist__grid">
          {CHECKLIST.map((item, index) => (
            <article key={item.title} className="phishing-checklist__card">
              <span className="phishing-checklist__number">{String(index + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
