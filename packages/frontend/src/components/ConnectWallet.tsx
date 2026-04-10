import type { Address } from "viem";

interface Props {
  address: Address | null;
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ConnectWallet({ address, connecting, error, onConnect, onDisconnect }: Props) {
  if (address) {
    return (
      <div className="wallet-connected">
        <div className="wallet-meta">
          <span className="wallet-label">Wallet</span>
          <span className="display-text wallet-address">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
        <button onClick={onDisconnect} className="btn btn-danger btn-wide">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <button onClick={onConnect} disabled={connecting} className="btn btn-primary btn-wide">
        {connecting ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && <p className="error wallet-error">{error}</p>}
    </div>
  );
}
