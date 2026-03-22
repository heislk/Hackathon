import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import PhishingExamples from "../components/PhishingExamples.jsx";
import PhishingChecklist from "../components/PhishingChecklist.jsx";
import ExchangeDirectory from "../components/ExchangeDirectory.jsx";
import "../styles/styles.css";

const WIKI_SECTIONS = [
  { href: "#phishing-examples", label: "Legit vs Fake" },
  { href: "#phishing-checklist", label: "Checklist" },
  { href: "#phishing-anatomy", label: "How To Read A Scam" },
  { href: "#scam-playbooks", label: "Scam Playbooks" },
  { href: "#channel-red-flags", label: "Channel Rules" },
  { href: "#exchange-directory", label: "Exchange Directory" },
  { href: "#response-plan", label: "What To Do Next" },
  { href: "#wiki-faq", label: "FAQ" },
];

const SCAM_ANATOMY = [
  {
    title: "1. Identity layer",
    body: "Attackers borrow a trusted brand first: the logo, the colors, the display name, or a support persona. This is meant to shut down skepticism before you check the real sender.",
    check: "Check the exact sender domain, profile handle, and whether the message arrived through an official channel.",
  },
  {
    title: "2. Pressure layer",
    body: "Most phishing tries to compress your decision window. If they can make you feel late, locked out, or in danger, they can bypass your normal habits.",
    check: "Treat countdown timers, account freezes, and urgent withdrawal warnings as signals to slow down, not speed up.",
  },
  {
    title: "3. Action layer",
    body: "The attacker always wants one specific action: click a link, log in, approve a wallet prompt, send a code, or call a fake support number.",
    check: "Ask what the message is trying to get from you. If it wants credentials, approvals, or codes, assume risk until proven otherwise.",
  },
  {
    title: "4. Escape layer",
    body: "Good scams try to keep you inside the fake environment. They discourage you from opening the real app, visiting the official site, or contacting support through verified channels.",
    check: "Break the flow. Leave the message, open the official product directly, and verify the claim there.",
  },
];

const PLAYBOOKS = [
  {
    title: "Account lockout scam",
    summary: "A fake security email says your exchange account is frozen unless you verify immediately.",
    signals: [
      "Threatens suspension or liquidation on a short timer",
      "Pushes you to log in from a link in the message",
      "Uses a support domain that is close to, but not exactly, the real brand",
    ],
    defense: "Ignore the link and open the exchange app or official website yourself to check the alert.",
  },
  {
    title: "Fake support recovery",
    summary: "A caller, email, or DM claims they can reverse a transfer or recover a hacked wallet for you.",
    signals: [
      "Asks for seed phrases, one-time codes, screenshots, or remote access",
      "Claims they need to move funds to a 'safe wallet'",
      "Creates urgency by saying the attacker is active right now",
    ],
    defense: "Real support does not need your seed phrase or remote access. End contact and verify through official channels.",
  },
  {
    title: "Withdrawal cancellation trap",
    summary: "A text or email says a large withdrawal was started and you must click a link to cancel it.",
    signals: [
      "Message includes a panicky 'cancel now' button",
      "The destination domain is not the official exchange domain",
      "It tries to capture your password and 2FA code in one step",
    ],
    defense: "Do not cancel through the message. Sign in directly to your real account and review activity there.",
  },
  {
    title: "Wallet connection / approval scam",
    summary: "A fake mint, airdrop, or staking page asks you to connect your wallet and confirm a harmless-looking action.",
    signals: [
      "The site is new, unverified, or heavily pushed through social replies",
      "The wallet prompt hides approvals or suspicious contract calls",
      "The copy promises free rewards with almost no context",
    ],
    defense: "Treat every wallet prompt as a transaction review. Verify the site, contract, and approval scope before signing.",
  },
];

const CHANNEL_RULES = [
  {
    channel: "Email",
    trust: "Display names do not matter. Domains and link destinations do.",
    flags: "Lookalike domains, urgent action, authentication failures, reply-to mismatch.",
    never: "Never enter a password, seed phrase, or 2FA code from an email link.",
  },
  {
    channel: "SMS / iMessage",
    trust: "Phone threads can be spoofed, even when they appear in the same thread as past real messages.",
    flags: "Short deadlines, fake withdrawal alerts, shortened links, unfamiliar support numbers.",
    never: "Never trust a support link in a text without checking the app or official site yourself.",
  },
  {
    channel: "Phone call",
    trust: "Caller ID is not proof of identity.",
    flags: "Anyone asking you to install software, share codes, or move funds for safety.",
    never: "Never say seed phrases aloud or allow screen-share / remote desktop for wallet help.",
  },
  {
    channel: "Discord / Telegram / X",
    trust: "Most impersonation happens in replies, cloned profiles, and fake staff DMs.",
    flags: "Instant support offers, private DMs after posting for help, copycat usernames.",
    never: "Never continue support in DMs if the official project says support does not DM first.",
  },
];

const RESPONSE_STEPS = [
  {
    title: "If you only clicked",
    body: "Close the page, do not connect your wallet, and run a scan on the link or message before doing anything else.",
  },
  {
    title: "If you entered credentials",
    body: "Change the password from the official site, rotate 2FA, sign out other sessions, and review withdrawal / API settings immediately.",
  },
  {
    title: "If you shared a code or seed phrase",
    body: "Assume compromise. Move assets to a fresh wallet or account from a trusted device as quickly as possible.",
  },
  {
    title: "If you signed a wallet prompt",
    body: "Revoke token approvals, review recent signatures, and move assets if the transaction or approval looks unsafe.",
  },
];

