import type { Address, PublicClient, WalletClient } from "viem";
import { getAddress, isAddress } from "viem";
import { Link, useParams } from "react-router-dom";
import { VaultDashboard } from "../components/VaultDashboard";
import { useOwnedVaults } from "../hooks/useOwnedVaults";
import { useVaultData } from "../hooks/useVaultData";
import { useVaultHistory } from "../hooks/useVaultHistory";
import { shortAddr } from "../lib/vaults";

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

  if (ownedVaultsLoading) {
    return (
      <section className="empty-state liquid-panel">
        <p className="eyebrow">Vault detail</p>
        <h2 className="display-text">Loading your workspace</h2>
        <p className="muted-copy">Checking whether this vault belongs to your connected account.</p>
      </section>
    );
  }

  if (!ownedVault) {
    return (
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
    );
  }

  return (
    <section className="vault-detail-page">
      <div className="page-intro page-intro-compact">
        <div className="page-copy">
          <p className="eyebrow">Vault detail</p>
          <h1 className="display-text">Live vault workspace</h1>
          <p className="muted-copy">
            Detailed graph, policy configuration, and recent activity for {shortAddr(ownedVault)}.
          </p>
        </div>

        <div className="page-intro-actions">
          <Link to="/vaults" className="btn btn-ghost btn-wide">
            All Vaults
          </Link>
        </div>
      </div>

      {loading && !data ? (
        <section className="empty-state liquid-panel">
          <p className="eyebrow">Loading vault</p>
          <h2 className="display-text">Syncing live vault state</h2>
          <p className="muted-copy">
            Pulling balances, policy guards, and indexed activity from X Layer.
          </p>
        </section>
      ) : null}

      {!loading && !data ? (
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
          vault={ownedVault}
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
