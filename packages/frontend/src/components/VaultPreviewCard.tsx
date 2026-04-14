import type { Address, PublicClient } from "viem";
import { Link } from "react-router-dom";
import { useVaultData } from "../hooks/useVaultData";
import {
  collectVaultTokens,
  deriveNetValueUsd,
  deriveVaultNetworkDelta24h,
  deriveVaultName,
  formatPercent,
  formatLastExecution,
  formatUsd,
  shortAddr,
  tokenTooltip,
} from "../lib/vaults";

interface Props {
  vault: Address;
  publicClient: PublicClient;
}

export function VaultPreviewCard({ vault, publicClient }: Props) {
  const { data, loading, error } = useVaultData(publicClient, vault);
  const netValue = data ? deriveNetValueUsd(data) : 0;
  const tokens = data ? collectVaultTokens(data) : [];
  const performance = deriveVaultNetworkDelta24h(vault);
  const statusTone = error ? "neutral" : data?.paused ? "paused" : loading && !data ? "neutral" : "active";
  const statusLabel = error
    ? "Unavailable"
    : data
      ? data.paused
        ? "Paused"
        : "Active"
      : loading
        ? "Syncing"
        : "Ready";

  return (
    <Link to={`/vaults/${vault}`} className="vault-card glass-card">
      <div className="vault-card-top">
        <div className="vault-card-heading">
          <p className="eyebrow">Vault</p>
          <h3 className="display-text vault-card-title">
            {data ? deriveVaultName(data.baseToken) : shortAddr(vault)}
          </h3>
        </div>
        <span className={`vault-card-status ${statusTone}`}>
          {statusLabel}
        </span>
      </div>

      <div className="vault-card-main">
        <span className="summary-label">Net value</span>
        <strong className="vault-card-value">
          {loading && !data ? "Syncing..." : error ? "Unavailable" : formatUsd(netValue)}
        </strong>

        {error ? (
          <span className="vault-card-trend-label">Vault metrics are temporarily unavailable.</span>
        ) : (
          <div
            className="vault-card-trend"
            title={`Vault 24h ${formatPercent(performance.vaultChange)} • Network ${formatPercent(
              performance.networkChange
            )}`}
          >
            <span
              className={`vault-card-trend-pill ${
                performance.relative >= 0 ? "positive" : "negative"
              }`}
            >
              {formatPercent(performance.relative)}
            </span>
            <span className="vault-card-trend-label">vs network · 24h</span>
          </div>
        )}
      </div>

      <div className="vault-card-meta">
        <div className="vault-card-stat vault-card-stat-address">
          <span className="field-label">Address</span>
          <strong title={vault}>{shortAddr(vault)}</strong>
        </div>
        <div className="vault-card-stat">
          <span className="field-label">Tokens</span>
          {tokens.length > 0 ? (
            <div className="vault-card-token-row">
              {tokens.map((token) => (
                <span
                  key={token.address}
                  className={`token-badge token-badge-${token.symbol.toLowerCase()}`}
                  title={`${tokenTooltip(token.address)} · ${token.symbol}`}
                >
                  {token.symbol}
                </span>
              ))}
            </div>
          ) : (
            <strong>—</strong>
          )}
        </div>
        <div className="vault-card-stat">
          <span className="field-label">Last execution</span>
          <strong>{data ? formatLastExecution(data.lastExecution) : "—"}</strong>
        </div>
      </div>
    </Link>
  );
}
