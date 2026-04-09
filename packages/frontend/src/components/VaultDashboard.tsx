import { useState, useEffect, useCallback } from "react";
import type { WalletClient, PublicClient, Address } from "viem";
import type { VaultData } from "../hooks/useVaultData";
import { OPERATOR_VAULT_ABI, ERC20_ABI, ADDRESSES } from "../config/contracts";

interface Props {
  vault: Address;
  data: VaultData;
  isOwner: boolean;
  walletClient: WalletClient | null;
  publicClient: PublicClient;
  address: Address | null;
  onRefresh: () => void;
}

function formatUsdt(amount: bigint): string {
  const n = Number(amount) / 1e6;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function tokenLabel(addr: string): string {
  const lower = addr.toLowerCase();
  if (lower === ADDRESSES.usdt.toLowerCase()) return "USDT";
  if (lower === ADDRESSES.usdc.toLowerCase()) return "USDC";
  return shortAddr(addr);
}

export function VaultDashboard({ vault, data, isOwner, walletClient, publicClient, address, onRefresh }: Props) {
  const [controllerInput, setControllerInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Track active controllers and tokens from events
  const [controllers, setControllers] = useState<Address[]>([]);
  const [allowedTokens, setAllowedTokens] = useState<Address[]>([]);

  const loadLists = useCallback(async () => {
    try {
      const [authLogs, revokeLogs, tokenAddLogs, tokenRemoveLogs] = await Promise.all([
        publicClient.getLogs({
          address: vault,
          event: {
            type: "event",
            name: "ControllerAuthorized",
            inputs: [{ name: "controller", type: "address", indexed: true }],
          },
          fromBlock: 0n,
          toBlock: "latest",
        }),
        publicClient.getLogs({
          address: vault,
          event: {
            type: "event",
            name: "ControllerRevoked",
            inputs: [{ name: "controller", type: "address", indexed: true }],
          },
          fromBlock: 0n,
          toBlock: "latest",
        }),
        publicClient.getLogs({
          address: vault,
          event: {
            type: "event",
            name: "TokenAllowed",
            inputs: [{ name: "token", type: "address", indexed: true }],
          },
          fromBlock: 0n,
          toBlock: "latest",
        }),
        publicClient.getLogs({
          address: vault,
          event: {
            type: "event",
            name: "TokenRemoved",
            inputs: [{ name: "token", type: "address", indexed: true }],
          },
          fromBlock: 0n,
          toBlock: "latest",
        }),
      ]);

      // Build active controllers set
      const ctrlSet = new Set<string>();
      for (const log of authLogs) {
        ctrlSet.add((log.args.controller as string).toLowerCase());
      }
      for (const log of revokeLogs) {
        ctrlSet.delete((log.args.controller as string).toLowerCase());
      }
      setControllers([...ctrlSet] as Address[]);

      // Build active tokens set
      const tokenSet = new Set<string>();
      for (const log of tokenAddLogs) {
        tokenSet.add((log.args.token as string).toLowerCase());
      }
      for (const log of tokenRemoveLogs) {
        tokenSet.delete((log.args.token as string).toLowerCase());
      }
      setAllowedTokens([...tokenSet] as Address[]);
    } catch (err) {
      console.error("Failed to load controllers/tokens:", err);
    }
  }, [publicClient, vault]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const copyVaultAddress = () => {
    navigator.clipboard.writeText(vault);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const exec = async (label: string, fn: () => Promise<`0x${string}`>) => {
    setBusy(label);
    setError(null);
    try {
      const hash = await fn();
      await publicClient.waitForTransactionReceipt({ hash });
      onRefresh();
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setBusy(null);
    }
  };

  const writeVault = (fname: string, args: unknown[]) =>
    walletClient!.writeContract({
      address: vault,
      abi: OPERATOR_VAULT_ABI,
      functionName: fname as never,
      args: args as never,
      account: address!,
      chain: walletClient!.chain,
    });

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Vault Dashboard</h2>
        <div className="vault-address" onClick={copyVaultAddress} title="Click to copy" style={{ cursor: "pointer" }}>
          {shortAddr(vault)} {copied ? <span className="copied-badge">Copied!</span> : <span className="copy-icon">&#x2398;</span>}
        </div>
        <span className={`status-badge ${data.paused ? "paused" : "active"}`}>
          {data.paused ? "PAUSED" : "ACTIVE"}
        </span>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Balances */}
      <div className="card-row">
        <div className="card stat-card">
          <div className="stat-label">USDT Balance</div>
          <div className="stat-value">{formatUsdt(data.balanceUsdt)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">USDC Balance</div>
          <div className="stat-value">{formatUsdt(data.balanceUsdc)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Daily Volume Used</div>
          <div className="stat-value">
            {formatUsdt(data.dailyVolumeUsed)} / {formatUsdt(data.maxDailyVolume)}
          </div>
        </div>
      </div>

      {/* Policy */}
      <div className="card">
        <h3>Policy</h3>
        <div className="policy-grid">
          <div>
            <span className="label">Max per Trade</span>
            <span>{formatUsdt(data.maxAmountPerTrade)} USDT</span>
          </div>
          <div>
            <span className="label">Max Daily Volume</span>
            <span>{formatUsdt(data.maxDailyVolume)} USDT</span>
          </div>
          <div>
            <span className="label">Max Slippage</span>
            <span>{Number(data.maxSlippageBps) / 100}%</span>
          </div>
          <div>
            <span className="label">Cooldown</span>
            <span>{data.cooldownSeconds.toString()}s</span>
          </div>
          <div>
            <span className="label">Operator</span>
            <span>{shortAddr(data.operator)}</span>
          </div>
          <div>
            <span className="label">Last Execution</span>
            <span>
              {data.lastExecution > 0n
                ? new Date(Number(data.lastExecution) * 1000).toLocaleString()
                : "Never"}
            </span>
          </div>
        </div>
      </div>

      {/* Controllers List */}
      <div className="card">
        <h3>Authorized Controllers</h3>
        {controllers.length === 0 ? (
          <p className="subtitle">No controllers authorized</p>
        ) : (
          <div className="list-items">
            {controllers.map((ctrl) => (
              <div key={ctrl} className="list-item">
                <span className="mono">{shortAddr(ctrl)}</span>
                {isOwner && walletClient && (
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={busy !== null}
                    onClick={() =>
                      exec("revoke-ctrl", () => writeVault("revokeController", [ctrl]))
                    }
                  >
                    {busy === "revoke-ctrl" ? "..." : "Revoke"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {isOwner && walletClient && (
          <div className="action-row" style={{ marginTop: 12 }}>
            <input
              type="text"
              placeholder="0x... controller address"
              value={controllerInput}
              onChange={(e) => setControllerInput(e.target.value)}
            />
            <button
              className="btn btn-primary"
              disabled={busy !== null}
              onClick={() => {
                exec("add-ctrl", () => writeVault("authorizeController", [controllerInput]));
                setControllerInput("");
              }}
            >
              {busy === "add-ctrl" ? "Adding..." : "Add"}
            </button>
          </div>
        )}
      </div>

      {/* Allowed Tokens List */}
      <div className="card">
        <h3>Allowed Tokens</h3>
        {allowedTokens.length === 0 ? (
          <p className="subtitle">No tokens in allowlist</p>
        ) : (
          <div className="list-items">
            {allowedTokens.map((token) => (
              <div key={token} className="list-item">
                <span className="mono">{tokenLabel(token)}</span>
                <span className="mono subtle">{shortAddr(token)}</span>
                {isOwner && walletClient && (
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={busy !== null}
                    onClick={() =>
                      exec("remove-token", () => writeVault("removeAllowedToken", [token]))
                    }
                  >
                    {busy === "remove-token" ? "..." : "Remove"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {isOwner && walletClient && (
          <div className="action-row" style={{ marginTop: 12 }}>
            <input
              type="text"
              placeholder="0x... token address"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <button
              className="btn btn-primary"
              disabled={busy !== null}
              onClick={() => {
                exec("add-token", () => writeVault("addAllowedToken", [tokenInput]));
                setTokenInput("");
              }}
            >
              {busy === "add-token" ? "Adding..." : "Add"}
            </button>
          </div>
        )}
      </div>

      {/* Owner actions */}
      {isOwner && walletClient && (
        <>
          {/* Deposit */}
          <div className="card">
            <h3>Deposit USDT</h3>
            <div className="action-row">
              <input
                type="number"
                placeholder="Amount (USDT)"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <button
                className="btn btn-primary"
                disabled={busy !== null}
                onClick={() => {
                  const parsed = parseFloat(depositAmount);
                  if (!parsed || parsed <= 0) return;
                  const amount = BigInt(Math.round(parsed * 1e6));
                  exec("deposit", async () => {
                    const approveHash = await walletClient.writeContract({
                      address: ADDRESSES.usdt,
                      abi: ERC20_ABI,
                      functionName: "approve",
                      args: [vault, amount],
                      account: address!,
                      chain: walletClient.chain,
                    });
                    await publicClient.waitForTransactionReceipt({ hash: approveHash });
                    return writeVault("deposit", [ADDRESSES.usdt, amount]);
                  });
                }}
              >
                {busy === "deposit" ? "Depositing..." : "Deposit"}
              </button>
            </div>
          </div>

          {/* Pause / Unpause */}
          <div className="card">
            <h3>Emergency</h3>
            <div className="action-row">
              <button
                className={`btn ${data.paused ? "btn-primary" : "btn-danger"}`}
                disabled={busy !== null}
                onClick={() =>
                  exec("pause", () => writeVault(data.paused ? "unpause" : "pause", []))
                }
              >
                {data.paused ? "Unpause Vault" : "Pause Vault"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
