import type { IndexedEvent } from "../hooks/useVaultHistory";
import { formatUnits } from "viem";
import { getTokenMeta, tokenIcon, tokenLabel } from "../config/tokens";

interface Props {
  events: IndexedEvent[];
  loading: boolean;
}

const HISTORY_VISIBLE_FROM_TIMESTAMP = Math.floor(new Date(2026, 3, 15, 0, 0, 0, 0).getTime() / 1000);
const DISPLAY_DECIMALS = 6;

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatAmount(raw: string, tokenAddress?: string): string {
  const decimals = tokenAddress ? getTokenMeta(tokenAddress)?.decimals ?? 6 : 6;
  const [wholePart, fractionalPart = ""] = formatUnits(BigInt(raw), decimals).split(".");
  const whole = BigInt(wholePart || "0").toLocaleString();
  const fraction = fractionalPart.padEnd(DISPLAY_DECIMALS, "0").slice(0, DISPLAY_DECIMALS);

  return `${whole}.${fraction}`;
}

function formatTime(ts: number): string {
  if (!ts) return "Pending";
  const date = new Date(ts * 1000);
  return date.toLocaleString(undefined, {
    year: "numeric",
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

function TokenAmount({
  raw,
  tokenAddress,
}: {
  raw: string;
  tokenAddress?: string;
}) {
  if (!tokenAddress) {
    return <span>{formatAmount(raw)}</span>;
  }

  const icon = tokenIcon(tokenAddress);

  return (
    <span className="history-token-inline">
      {icon ? <img src={icon} alt="" className="history-token-inline-icon" /> : null}
      <span>
        {formatAmount(raw, tokenAddress)} {tokenLabel(tokenAddress)}
      </span>
    </span>
  );
}

function getEventDetails(event: IndexedEvent) {
  const data = event.data;

  switch (event.type) {
    case "ExecutionSucceeded":
      return (
        <>
          <TokenAmount raw={data.amountIn} tokenAddress={data.tokenIn} />
          <span className="history-description-separator">→</span>
          <TokenAmount raw={data.amountOut} tokenAddress={data.tokenOut} />
        </>
      );
    case "Deposit":
      return (
        <>
          <TokenAmount raw={data.amount} tokenAddress={data.token} />
          <span>added to vault liquidity</span>
        </>
      );
    case "Withdraw":
      return (
        <>
          <TokenAmount raw={data.amount} tokenAddress={data.token} />
          <span>sent to {shortAddr(data.to)}</span>
        </>
      );
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
  const visibleEvents = [...events]
    .filter((event) => event.timestamp >= HISTORY_VISIBLE_FROM_TIMESTAMP)
    .sort((a, b) => b.timestamp - a.timestamp || b.blockNumber - a.blockNumber);

  return (
    <section className="history-panel liquid-panel liquid-panel-soft">
      <div className="history-panel-header">
        <div>
          <p className="eyebrow">Vault activity</p>
          <h3 className="display-text">Recent history</h3>
        </div>
        <span className="selector-count">{visibleEvents.length} events</span>
      </div>

      {loading && visibleEvents.length === 0 ? (
        <div className="history-empty">
          <p className="muted-copy">Loading indexed vault activity…</p>
        </div>
      ) : null}

      {!loading && visibleEvents.length === 0 ? (
        <div className="history-empty">
          <p className="muted-copy">
            No activity from April 15, 2026 onward yet. Older indexed events are hidden in this
            view.
          </p>
        </div>
      ) : null}

      {visibleEvents.length > 0 ? (
        <div className="history-scroll">
          {visibleEvents.map((event, index) => {
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
