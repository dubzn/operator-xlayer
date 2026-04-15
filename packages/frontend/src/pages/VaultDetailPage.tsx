import type { Address, PublicClient, WalletClient } from "viem";
import { getAddress, isAddress } from "viem";
import { Link, useParams } from "react-router-dom";
import { VaultDashboard } from "../components/VaultDashboard";
import { useOwnedVaults } from "../hooks/useOwnedVaults";
import { useVaultData } from "../hooks/useVaultData";
import { useVaultHistory } from "../hooks/useVaultHistory";
import { shortAddr, deriveVaultName } from "../utils/vaults";

interface Props {
  walletClient: WalletClient | null;
  publicClient: PublicClient;
  address: Address | null;
}

export function VaultDetailPage({ walletClient, publicClient, address }: Props) {
  const { vaultId } = useParams();
  const parsedVault = vaultId && isAddress(vaultId) ? (getAddress(vaultId) as Address) : null;
  const { vaults, loading: ownedVaultsLoading } = useOwnedVaults(publicClient, address);
  const ownedVault =
    parsedVault && vaults.some((vault) => vault.toLowerCase() === parsedVault.toLowerCase())
      ? parsedVault
      : null;

  const { data, loading, error, refresh } = useVaultData(publicClient, ownedVault);
  const { events, loading: historyLoading } = useVaultHistory(ownedVault);

  const isOwner =
    data && address ? data.owner.toLowerCase() === address.toLowerCase() : false;

  if (!parsedVault) {
    return (
      <section className="empty-state liquid-panel">
        <p className="eyebrow">Vault detail</p>
        <h2 className="display-text">That vault route is not valid</h2>
        <p className="muted-copy">
          Vault detail pages expect a full vault address in the route, for example
          ` /vaults/0x... `.
        </p>
        <Link to="/vaults" className="btn btn-ghost btn-wide">
          Back to Vaults
        </Link>
      </section>
    );
  }

  const showSkeleton = ownedVaultsLoading || (Boolean(ownedVault) && loading && !data);

  return (
    <section className="vault-detail-page">
      {data ? (
        <div className="page-intro-centered">
          <h1 className="display-text">{deriveVaultName(data.baseToken)}</h1>
          <p className="muted-copy">{shortAddr(ownedVault!)}</p>
        </div>
      ) : null}

      {showSkeleton ? (
        <div className="vault-scene" aria-hidden="true">
          <div className="vault-panel-skel" style={{ gridArea: "summary" }}>
            <div className="skeleton-line skeleton-line-title" />
            <div className="vault-summary-main">
              <div className="skeleton-line skeleton-line-label" />
              <div className="skeleton-line skeleton-line-value" />
              <div className="skeleton-pill" style={{ marginTop: 4 }} />
            </div>
            <div className="skel-stat-row">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-stat">
                  <div className="skeleton-line skeleton-line-label" />
                  <div className="skeleton-line skeleton-line-short" />
                </div>
              ))}
            </div>
          </div>

          <div className="vault-panel-skel" style={{ gridArea: "primary" }}>
            <div className="skel-tab-row">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-pill skel-tab-pill" />
              ))}
            </div>
            <div className="skel-chart" />
          </div>

          <div className="vault-panel-skel" style={{ gridArea: "tokens" }}>
            <div className="skeleton-line skeleton-line-label" />
            <div className="skeleton-line skeleton-line-title" style={{ width: "50%" }} />
            {[0, 1].map((i) => (
              <div key={i} className="skel-entry">
                <div className="skeleton-pill skel-pill-sm" />
                <div className="skeleton-line skeleton-line-short skel-entry-line" />
              </div>
            ))}
          </div>

          <div className="vault-panel-skel" style={{ gridArea: "history" }}>
            <div className="skeleton-line skeleton-line-label" />
            <div className="skeleton-line skeleton-line-title" style={{ width: "55%" }} />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skel-entry">
                <div className="skeleton-pill skel-icon-box" />
                <div className="skel-entry-copy">
                  <div className="skeleton-line skeleton-line-label" />
                  <div className="skeleton-line skeleton-line-short" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!ownedVaultsLoading && !ownedVault ? (
        <section className="empty-state liquid-panel">
          <p className="eyebrow">Vault detail</p>
          <h2 className="display-text">Vault not found in your workspace</h2>
          <p className="muted-copy">
            {shortAddr(parsedVault)} is not part of the vaults returned for this connected wallet.
          </p>
          <Link to="/vaults" className="btn btn-ghost btn-wide">
            Back to Vaults
          </Link>
        </section>
      ) : null}

      {ownedVault && !loading && !data ? (
        <section className="empty-state liquid-panel">
          <p className="eyebrow">Vault detail</p>
          <h2 className="display-text">Unable to load this vault</h2>
          <p className="muted-copy">{error ?? "The vault could not be read from the chain."}</p>
          <Link to="/vaults" className="btn btn-ghost btn-wide">
            Back to Vaults
          </Link>
        </section>
      ) : null}

      {data ? (
        <VaultDashboard
          vault={ownedVault!}
          data={data}
          isOwner={isOwner}
          walletClient={walletClient}
          publicClient={publicClient}
          address={address}
          onRefresh={refresh}
          events={events}
          historyLoading={historyLoading}
        />
      ) : null}
    </section>
  );
}
