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

  if (loading && !data) {
    return (
      <div className="vault-card vault-card-skeleton glass-card" aria-hidden="true">
        <div className="vault-card-top">
          <div className="skeleton-line skeleton-line-title" />
          <div className="skeleton-pill" />
        </div>
        <div className="vault-card-main">
          <div className="skeleton-line skeleton-line-label" />
          <div className="skeleton-line skeleton-line-value" />
        </div>
        <div className="vault-card-meta vault-card-meta-2col">
          <div className="vault-card-stat skeleton-stat">
            <div className="skeleton-line skeleton-line-label" />
            <div className="skeleton-line skeleton-line-short" />
          </div>
          <div className="vault-card-stat skeleton-stat">
            <div className="skeleton-line skeleton-line-label" />
            <div className="skeleton-line skeleton-line-short" />
          </div>
        </div>
      </div>
    );
  }

  const netValue = data ? deriveNetValueUsd(data) : 0;
  const tokens = data ? collectVaultTokens(data) : [];
  const performance = deriveVaultNetworkDelta24h(vault);
  const statusTone = error ? "neutral" : data?.paused ? "paused" : "active";
  const statusLabel = error ? "Unavailable" : data?.paused ? "Paused" : "Active";

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

      <div className="vault-card-meta vault-card-meta-2col">
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
