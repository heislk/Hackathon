const CHAINS = [
  {
    name: "Ethereum",
    svg: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#627EEA"/>
        <path d="M16.498 4v8.87l7.497 3.35L16.498 4z" fill="#fff" fillOpacity=".602"/>
        <path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff"/>
        <path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#fff" fillOpacity=".602"/>
        <path d="M16.498 27.995v-6.028L9 17.616l7.498 10.379z" fill="#fff"/>
        <path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#fff" fillOpacity=".2"/>
        <path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#fff" fillOpacity=".602"/>
      </svg>
    ),
  },
  {
    name: "Bitcoin",
    svg: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#F7931A"/>
        <path d="M22.5 13.6c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.6-.4-.65 2.6c-.42-.1-.86-.2-1.3-.32l.66-2.63-1.6-.4-.68 2.72c-.35-.08-.7-.16-1.03-.24l-2.2-.56-.44 1.73s1.2.27 1.17.29c.65.16.77.6.75.94l-.75 3.03c.04.01.1.03.17.06l-.18-.04-1.06 4.24c-.08.2-.28.49-.73.38.02.02-1.17-.3-1.17-.3l-.8 1.85 2.08.52c.39.1.77.2 1.14.3l-.7 2.78 1.6.4.68-2.73c.44.12.87.23 1.28.33l-.67 2.7 1.6.4.69-2.77c2.84.54 4.98.32 5.88-2.25.72-2.07-.04-3.27-1.53-4.04 1.09-.25 1.91-0.97 2.13-2.45zm-3.81 5.35c-.51 2.07-3.99.95-5.12.67l.91-3.67c1.13.28 4.75.84 4.21 3zm.52-5.38c-.47 1.88-3.36.93-4.3.69l.83-3.33c.94.24 3.97.68 3.47 2.64z" fill="#fff"/>
      </svg>
    ),
  },
  {
    name: "Solana",
    svg: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#000"/>
        <defs><linearGradient id="sol" x1="7" y1="24.5" x2="25" y2="7.5"><stop stopColor="#9945FF"/><stop offset=".5" stopColor="#14F195"/><stop offset="1" stopColor="#00D1FF"/></linearGradient></defs>
        <path d="M9.2 20.1a.47.47 0 01.33-.14h14.9a.23.23 0 01.17.4l-2.87 2.87a.47.47 0 01-.33.14H6.5a.23.23 0 01-.17-.4l2.87-2.87z" fill="url(#sol)"/>
        <path d="M9.2 8.77a.48.48 0 01.33-.14h14.9a.23.23 0 01.17.4l-2.87 2.87a.47.47 0 01-.33.14H6.5a.23.23 0 01-.17-.4l2.87-2.87z" fill="url(#sol)"/>
        <path d="M22.6 14.4a.47.47 0 00-.33-.14H7.37a.23.23 0 00-.17.4l2.87 2.87c.09.09.2.14.33.14h14.9a.23.23 0 00.17-.4L22.6 14.4z" fill="url(#sol)"/>
      </svg>
    ),
  },
  {
    name: "Polygon",
    svg: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#8247E5"/>
        <path d="M21.1 12.6c-.4-.2-.9-.2-1.2 0l-2.9 1.7-2 1.1-2.9 1.7c-.4.2-.9.2-1.2 0l-2.3-1.3c-.4-.2-.6-.6-.6-1.1v-2.6c0-.4.2-.9.6-1.1l2.2-1.3c.4-.2.9-.2 1.2 0l2.2 1.3c.4.2.6.6.6 1.1v1.7l2-1.1v-1.7c0-.4-.2-.9-.6-1.1l-4.1-2.4c-.4-.2-.9-.2-1.2 0l-4.2 2.4c-.4.2-.6.6-.6 1.1v4.8c0 .4.2.9.6 1.1l4.2 2.4c.4.2.9.2 1.2 0l2.9-1.7 2-1.1 2.9-1.7c.4-.2.9-.2 1.2 0l2.2 1.3c.4.2.6.6.6 1.1v2.6c0 .4-.2.9-.6 1.1l-2.2 1.3c-.4.2-.9.2-1.2 0l-2.2-1.3c-.4-.2-.6-.6-.6-1.1v-1.7l-2 1.1v1.7c0 .4.2.9.6 1.1l4.2 2.4c.4.2.9.2 1.2 0l4.2-2.4c.4-.2.6-.6.6-1.1v-4.8c0-.4-.2-.9-.6-1.1l-4.3-2.4z" fill="#fff"/>
      </svg>
    ),
  },
  {
    name: "Arbitrum",
    svg: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#2D374B"/>
        <path d="M17.3 10.5l4.4 7.2-2.5 1.5-4.4-7.2 2.5-1.5z" fill="#28A0F0"/>
        <path d="M21.7 17.7l1.7 2.8-2.5 1.5-1.7-2.8 2.5-1.5z" fill="#28A0F0"/>
        <path d="M10.3 21.5l2.5 1.5 4.4-7.2-2.5-1.5-4.4 7.2z" fill="#fff"/>
        <path d="M12.8 23l-1.7-2.8-2.5 1.5 1.7 2.8L12.8 23z" fill="#fff"/>
      </svg>
    ),
  },
  {
    name: "Avalanche",
    svg: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#E84142"/>
        <path d="M20.3 21h3.2c.5 0 .8-.3.8-.6 0-.1-.04-.3-.1-.4l-7.3-12.9c-.2-.3-.5-.5-.9-.5s-.7.2-.9.5L13.6 10l2.5 4.4 4.2 6.6z" fill="#fff"/>
        <path d="M12.1 21h-3.6c-.5 0-.8-.3-.8-.6 0-.1.04-.3.1-.4l1.8-3.2c.2-.3.5-.5.9-.5s.7.2.9.5l1.8 3.2c.07.1.1.3.1.4 0 .3-.3.6-.8.6h-.4z" fill="#fff"/>
      </svg>
    ),
  },
  {
    name: "BNB Chain",
    svg: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#F3BA2F"/>
        <path d="M16 8l2.5 2.5L16 13l-2.5-2.5L16 8zm-5 5l2.5 2.5L11 18l-2.5-2.5L11 13zm10 0l2.5 2.5L21 18l-2.5-2.5L23.5 13zM16 18l2.5 2.5L16 23l-2.5-2.5L16 18z" fill="#fff"/>
      </svg>
    ),
  },
  {
    name: "Optimism",
    svg: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#FF0420"/>
        <path d="M11.4 20.3c-1.2 0-2.2-.3-2.9-1-.7-.7-1-1.6-1-2.8 0-1.5.4-2.7 1.3-3.7.9-1 2-1.5 3.4-1.5 1.2 0 2.1.3 2.8 1 .7.7 1 1.6 1 2.7 0 1.5-.4 2.8-1.3 3.8-.9 1-2 1.5-3.3 1.5zm.3-2c.6 0 1-.3 1.4-.8.4-.6.5-1.3.5-2.2 0-.6-.1-1.1-.4-1.4-.3-.3-.6-.5-1.1-.5-.6 0-1.1.3-1.5.8-.4.5-.6 1.3-.6 2.2 0 .6.1 1.1.4 1.4.3.4.7.5 1.3.5zm8.3 1.8h-2.5l1.8-8.6h3.5c1 0 1.8.2 2.3.7.5.5.7 1.1.7 1.9 0 1-.3 1.9-1 2.5-.7.7-1.6 1-2.8 1h-1.3l-.7 2.5zm1.6-4.3h.8c.5 0 .9-.1 1.2-.4.3-.3.5-.6.5-1 0-.3-.1-.5-.3-.7-.2-.2-.5-.3-.9-.3h-.8l-.5 2.4z" fill="#fff"/>
      </svg>
    ),
  },
  {
    name: "Base",
    svg: (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#0052FF"/>
        <path d="M15.9 26c5.5 0 10-4.5 10-10s-4.5-10-10-10C10.7 6 6.4 10 6 15h12.5v2H6c.4 5 4.7 9 9.9 9z" fill="#fff"/>
      </svg>
    ),
  },
];
export default function ChainLogos() {
  return (
    <section className="chains" id="chains">
      <div className="chains__container">
        <span className="section-eyebrow">
          <span className="section-eyebrow__dot" />
          Multi-Chain Coverage
        </span>
        <h2>Protecting assets across every major blockchain.</h2>
        <p className="chains__subtitle">
          Our analysis engines monitor transactions, smart contracts, and wallet behavior
          across {CHAINS.length} supported networks — and growing.
        </p>
        <div className="chains__grid">
          {CHAINS.map((chain, i) => (
            <div
              className="chain-card"
              key={chain.name}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="chain-card__icon">{chain.svg}</div>
              <span className="chain-card__name">{chain.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}