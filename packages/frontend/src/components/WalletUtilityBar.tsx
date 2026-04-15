import type { Address } from "viem";
import { shortAddr } from "../utils/vaults";

interface Props {
  address: Address;
  onDisconnect: () => void;
}

export function WalletUtilityBar({ address, onDisconnect }: Props) {
  return (
    <button
      onClick={onDisconnect}
      className="wallet-utility glass-card"
      aria-label={`Disconnect ${shortAddr(address)}`}
      type="button"
    >
      <svg
        className="wallet-logout-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 8V5.5a1.5 1.5 0 0 0-1.5-1.5h-6A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20h6a1.5 1.5 0 0 0 1.5-1.5V16" />
        <path d="M10 12h9" />
        <path d="m16 8 4 4-4 4" />
      </svg>
      <span className="wallet-tooltip">Disconnect {shortAddr(address)}</span>
    </button>
  );
}
