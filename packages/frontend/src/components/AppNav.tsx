import { NavLink } from "react-router-dom";
import type { Address } from "viem";
import { shortAddr } from "../lib/vaults";

interface Props {
  address: Address | null;
  onDisconnect: () => void;
  onConnect: () => void;
  connecting: boolean;
}

export function AppNav({ address, onDisconnect, onConnect, connecting }: Props) {
  return (
    <nav className="shell-nav glass-card" aria-label="Primary navigation">
      <NavLink to={address ? "/vaults" : "/home"} className="shell-brand">
        <img className="shell-brand-logo" src="/logo.png" alt="X Layer" />
        <span>X402 Operator</span>
      </NavLink>

      <div className="shell-nav-right">
        <div className="shell-nav-links">
          {address && (
            <NavLink
              to="/vaults"
              className={({ isActive }) => `shell-nav-link ${isActive ? "active" : ""}`}
            >
              Vaults
            </NavLink>
          )}
          <NavLink
            to="/docs"
            className={({ isActive }) => `shell-nav-link ${isActive ? "active" : ""}`}
          >
            Docs
          </NavLink>
        </div>

        {address ? (
          <button
            onClick={onDisconnect}
            className="shell-wallet-btn"
            type="button"
          >
            <span className="shell-wallet-addr">{shortAddr(address)}</span>
            <svg
              className="shell-wallet-icon"
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
          </button>
        ) : (
          <button
            onClick={onConnect}
            className="shell-connect-btn"
            type="button"
          >
            {connecting ? "Connecting..." : "Connect"}
          </button>
        )}
      </div>
    </nav>
  );
}
