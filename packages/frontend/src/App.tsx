import { useEffect } from "react";
import type { Address } from "viem";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useWallet } from "./hooks/useWallet";
import { AppNav } from "./components/AppNav";
import { PublicNav } from "./components/PublicNav";
import { WalletUtilityBar } from "./components/WalletUtilityBar";
import DarkVeil from "./components/DarkVeil";
import { HomePage } from "./pages/HomePage";
import { DocsPage } from "./pages/DocsPage";
import { VaultsPage } from "./pages/VaultsPage";
import { NewVaultPage } from "./pages/NewVaultPage";
import { VaultDetailPage } from "./pages/VaultDetailPage";
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

function ProtectedRoute({ address }: { address: Address | null }) {
  if (!address) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}

function App() {
  useBorderGlowSurfaces();

  const { address, walletClient, publicClient, connect, disconnect, connecting, error } =
    useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const showAuthenticatedShell = Boolean(address) && location.pathname !== "/home";

  const handleConnect = async () => {
    const connectedAddress = await connect();
    if (connectedAddress) {
      navigate("/vaults");
    }
  };

  const handleDisconnect = () => {
    disconnect();
    navigate("/home");
  };

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
        {showAuthenticatedShell ? (
          <div className="shell-top-row">
            <AppNav />
            {address ? <WalletUtilityBar address={address} onDisconnect={handleDisconnect} /> : null}
          </div>
        ) : (
          <PublicNav />
        )}

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to={address ? "/vaults" : "/home"} replace />} />
            <Route
              path="/home"
              element={
                address ? (
                  <Navigate to="/vaults" replace />
                ) : (
                  <HomePage
                    address={address}
                    connecting={connecting}
                    error={error}
                    onConnect={handleConnect}
                  />
                )
              }
            />
            <Route
              path="/docs"
              element={
                <DocsPage
                  address={address}
                  connecting={connecting}
                  error={error}
                  onConnect={handleConnect}
                />
              }
            />

            <Route element={<ProtectedRoute address={address} />}>
              <Route
                path="/vaults"
                element={<VaultsPage publicClient={publicClient} address={address!} />}
              />
              <Route
                path="/vaults/new"
                element={
                  <NewVaultPage
                    walletClient={walletClient}
                    publicClient={publicClient}
                    address={address}
                  />
                }
              />
              <Route
                path="/vaults/:vaultId"
                element={
                  <VaultDetailPage
                    walletClient={walletClient}
                    publicClient={publicClient}
                    address={address}
                  />
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