const FAQS = [
  {
    question: "What do real exchanges almost never ask for?",
    answer:
      "Seed phrases, private keys, one-time authentication codes over email, or remote desktop access. Those requests should be treated as hostile.",
  },
  {
    question: "Can a real support phone number still be fake?",
    answer:
      "Yes. Caller ID and SMS threads can be spoofed. The safest move is to open the app or official help center yourself and initiate contact there.",
  },
  {
    question: "Is a message safe if the logo and formatting look real?",
    answer:
      "No. Branding is the easiest thing for attackers to copy. The sender domain, link destination, and request being made matter more than the look.",
  },
  {
    question: "What should I check before connecting a wallet?",
    answer:
      "Check the exact domain, whether the contract is known and verified, what approval or signature is being requested, and whether the offer makes sense.",
  },
];

export default function WikiPage() {
  return (
    <div className="page-shell">
      <Navbar />
      <main>
        <section className="wiki-hero">
          <div className="wiki-hero__container">
            <h1>Learn the patterns before attackers get the click.</h1>
            <p>
              This reference page is built for people who need quick answers in the moment:
              what real exchange communication looks like, what phishing messages have in common,
              and which red flags should stop you immediately.
            </p>
            <div className="wiki-hero__quickstart" aria-label="Quick start anti-scam rules">
              <article className="wiki-hero__quickstart-card">
                <strong>Check the sender and link</strong>
                <p>Ignore logos first. Look at the exact domain, handle, and destination.</p>
              </article>
              <article className="wiki-hero__quickstart-card">
                <strong>Never share recovery secrets</strong>
                <p>Seed phrases, 2FA codes, and remote access requests should stop you immediately.</p>
              </article>
              <article className="wiki-hero__quickstart-card">
                <strong>Verify in the real app</strong>
                <p>Leave the message and confirm alerts through the official website or app yourself.</p>
              </article>
            </div>
            <div className="wiki-hero__chips">
              <span>Legit vs fake examples</span>
              <span>Exchange reference table</span>
              <span>Support-contact cautions</span>
              <span>Phishing checklist</span>
            </div>
          </div>
        </section>

        <section className="wiki-nav" aria-label="Wiki navigation">
          <div className="wiki-nav__container">
            {WIKI_SECTIONS.map((section) => (
              <a key={section.href} href={section.href}>
                {section.label}
              </a>
            ))}
          </div>
        </section>

        <PhishingExamples />
        <PhishingChecklist />

        <section className="wiki-anatomy" id="phishing-anatomy">
          <div className="wiki-anatomy__container">
            <div className="wiki-anatomy__header">
              <span className="section-eyebrow">
                <span className="section-eyebrow__dot" />
                How To Read A Scam
              </span>
              <h2>Almost every phishing message follows the same four-part structure.</h2>
              <p>
                When people know what part of the scam they are looking at, they stop reacting to
                the branding and start noticing the mechanics underneath it.
              </p>
            </div>
            <div className="wiki-anatomy__grid">
              {SCAM_ANATOMY.map((item) => (
                <article key={item.title} className="wiki-anatomy__card">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <div className="wiki-anatomy__check">
                    <span>Quick check</span>
                    <p>{item.check}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="wiki-playbooks" id="scam-playbooks">
          <div className="wiki-playbooks__container">
            <div className="wiki-playbooks__header">
              <h2>The most common scam stories attackers keep reusing.</h2>
              <p>
                Most scams are variations of the same few scripts. If you recognize the script,
                you can break the attack before the attacker gets what they want.
              </p>
            </div>
            <div className="wiki-playbooks__grid">
              {PLAYBOOKS.map((playbook) => (
                <article key={playbook.title} className="wiki-playbook">
                  <h3>{playbook.title}</h3>
                  <p className="wiki-playbook__summary">{playbook.summary}</p>
                  <strong>Common signals</strong>
                  <ul>
                    {playbook.signals.map((signal) => (
                      <li key={signal}>{signal}</li>
                    ))}
                  </ul>
                  <div className="wiki-playbook__defense">
                    <span>What to do</span>
                    <p>{playbook.defense}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="wiki-channels" id="channel-red-flags">
          <div className="wiki-channels__container">
            <div className="wiki-channels__header">
              <h2>What to trust, and what not to trust, by channel.</h2>
              <p>
                Phishing changes shape depending on where it reaches you. These rules help people
                stop treating every email, text, call, or DM the same way.
              </p>
            </div>
            <div className="wiki-channels__grid">
              {CHANNEL_RULES.map((rule) => (
                <article key={rule.channel} className="wiki-channel-card">
                  <span className="wiki-channel-card__label">{rule.channel}</span>
                  <div>
                    <strong>What to trust</strong>
                    <p>{rule.trust}</p>
                  </div>
                  <div>
                    <strong>Watch for</strong>
                    <p>{rule.flags}</p>
                  </div>
                  <div>
                    <strong>Hard rule</strong>
                    <p>{rule.never}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <ExchangeDirectory />

        <section className="wiki-response" id="response-plan">
          <div className="wiki-response__container">
            <div className="wiki-response__header">
              <h2>What to do if you already interacted with the scam.</h2>
              <p>
                People often reach a guide after they have already clicked. This section is here so
                the wiki stays useful even after the mistake.
              </p>
            </div>
            <div className="wiki-response__grid">
              {RESPONSE_STEPS.map((step, index) => (
                <article key={step.title} className="wiki-response__card">
                  <span className="wiki-response__number">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="wiki-faq" id="wiki-faq">
          <div className="wiki-faq__container">
            <div className="wiki-faq__header">
              <h2>Short answers to the questions people panic-search first.</h2>
            </div>
            <div className="wiki-faq__list">
              {FAQS.map((item) => (
                <details key={item.question} className="wiki-faq__item">
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
