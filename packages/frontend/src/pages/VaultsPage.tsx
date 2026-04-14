import { useRef } from "react";
import type { Address, PublicClient } from "viem";
import { Link } from "react-router-dom";
import { useOwnedVaults } from "../hooks/useOwnedVaults";
import { VaultPreviewCard } from "../components/VaultPreviewCard";

interface Props {
  publicClient: PublicClient;
  address: Address;
}

export function VaultsPage({ publicClient, address }: Props) {
  const { vaults, loading, error } = useOwnedVaults(publicClient, address);
  const railRef = useRef<HTMLDivElement>(null);

  const scrollRail = (direction: -1 | 1) => {
    if (!railRef.current) return;

    railRef.current.scrollBy({
      left: railRef.current.clientWidth * 0.82 * direction,
      behavior: "smooth",
    });
  };

  return (
    <section className="vaults-page">
      <div className="page-intro-centered">
        <h1 className="display-text">Your vaults</h1>
        <p className="muted-copy">Open a vault or spin up a new shell.</p>
      </div>

      {error ? (
        <section className="empty-state liquid-panel">
          <h2 className="display-text">Unable to load your workspace</h2>
          <p className="muted-copy">{error}</p>
        </section>
      ) : null}

      {!error && loading && vaults.length === 0 ? (
        <section className="vault-carousel liquid-panel liquid-panel-soft">
          <div className="vault-carousel-header">
            <div>
              <h2 className="display-text">Syncing vaults</h2>
              <p className="muted-copy">Pulling your workspace from chain.</p>
            </div>
            <span className="selector-count">Loading</span>
          </div>

          <div className="vault-carousel-rail">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="vault-card vault-card-skeleton glass-card" aria-hidden="true">
                <div className="vault-card-top">
                  <div className="skeleton-line skeleton-line-title" />
                  <div className="skeleton-pill" />
                </div>

                <div className="vault-card-main">
                  <div className="skeleton-line skeleton-line-label" />
                  <div className="skeleton-line skeleton-line-value" />
                </div>

                <div className="vault-card-meta">
                  <div className="vault-card-stat skeleton-stat">
                    <div className="skeleton-line skeleton-line-label" />
                    <div className="skeleton-line skeleton-line-short" />
                  </div>
                  <div className="vault-card-stat skeleton-stat">
                    <div className="skeleton-line skeleton-line-label" />
                    <div className="skeleton-line skeleton-line-short" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!error && !loading && vaults.length === 0 ? (
        <section className="empty-state liquid-panel">
          <h2 className="display-text">No vaults found for this wallet yet</h2>
          <p className="muted-copy">
            Create your first vault to start tracking balances, policy controls, and execution
            history from one workspace.
          </p>
          <Link to="/vaults/new" className="btn btn-primary btn-wide btn-callout">
            Create Vault
          </Link>
        </section>
      ) : null}

      {vaults.length > 0 ? (
        <section className="vault-carousel liquid-panel liquid-panel-soft">
          <div className="vault-carousel-top">
            <Link to="/vaults/new" className="btn btn-primary btn-callout">
              New Vault
            </Link>
            <span className="selector-count">{vaults.length} tracked</span>
          </div>

          <div ref={railRef} className="vault-carousel-rail">
            {vaults.map((vault) => (
              <VaultPreviewCard key={vault} vault={vault} publicClient={publicClient} />
            ))}
          </div>

          <div className="vault-carousel-bottom">
            <div className="vault-carousel-controls">
              <button
                type="button"
                className="vault-carousel-button"
                onClick={() => scrollRail(-1)}
                aria-label="Scroll vaults left"
              >
                ←
              </button>
              <button
                type="button"
                className="vault-carousel-button"
                onClick={() => scrollRail(1)}
                aria-label="Scroll vaults right"
              >
                →
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
