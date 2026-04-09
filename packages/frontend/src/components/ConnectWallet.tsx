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
        <span className="wallet-address">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button onClick={onDisconnect} className="btn btn-sm">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <button onClick={onConnect} disabled={connecting} className="btn btn-primary">
        {connecting ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
