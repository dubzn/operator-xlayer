import { useState } from "react";
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

export function VaultDashboard({ vault, data, isOwner, walletClient, publicClient, address, onRefresh }: Props) {
  const [controllerInput, setControllerInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exec = async (label: string, fn: () => Promise<`0x${string}`>) => {
    setBusy(label);
    setError(null);
    try {
      const hash = await fn();
      await publicClient.waitForTransactionReceipt({ hash });
      onRefresh();
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
        <div className="vault-address">{shortAddr(vault)}</div>
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
                  const amount = BigInt(parseFloat(depositAmount) * 1e6);
                  exec("deposit", async () => {
                    // Approve first
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

          {/* Authorize Controller */}
          <div className="card">
            <h3>Authorize Controller</h3>
            <p className="subtitle">Allow a bot wallet to sign execution intents</p>
            <div className="action-row">
              <input
                type="text"
                placeholder="0x... controller address"
                value={controllerInput}
                onChange={(e) => setControllerInput(e.target.value)}
              />
              <button
                className="btn btn-primary"
                disabled={busy !== null}
                onClick={() =>
                  exec("controller", () => writeVault("authorizeController", [controllerInput]))
                }
              >
                {busy === "controller" ? "Authorizing..." : "Authorize"}
              </button>
            </div>
          </div>

          {/* Add Allowed Token */}
          <div className="card">
            <h3>Add Allowed Token</h3>
            <div className="action-row">
              <input
                type="text"
                placeholder="0x... token address"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
              <button
                className="btn btn-primary"
                disabled={busy !== null}
                onClick={() =>
                  exec("token", () => writeVault("addAllowedToken", [tokenInput]))
                }
              >
                {busy === "token" ? "Adding..." : "Add Token"}
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
