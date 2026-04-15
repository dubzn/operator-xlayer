import type { Address, PublicClient, WalletClient } from "viem";
import { Link, useNavigate } from "react-router-dom";
import { CreateVault } from "../components/CreateVault";

interface Props {
  walletClient: WalletClient | null;
  publicClient: PublicClient;
  address: Address | null;
}

export function NewVaultPage({ walletClient, publicClient, address }: Props) {
  const navigate = useNavigate();

  if (!walletClient || !address) {
    return (
      <section className="empty-state liquid-panel">
        <p className="eyebrow">Vault builder</p>
        <h2 className="display-text">Reconnect your wallet to create a vault</h2>
        <p className="muted-copy">
          The vault builder needs an active wallet session before it can submit factory
          transactions.
        </p>
        <Link to="/home" className="btn btn-ghost btn-wide">
          Back Home
        </Link>
      </section>
    );
  }

  return (
    <section className="vault-builder-page">
      <div className="page-intro">
        <div className="page-copy">
          <p className="eyebrow">Vault builder</p>
          <h1 className="display-text">Create a new shell</h1>
          <p className="muted-copy">
            Configure the initial trade caps, slippage, and cooldown. Once the vault is deployed
            we will route you straight into its detail workspace.
          </p>
        </div>

        <div className="page-intro-actions">
          <Link to="/vaults" className="btn btn-ghost btn-wide">
            Back to Vaults
          </Link>
        </div>
      </div>

      <CreateVault
        walletClient={walletClient}
        publicClient={publicClient}
        address={address}
        onVaultCreated={(vault) => navigate(`/vaults/${vault}`)}
      />
    </section>
  );
}
