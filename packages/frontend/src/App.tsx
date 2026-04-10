import { useEffect, useState } from "react";
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

const GLOW_SURFACE_SELECTOR = ".app-header, .liquid-panel, .glass-card";

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

function useBorderGlowSurfaces() {
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;

      const surface = event.target.closest<HTMLElement>(GLOW_SURFACE_SELECTOR);
      if (!surface) return;

      const rect = surface.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const dx = x - centerX;
      const dy = y - centerY;
      const kx = dx === 0 ? Infinity : centerX / Math.abs(dx);
      const ky = dy === 0 ? Infinity : centerY / Math.abs(dy);
      const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
      const edgePercent = edge * 100;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      const normalizedAngle = angle < 0 ? angle + 360 : angle;
      const glowOpacity = Math.min(Math.max((edgePercent - 18) / 62, 0), 1);
      const fillOpacity = Math.min(Math.max((edgePercent - 36) / 54, 0), 0.68);

      surface.style.setProperty("--edge-proximity", edgePercent.toFixed(3));
      surface.style.setProperty("--edge-glow-opacity", (glowOpacity * 1.55).toFixed(3));
      surface.style.setProperty("--edge-fill-opacity", fillOpacity.toFixed(3));
      surface.style.setProperty("--cursor-angle", `${normalizedAngle.toFixed(3)}deg`);
    };

    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => document.removeEventListener("pointermove", handlePointerMove);
  }, []);
}

function App() {
  useBorderGlowSurfaces();

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
        {address && (
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
        )}

        <main className={`app-main ${!address ? "app-main-landing" : ""}`}>
          {!address ? (
            <section className="landing-screen" aria-label="X402 Operator landing">
              <nav className="landing-nav glass-card" aria-label="Landing navigation">
                <div className="landing-brand">
                  <img className="landing-brand-logo" src="/logo.png" alt="X Layer" />
                </div>
                <span className="landing-brand-name">X402 Operator</span>
              </nav>

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
                    <button onClick={connect} className="btn btn-primary btn-xl hero-cta">
                      {connecting ? "Connecting..." : "Connect Wallet"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xl hero-cta hero-docs"
                      disabled
                      title="Documentation page coming soon"
                    >
                      Documentation
                    </button>
                  </div>
                </div>
              </div>

              <footer className="landing-footer">
                <span>Policy-enforced execution</span>
                <span>x402 metering</span>
                <span>Onchain receipts</span>
              </footer>
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
