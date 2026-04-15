import type { Address } from "viem";
import { Link } from "react-router-dom";

interface Props {
  address: Address | null;
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
}

export function HomePage({ address, connecting, error, onConnect }: Props) {
  return (
    <section className="landing-screen" aria-label="X402 Operator landing">
      <div className="hero-stage">
        <div className="hero-stack">
          <p className="hero-pill">Build X Hackathon · X Layer Arena</p>
          <h1 className="display-text hero-title">
            The execution rail for agents on X Layer.
          </h1>
          <p className="hero-text">
            Owners keep custody in policy-bound vaults, controllers sign exact intents,
            operators monetize execution via x402, and every successful swap leaves an
            onchain receipt.
          </p>

          <div className="hero-actions">
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

            <Link to="/docs" className="btn btn-ghost hero-cta hero-docs">
              Documentation
            </Link>
          </div>

          {error ? <p className="error hero-inline-error">{error}</p> : null}
        </div>
      </div>

    </section>
  );
}
