import type { Address } from "viem";
import { Link } from "react-router-dom";

interface Props {
  address: Address | null;
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
}

const DOC_SECTIONS = [
  {
    title: "Execution flow",
    description: "Preview, sign, pay through x402, and execute within vault policy boundaries.",
  },
  {
    title: "Vault policy model",
    description: "Per-trade caps, cooldowns, slippage, and token allowlists stay onchain.",
  },
  {
    title: "Integration notes",
    description: "Operator, controller, and receipts concepts will move into this in-app docs hub.",
  },
];

export function DocsPage({ address, connecting, error, onConnect }: Props) {
  return (
    <section className="docs-page">
      <section className="docs-hero liquid-panel liquid-panel-soft">
        <div className="docs-hero-copy">
          <p className="hero-pill">Documentation</p>
          <h1 className="display-text docs-title">Docs are moving into the app.</h1>
          <p className="hero-text">
            This placeholder page will evolve into the in-product reference for vault flows,
            policies, and x402-backed execution.
          </p>
        </div>

        <div className="hero-actions docs-actions">
          {address ? (
            <Link to="/vaults" className="btn btn-primary btn-xl hero-cta">
              Open Vaults
            </Link>
          ) : (
            <button onClick={onConnect} className="btn btn-primary btn-xl hero-cta">
              {connecting ? (
                "Connecting..."
              ) : (
                <>
                  <img src="/logos/metamask.png" alt="" className="btn-wallet-logo" />
                  Connect with MetaMask
                </>
              )}
            </button>
          )}
          <Link to="/home" className="btn btn-ghost btn-xl hero-cta">
            Back Home
          </Link>
        </div>

        {error ? <p className="error hero-inline-error">{error}</p> : null}
      </section>

      <section className="docs-grid">
        {DOC_SECTIONS.map((section) => (
          <article key={section.title} className="docs-card liquid-panel">
            <p className="eyebrow">Coming soon</p>
            <h2 className="display-text docs-card-title">{section.title}</h2>
            <p className="muted-copy">{section.description}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
