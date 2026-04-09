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
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EventRow({ event }: { event: IndexedEvent }) {
  const explorerBase = "https://www.okx.com/explorer/xlayer/tx/";
  const d = event.data;

  switch (event.type) {
    case "ExecutionSucceeded":
      return (
        <tr>
          <td>{formatTime(event.timestamp)}</td>
          <td><span className="event-badge swap">SWAP</span></td>
          <td>
            {formatAmount(d.amountIn)} {tokenName(d.tokenIn)}
            {" → "}
            {formatAmount(d.amountOut)} {tokenName(d.tokenOut)}
          </td>
          <td className="mono">{shortAddr(d.controller)}</td>
          <td>
            <a href={`${explorerBase}${event.txHash}`} target="_blank" rel="noopener" className="tx-link">
              {shortAddr(event.txHash)}
            </a>
          </td>
        </tr>
      );

    case "Deposit":
      return (
        <tr>
          <td>{formatTime(event.timestamp)}</td>
          <td><span className="event-badge deposit">DEPOSIT</span></td>
          <td>{formatAmount(d.amount)} {tokenName(d.token)}</td>
          <td className="mono">—</td>
          <td>
            <a href={`${explorerBase}${event.txHash}`} target="_blank" rel="noopener" className="tx-link">
              {shortAddr(event.txHash)}
            </a>
          </td>
        </tr>
      );

    case "Withdraw":
      return (
        <tr>
          <td>{formatTime(event.timestamp)}</td>
          <td><span className="event-badge withdraw">WITHDRAW</span></td>
          <td>{formatAmount(d.amount)} {tokenName(d.token)} → {shortAddr(d.to)}</td>
          <td className="mono">—</td>
          <td>
            <a href={`${explorerBase}${event.txHash}`} target="_blank" rel="noopener" className="tx-link">
              {shortAddr(event.txHash)}
            </a>
          </td>
        </tr>
      );

    case "ControllerAuthorized":
      return (
        <tr>
          <td>{formatTime(event.timestamp)}</td>
          <td><span className="event-badge config">AUTHORIZE</span></td>
          <td>Controller authorized</td>
          <td className="mono">{shortAddr(d.controller)}</td>
          <td>
            <a href={`${explorerBase}${event.txHash}`} target="_blank" rel="noopener" className="tx-link">
              {shortAddr(event.txHash)}
            </a>
          </td>
        </tr>
      );

    case "ControllerRevoked":
      return (
        <tr>
          <td>{formatTime(event.timestamp)}</td>
          <td><span className="event-badge config">REVOKE</span></td>
          <td>Controller revoked</td>
          <td className="mono">{shortAddr(d.controller)}</td>
          <td>
            <a href={`${explorerBase}${event.txHash}`} target="_blank" rel="noopener" className="tx-link">
              {shortAddr(event.txHash)}
            </a>
          </td>
        </tr>
      );

    case "Paused":
      return (
        <tr>
          <td>{formatTime(event.timestamp)}</td>
          <td><span className="event-badge danger">PAUSED</span></td>
          <td>Vault paused</td>
          <td className="mono">—</td>
          <td>
            <a href={`${explorerBase}${event.txHash}`} target="_blank" rel="noopener" className="tx-link">
              {shortAddr(event.txHash)}
            </a>
          </td>
        </tr>
      );

    case "Unpaused":
      return (
        <tr>
          <td>{formatTime(event.timestamp)}</td>
          <td><span className="event-badge config">UNPAUSED</span></td>
          <td>Vault unpaused</td>
          <td className="mono">—</td>
          <td>
            <a href={`${explorerBase}${event.txHash}`} target="_blank" rel="noopener" className="tx-link">
              {shortAddr(event.txHash)}
            </a>
          </td>
        </tr>
      );

    default:
      return (
        <tr>
          <td>{formatTime(event.timestamp)}</td>
          <td><span className="event-badge config">{event.type}</span></td>
          <td>—</td>
          <td className="mono">—</td>
          <td>
            <a href={`${explorerBase}${event.txHash}`} target="_blank" rel="noopener" className="tx-link">
              {shortAddr(event.txHash)}
            </a>
          </td>
        </tr>
      );
  }
}

export function VaultHistory({ events, loading }: Props) {
  if (loading && events.length === 0) {
    return (
      <div className="card">
        <h3>History</h3>
        <p className="subtitle">Loading events...</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>History</h3>
      {events.length === 0 ? (
        <p className="subtitle">No activity yet — events will appear here as the indexer catches up</p>
      ) : (
        <div className="table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Details</th>
                <th>Bot / Controller</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <EventRow key={`${e.txHash}-${i}`} event={e} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
