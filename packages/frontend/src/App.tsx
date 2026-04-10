import { useState } from "react";
import type { Address } from "viem";
import { useWallet } from "./hooks/useWallet";
import { useVaultData } from "./hooks/useVaultData";
import { useVaultHistory } from "./hooks/useVaultHistory";
import { ConnectWallet } from "./components/ConnectWallet";
import { VaultSelector } from "./components/VaultSelector";
import { CreateVault } from "./components/CreateVault";
import { VaultDashboard } from "./components/VaultDashboard";
import DarkVeil from "./components/DarkVeil";
import "./App.css";

function LiquidGlassDefs() {
  return (
    <svg width="0" height="0" className="glass-defs" aria-hidden="true">
      <defs>
        <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.008"
            numOctaves="2"
            seed="92"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2" result="blurred" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurred"
            scale="150"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

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
    <div className="app-shell">
      <LiquidGlassDefs />

      <div className="app-background" />
      <div className="app-veil">
        <DarkVeil
          hueShift={0}
          noiseIntensity={0.012}
          scanlineIntensity={0}
          speed={1.5}
          scanlineFrequency={0}
          warpAmount={0.1}
          resolutionScale={0.9}
        />
      </div>
      <div className="app-background-tint" />
      <div className="app-noise" />

      <div className="app-frame">
        <header className="app-header liquid-panel liquid-panel-soft">
          <div className="brand-block">
            <div className="brand-heading">
              <span className="display-text brand-mark">X402 Operator</span>
              <span className="network-badge">X Layer</span>
            </div>
            <p className="header-subtitle">
              Premium operator shell for safe delegated vault execution.
            </p>
          </div>

          <ConnectWallet
            address={address}
            connecting={connecting}
            error={error}
            onConnect={connect}
            onDisconnect={() => {
              disconnect();
              setSelectedVault(null);
              setShowCreate(false);
            }}
          />
        </header>

        <main className={`app-main ${!address ? "app-main-landing" : ""}`}>
          {!address ? (
            <section className="hero-stage" aria-label="Landing hero">
              <div className="hero-stack">
                <p className="hero-pill">Delegated execution cockpit</p>
                <h1 className="display-text hero-title">Operate policy-bound vaults on X Layer.</h1>
                <p className="hero-text">
                  Connect your wallet, open a vault workspace, and manage delegated swap
                  execution from one calm control surface.
                </p>
                <div className="hero-actions">
                  <button onClick={connect} className="btn btn-primary btn-xl hero-cta">
                    {connecting ? "Connecting..." : "Connect Wallet"}
                  </button>
                </div>
                <p className="hero-note">
                  Owner deposit flow, live vault controls, and indexed activity appear as soon
                  as the session is active.
                </p>
              </div>
            </section>
          ) : (
            <>
              <section className="control-strip">
                <VaultSelector
                  publicClient={publicClient}
                  address={address}
                  selectedVault={selectedVault}
                  onSelect={(vault) => {
                    setSelectedVault(vault);
                    setShowCreate(false);
                  }}
                />

                <div className="control-actions liquid-panel liquid-panel-soft">
                  <div>
                    <p className="eyebrow">Vault builder</p>
                    <h3 className="display-text">Create a new shell</h3>
                    <p className="muted-copy">
                      Launch a new vault without leaving the workspace.
                    </p>
                  </div>
                  <button
                    className={`btn ${showCreate ? "btn-ghost" : "btn-primary"} btn-wide`}
                    onClick={() => {
                      setShowCreate(!showCreate);
                      if (!showCreate) {
                        setSelectedVault(null);
                      }
                    }}
                  >
                    {showCreate ? "Close Builder" : "New Vault"}
                  </button>
                </div>
              </section>

              {showCreate && walletClient && (
                <CreateVault
                  walletClient={walletClient}
                  publicClient={publicClient}
                  address={address}
                  onVaultCreated={(vault) => {
                    setSelectedVault(vault);
                    setShowCreate(false);
                  }}
                />
              )}

              {selectedVault && loading && !vaultData && (
                <section className="empty-state liquid-panel">
                  <p className="eyebrow">Loading vault</p>
                  <h2 className="display-text">Syncing live vault state</h2>
                  <p className="muted-copy">
                    Pulling balances, policy guards, and indexed activity from X Layer.
                  </p>
                </section>
              )}

              {selectedVault && vaultData && (
                <VaultDashboard
                  vault={selectedVault}
                  data={vaultData}
                  isOwner={isOwner}
                  walletClient={walletClient}
                  publicClient={publicClient}
                  address={address}
                  onRefresh={refresh}
                  events={vaultEvents}
                  historyLoading={historyLoading}
                />
              )}

              {!selectedVault && !showCreate && (
                <section className="empty-state liquid-panel">
                  <p className="eyebrow">Vault workspace</p>
                  <h2 className="display-text">Select a vault to open the cockpit</h2>
                  <p className="muted-copy">
                    Choose one of your deployed vaults, load a known vault address manually,
                    or create a new one from the control strip above.
                  </p>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
