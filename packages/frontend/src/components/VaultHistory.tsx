import type { IndexedEvent } from "../hooks/useVaultHistory";
import { ADDRESSES } from "../config/contracts";

interface Props {
  events: IndexedEvent[];
  loading: boolean;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatAmount(raw: string): string {
  return (Number(raw) / 1e6).toFixed(2);
}

function tokenName(addr: string): string {
  const lower = addr.toLowerCase();
  if (lower === ADDRESSES.usdt.toLowerCase()) return "USDT";
  if (lower === ADDRESSES.usdc.toLowerCase()) return "USDC";
  return shortAddr(addr);
}

function formatTime(ts: number): string {
  if (!ts) return "Pending";
  const date = new Date(ts * 1000);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEventVisual(type: string) {
  switch (type) {
    case "ExecutionSucceeded":
      return { label: "Swap", className: "swap", icon: "↗" };
    case "Deposit":
      return { label: "Deposit", className: "deposit", icon: "+" };
    case "Withdraw":
      return { label: "Withdraw", className: "withdraw", icon: "−" };
    case "ControllerAuthorized":
      return { label: "Authorize", className: "config", icon: "C" };
    case "ControllerRevoked":
      return { label: "Revoke", className: "config", icon: "R" };
    case "Paused":
      return { label: "Paused", className: "danger", icon: "!" };
    case "Unpaused":
      return { label: "Resumed", className: "config", icon: "✓" };
    default:
      return { label: type, className: "config", icon: "•" };
  }
}

function getEventDetails(event: IndexedEvent) {
  const data = event.data;

  switch (event.type) {
    case "ExecutionSucceeded":
      return `${formatAmount(data.amountIn)} ${tokenName(data.tokenIn)} → ${formatAmount(
        data.amountOut
      )} ${tokenName(data.tokenOut)}`;
    case "Deposit":
      return `${formatAmount(data.amount)} ${tokenName(data.token)} added to vault liquidity`;
    case "Withdraw":
      return `${formatAmount(data.amount)} ${tokenName(data.token)} sent to ${shortAddr(data.to)}`;
    case "ControllerAuthorized":
      return `Controller ${shortAddr(data.controller)} enabled`;
    case "ControllerRevoked":
      return `Controller ${shortAddr(data.controller)} removed`;
    case "Paused":
      return "Emergency pause triggered";
    case "Unpaused":
      return "Vault resumed for operator execution";
    default:
      return "Operational event recorded";
  }
}

export function VaultHistory({ events, loading }: Props) {
  const explorerBase = "https://www.okx.com/explorer/xlayer/tx/";

  return (
    <section className="history-panel liquid-panel liquid-panel-soft">
      <div className="history-panel-header">
        <div>
          <p className="eyebrow">Vault activity</p>
          <h3 className="display-text">Recent history</h3>
        </div>
        <span className="selector-count">{events.length} events</span>
      </div>

      {loading && events.length === 0 ? (
        <div className="history-empty">
          <p className="muted-copy">Loading indexed vault activity…</p>
        </div>
      ) : null}

      {!loading && events.length === 0 ? (
        <div className="history-empty">
          <p className="muted-copy">
            No activity yet. Deposits, swaps, controller updates, and pause actions will show up
            here as soon as they are indexed.
          </p>
        </div>
      ) : null}

      {events.length > 0 ? (
        <div className="history-scroll">
          {events.map((event, index) => {
            const visual = getEventVisual(event.type);
            return (
              <article
                key={`${event.txHash}-${index}`}
                className={`history-item history-item-${visual.className}`}
              >
                <div className="history-item-icon">{visual.icon}</div>
                <div className="history-item-copy">
                  <div className="history-item-top">
                    <span className={`event-badge ${visual.className}`}>{visual.label}</span>
                    <time className="history-time">{formatTime(event.timestamp)}</time>
                  </div>
                  <p className="history-description">{getEventDetails(event)}</p>
                  <div className="history-meta">
                    {"controller" in event.data && event.data.controller ? (
                      <span className="mono subtle">{shortAddr(event.data.controller)}</span>
                    ) : null}
                    <a
                      href={`${explorerBase}${event.txHash}`}
                      target="_blank"
                      rel="noopener"
                      className="tx-link"
                    >
                      {shortAddr(event.txHash)}
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
