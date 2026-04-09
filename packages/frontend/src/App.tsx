import { useState } from "react";
import type { Address } from "viem";
import { useWallet } from "./hooks/useWallet";
import { useVaultData } from "./hooks/useVaultData";
import { useVaultHistory } from "./hooks/useVaultHistory";
import { ConnectWallet } from "./components/ConnectWallet";
import { VaultSelector } from "./components/VaultSelector";
import { CreateVault } from "./components/CreateVault";
import { VaultDashboard } from "./components/VaultDashboard";
import { VaultHistory } from "./components/VaultHistory";
import "./App.css";

function App() {
  const { address, walletClient, publicClient, connect, disconnect, connecting, error } =
    useWallet();
  const [selectedVault, setSelectedVault] = useState<Address | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { data: vaultData, loading, refresh } = useVaultData(publicClient, selectedVault);
  const { events: vaultEvents, loading: historyLoading } = useVaultHistory(selectedVault);

  const isOwner =
    vaultData && address
      ? vaultData.owner.toLowerCase() === address.toLowerCase()
      : false;

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <h1>X402 Operator</h1>
          <span className="network-badge">X Layer</span>
        </div>
        <ConnectWallet
          address={address}
          connecting={connecting}
          error={error}
          onConnect={connect}
          onDisconnect={() => {
            disconnect();
            setSelectedVault(null);
          }}
        />
      </header>

      <main>
        {!address ? (
          <div className="hero">
            <h2>Autonomous Swap Execution</h2>
            <p>
              Deploy a vault, set your risk policy, authorize a bot controller,
              and let the operator execute swaps on your behalf.
            </p>
            <button onClick={connect} className="btn btn-primary btn-lg">
              Connect Wallet to Start
            </button>
          </div>
        ) : (
          <>
            <div className="top-bar">
              <VaultSelector
                publicClient={publicClient}
                address={address}
                selectedVault={selectedVault}
                onSelect={(v) => {
                  setSelectedVault(v);
                  setShowCreate(false);
                }}
              />
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowCreate(!showCreate);
                  setSelectedVault(null);
                }}
              >
                {showCreate ? "Cancel" : "+ New Vault"}
              </button>
            </div>

            {showCreate && walletClient && (
              <CreateVault
                walletClient={walletClient}
                publicClient={publicClient}
                address={address}
                onVaultCreated={(v) => {
                  setSelectedVault(v);
                  setShowCreate(false);
                }}
              />
            )}

            {selectedVault && loading && !vaultData && (
              <div className="loading">Loading vault data...</div>
            )}

            {selectedVault && vaultData && (
              <>
                <VaultDashboard
                  vault={selectedVault}
                  data={vaultData}
                  isOwner={isOwner}
                  walletClient={walletClient}
                  publicClient={publicClient}
                  address={address}
                  onRefresh={refresh}
                />
                <VaultHistory events={vaultEvents} loading={historyLoading} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
