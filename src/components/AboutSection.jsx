import "../styles/about-section.css";

export default function AboutSection() {
  return (
    <section className="about-section" id="about">
      <div className="about-section__eyebrow">About us</div>
      <div className="about-section__grid">
        <div className="about-section__intro">
          <h2>We help crypto holders verify risk before they lose funds.</h2>
          <p>
            CryptoSecure is a security review tool for people who already hold
            crypto and need a fast second opinion before they click, sign, or
            send. We are not a trading app or a generic chatbot. We inspect the
            evidence around a transaction or message and return a clear risk
            assessment with next steps.
          </p>
        </div>

        <div className="about-section__cards">
          <article className="about-section__card">
            <span className="about-section__card-kicker">You upload</span>
            <p>
              Screenshots of DMs, wallet addresses, transaction hashes, smart
              contract links, and suspicious URLs.
            </p>
          </article>
          <article className="about-section__card">
            <span className="about-section__card-kicker">We analyze</span>
            <p>
              Scam language, wallet behavior, token approvals, contract
              patterns, and signs of urgency, impersonation, or phishing.
            </p>
          </article>
          <article className="about-section__card about-section__card--accent">
            <span className="about-section__card-kicker">You receive</span>
            <p>
              A risk score, the exact red flags we found, and a plain-English
              report that tells you whether to proceed, pause, or block.
            </p>
          </article>
        </div>
      </div>

      <div className="about-section__note">
        Built for people who want a clean answer before a bad click becomes a
        permanent loss.
      </div>
    </section>
  );
}
