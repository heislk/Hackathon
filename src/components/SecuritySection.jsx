import "../styles/security-section.css";

export default function SecuritySection() {
  return (
    <section className="security-section" aria-labelledby="security-section-title" id="security">
      <div className="security-section__inner">
        <div className="security-section__header">
          <p className="security-section__eyebrow">Security and privacy</p>
          <h2 id="security-section-title">Built so sensitive data stays controlled from upload to report.</h2>
          <p className="security-section__lead">
            We encrypt data in transit and at rest, keep analysis inside our own environment,
            and use an internal AI workflow that we operate directly. No outside handling,
            no loose routing, and no unclear third-party processing.
          </p>
        </div>

        <div className="security-section__grid">
          <article className="security-card">
            <div className="security-card__index">01</div>
            <h3>Encrypted by default</h3>
            <p>
              Files and metadata move through encrypted channels and stay protected once they
              reach our system, so the data is not exposed in plain text during transport or storage.
            </p>
          </article>

          <article className="security-card">
            <div className="security-card__index">02</div>
            <h3>In-house analysis only</h3>
            <p>
              Processing happens inside our own environment. We do not hand submissions off to
              a scattered chain of external analysts or public tools.
            </p>
          </article>

          <article className="security-card">
            <div className="security-card__index">03</div>
            <h3>Owned AI stack</h3>
            <p>
              Our AI is operated by us, tuned for this use case, and used as part of a controlled
              workflow that keeps the review path predictable.
            </p>
          </article>

          <article className="security-card">
            <div className="security-card__index">04</div>
            <h3>Controlled outputs</h3>
            <p>
              Reports are generated from the internal analysis pipeline, so only the results you
              need are surfaced and unnecessary exposure is reduced.
            </p>
          </article>
        </div>

        <div className="security-section__workflow">
          <span>Upload</span>
          <span className="security-section__dot" />
          <span>Encrypt</span>
          <span className="security-section__dot" />
          <span>Analyze in-house</span>
          <span className="security-section__dot" />
          <span>Deliver report</span>
        </div>
      </div>
    </section>
  );
}
