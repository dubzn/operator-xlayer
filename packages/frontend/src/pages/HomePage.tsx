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
          <p className="hero-pill">Build X Hackathon</p>
          <h1 className="display-text hero-title">
            Delegated execution without surrendering custody.
          </h1>
          <p className="hero-text">
            Agents request swaps. Vaults enforce policy. Operators get paid per job.
          </p>

          <div className="hero-actions">
            {address ? (
              <Link to="/vaults" className="btn btn-primary btn-xl hero-cta">
                Open Vaults
              </Link>
            ) : (
              <button onClick={onConnect} className="btn btn-primary btn-xl hero-cta">
                {connecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}

            <Link to="/docs" className="btn btn-ghost btn-xl hero-cta hero-docs">
              Documentation
            </Link>
          </div>

          {error ? <p className="error hero-inline-error">{error}</p> : null}
        </div>
      </div>

      <footer className="landing-footer">
        <span>Policy-enforced execution</span>
        <span>x402 metering</span>
        <span>Onchain receipts</span>
      </footer>
    </section>
  );
}
