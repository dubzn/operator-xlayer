import { useState, useEffect, useCallback, useRef } from "react";
import type { WalletClient, PublicClient, Address } from "viem";
import type { IndexedEvent } from "../hooks/useVaultHistory";
import type { VaultData } from "../hooks/useVaultData";
import { VaultHistory } from "./VaultHistory";
import { OPERATOR_VAULT_ABI, ERC20_ABI, ADDRESSES } from "../config/contracts";

type VaultTab = "graph" | "policies" | "configuration";
type Timeframe = "24h" | "7d" | "1M" | "1Y" | "Max";
type ConfigSection = "controllers" | "tokens" | "emergency";

interface Props {
  vault: Address;
  data: VaultData;
  isOwner: boolean;
  walletClient: WalletClient | null;
  publicClient: PublicClient;
  address: Address | null;
  onRefresh: () => void;
  events: IndexedEvent[];
  historyLoading: boolean;
}

interface ChartPoint {
  label: string;
  value: number;
  volume: number;
}

const TIMEFRAMES: Timeframe[] = ["24h", "7d", "1M", "1Y", "Max"];
const VAULT_TABS: VaultTab[] = ["graph", "policies", "configuration"];

function formatUsdFromBigInt(amount: bigint): string {
  const value = Number(amount) / 1e6;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function tokenLabel(addr: string) {
  const lower = addr.toLowerCase();
  if (lower === ADDRESSES.usdt.toLowerCase()) return "USDT";
  if (lower === ADDRESSES.usdc.toLowerCase()) return "USDC";
  return shortAddr(addr);
}

function formatCooldown(seconds: bigint): string {
  if (seconds === 0n) return "No cooldown";
  if (seconds < 60n) return `${seconds.toString()}s`;
  if (seconds < 3600n) return `${Number(seconds) / 60}m`;
  return `${(Number(seconds) / 3600).toFixed(1)}h`;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLabels(timeframe: Timeframe, points: number): string[] {
  if (timeframe === "24h") {
    return Array.from({ length: points }, (_, index) => `${index.toString().padStart(2, "0")}:00`);
  }

  if (timeframe === "7d") {
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  }

  if (timeframe === "1M") {
    return Array.from({ length: points }, (_, index) => `W${index + 1}`);
  }

  if (timeframe === "1Y") {
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  }

  return ["2021", "2022", "2023", "2024", "2025", "2026"];
}

function generateChartSeries(vault: string, currentValue: number, timeframe: Timeframe): ChartPoint[] {
  const config = {
    "24h": { points: 24, volatility: 0.016, waveCycles: 2.6 },
    "7d": { points: 7, volatility: 0.022, waveCycles: 1.8 },
    "1M": { points: 6, volatility: 0.03, waveCycles: 1.6 },
    "1Y": { points: 12, volatility: 0.055, waveCycles: 1.05 },
    Max: { points: 6, volatility: 0.08, waveCycles: 0.9 },
  }[timeframe];

  const labels = buildLabels(timeframe, config.points);
  const random = createSeededRandom(hashString(`${vault}-${timeframe}`));
  const floor = currentValue * (1 - config.volatility * 2.4);
  const ceiling = currentValue * (1 + config.volatility * 1.6);

  return labels.map((label, index) => {
    const progress = config.points === 1 ? 1 : index / (config.points - 1);
    const wave = Math.sin(progress * Math.PI * config.waveCycles) * config.volatility;
    const ripple = Math.cos(progress * Math.PI * (config.waveCycles + 0.75)) * config.volatility * 0.45;
    const drift = (random() - 0.5) * config.volatility * 0.9;
    const targetBlend = 0.22 + progress * 0.78;

    let value = currentValue * (1 + wave + ripple + drift);
    value = value * (1 - targetBlend) + currentValue * targetBlend;
    value = Math.max(floor, Math.min(ceiling, value));

    const volume = 22 + Math.abs(wave + ripple + drift) * 850 + random() * 28;

    return {
      label,
      value,
      volume,
    };
  });
}

function buildChartGeometry(points: ChartPoint[]) {
  const width = 820;
  const height = 340;
  const paddingX = 14;
  const paddingTop = 14;
  const paddingBottom = 18;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, max * 0.015);
  const safeMin = min - spread * 0.2;
  const safeMax = max + spread * 0.2;

  const coordinates = points.map((point, index) => {
    const x = paddingX + (index / Math.max(points.length - 1, 1)) * (width - paddingX * 2);
    const y =
      paddingTop +
      ((safeMax - point.value) / Math.max(safeMax - safeMin, 1)) * (height - paddingTop - paddingBottom);

    return { x, y };
  });

  const ticks = Array.from({ length: 5 }, (_, index) => safeMax - ((safeMax - safeMin) / 4) * index);
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const baseline = height - paddingBottom;
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1].x.toFixed(2)} ${baseline.toFixed(
    2
  )} L ${coordinates[0].x.toFixed(2)} ${baseline.toFixed(2)} Z`;

  return {
    width,
    height,
    coordinates,
    linePath,
    areaPath,
    ticks,
    safeMin,
    safeMax,
  };
}

function deriveVaultName(baseToken: string) {
  const token = tokenLabel(baseToken);
  return `${token} Reserve Vault`;
}

function collectAddresses(
  events: IndexedEvent[],
  baseToken: Address
): {
  controllers: Address[];
  allowedInputTokens: Address[];
  allowedTokens: Address[];
} {
  const controllers = new Map<string, Address>();
  const inputTokens = new Map<string, Address>();
  const outputTokens = new Map<string, Address>();

  inputTokens.set(baseToken.toLowerCase(), baseToken);

  const sortedEvents = [...events].sort((a, b) => a.blockNumber - b.blockNumber);
  for (const event of sortedEvents) {
    if (event.type === "ControllerAuthorized" && event.data.controller) {
      controllers.set(event.data.controller.toLowerCase(), event.data.controller as Address);
    }

    if (event.type === "ControllerRevoked" && event.data.controller) {
      controllers.delete(event.data.controller.toLowerCase());
    }

    if (event.type === "InputTokenAllowed" && event.data.token) {
      inputTokens.set(event.data.token.toLowerCase(), event.data.token as Address);
    }

    if (event.type === "InputTokenRemoved" && event.data.token) {
      inputTokens.delete(event.data.token.toLowerCase());
    }

    if (event.type === "Deposit" && event.data.token) {
      inputTokens.set(event.data.token.toLowerCase(), event.data.token as Address);
    }

    if (event.type === "TokenAllowed" && event.data.token) {
      outputTokens.set(event.data.token.toLowerCase(), event.data.token as Address);
    }

    if (event.type === "TokenRemoved" && event.data.token) {
      outputTokens.delete(event.data.token.toLowerCase());
    }
  }

  return {
    controllers: Array.from(controllers.values()),
    allowedInputTokens: Array.from(inputTokens.values()),
    allowedTokens: Array.from(outputTokens.values()),
  };
}

export function VaultDashboard({
  vault,
  data,
  isOwner,
  walletClient,
  publicClient,
  address,
  onRefresh,
  events,
  historyLoading,
}: Props) {
  const [activeTab, setActiveTab] = useState<VaultTab>("graph");
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>("1M");
  const [controllerInput, setControllerInput] = useState("");
  const [inputTokenInput, setInputTokenInput] = useState("");
  const [outputTokenInput, setOutputTokenInput] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositOpen, setDepositOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [controllers, setControllers] = useState<Address[]>([]);
  const [allowedInputTokens, setAllowedInputTokens] = useState<Address[]>([]);
  const [allowedTokens, setAllowedTokens] = useState<Address[]>([]);
  const [configSection, setConfigSection] = useState<ConfigSection>("controllers");

  // Policy edit state
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [policyDraft, setPolicyDraft] = useState({
    maxAmountPerTrade: "",
    maxDailyVolume: "",
    maxSlippageBps: "",
    cooldownSeconds: "",
  });
  const policyFormRef = useRef<HTMLDivElement>(null);

  const loadLists = useCallback(async () => {
    try {
      const [controllersResult, inputTokensResult, outputTokensResult] = await Promise.all([
        publicClient.readContract({
          address: vault,
          abi: OPERATOR_VAULT_ABI,
          functionName: "getAuthorizedControllers",
        }),
        publicClient.readContract({
          address: vault,
          abi: OPERATOR_VAULT_ABI,
          functionName: "getAllowedInputTokens",
        }),
        publicClient.readContract({
          address: vault,
          abi: OPERATOR_VAULT_ABI,
          functionName: "getAllowedTokens",
        }),
      ]);

      setControllers(controllersResult as Address[]);
      setAllowedInputTokens(inputTokensResult as Address[]);
      setAllowedTokens(outputTokensResult as Address[]);
    } catch (err) {
      console.warn("Vault does not expose enumerable views yet, falling back to event history:", err);
      const fallbackLists = collectAddresses(events, data.baseToken);
      setControllers(fallbackLists.controllers);
      setAllowedInputTokens(fallbackLists.allowedInputTokens);
      setAllowedTokens(fallbackLists.allowedTokens);
    }
  }, [publicClient, vault, events, data.baseToken]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (!depositOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && busy !== "deposit") {
        setDepositOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [depositOpen, busy]);

  const exec = async (label: string, fn: () => Promise<`0x${string}`>) => {
    setBusy(label);
    setError(null);
    try {
      const hash = await fn();
      await publicClient.waitForTransactionReceipt({ hash });
      onRefresh();
      await loadLists();
      if (label === "deposit") {
        setDepositOpen(false);
        setDepositAmount("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setBusy(null);
    }
  };

  const writeVault = (functionName: string, args: unknown[]) =>
    walletClient!.writeContract({
      address: vault,
      abi: OPERATOR_VAULT_ABI,
      functionName: functionName as never,
      args: args as never,
      account: address!,
      chain: walletClient!.chain,
    });

  const copyVaultAddress = async () => {
    try {
      await navigator.clipboard.writeText(vault);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy vault address:", err);
    }
  };

  const netValue = Number(data.balanceUsdt + data.balanceUsdc) / 1e6;
  const chartSeries = generateChartSeries(vault, netValue, activeTimeframe);
  chartSeries[chartSeries.length - 1] = {
    ...chartSeries[chartSeries.length - 1],
    value: netValue,
  };
  const chartGeometry = buildChartGeometry(chartSeries);
  const firstPoint = chartSeries[0]?.value ?? netValue;
  const lastPoint = chartSeries[chartSeries.length - 1]?.value ?? netValue;
  const deltaPercent = firstPoint === 0 ? 0 : ((lastPoint - firstPoint) / firstPoint) * 100;
  const deltaPositive = deltaPercent >= 0;
  const vaultName = deriveVaultName(data.baseToken);

  const depositParsed = parseFloat(depositAmount);
  const canSubmitDeposit =
    isOwner &&
    walletClient &&
    address &&
    Number.isFinite(depositParsed) &&
    depositParsed > 0 &&
    busy === null;

  return (
    <>
      <section className="vault-scene">
        <div className="vault-summary-panel liquid-panel">
            <div className="vault-summary-main">
              <p className="summary-label">Net value</p>
              <div className="summary-value">{formatUsd(netValue)}</div>
              <div className={`summary-delta ${deltaPositive ? "positive" : "negative"}`}>
                <span>{deltaPositive ? "▲" : "▼"}</span>
                <span>{Math.abs(deltaPercent).toFixed(2)}%</span>
                <span className="summary-delta-caption">vs start of {activeTimeframe}</span>
              </div>
            </div>

            <div className="summary-stats">
              <div className="summary-stat">
                <span className="field-label">Base</span>
                <strong>{tokenLabel(data.baseToken)}</strong>
              </div>
              <div className="summary-stat">
                <span className="field-label">Status</span>
                <strong>{data.paused ? "Paused" : "Active"}</strong>
              </div>
              <div className="summary-stat">
                <span className="field-label">Last execution</span>
                <strong>
                  {data.lastExecution > 0n
                    ? new Date(Number(data.lastExecution) * 1000).toLocaleDateString()
                    : "Never"}
                </strong>
              </div>
            </div>

            {isOwner ? (
              <button className="btn btn-primary btn-hero" onClick={() => setDepositOpen(true)}>
                Deposit
              </button>
            ) : null}
        </div>

        <section className="vault-primary-panel liquid-panel">
          <div className="vault-primary-header">
            <div className="vault-tabs" role="tablist" aria-label="Vault views">
              {VAULT_TABS.map((tab) => (
                <button
                  key={tab}
                  className={`vault-tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                  role="tab"
                  aria-selected={activeTab === tab}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "graph" ? (
              <div className="timeframe-pills">
                {TIMEFRAMES.map((timeframe) => (
                  <button
                    key={timeframe}
                    className={`timeframe-pill ${activeTimeframe === timeframe ? "active" : ""}`}
                    onClick={() => setActiveTimeframe(timeframe)}
                  >
                    {timeframe}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {activeTab === "graph" && (
            <div className="graph-panel">
              <div className="graph-meta">
                <p className="eyebrow">Net vault value · USD</p>
                <span className="graph-info" tabIndex={0} aria-label="Chart information">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <circle cx="7" cy="7" r="6.25" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M5.75 5.5C5.75 4.81 6.31 4.25 7 4.25s1.25.56 1.25 1.25c0 .6-.38 1-.75 1.3-.38.3-.75.67-.75 1.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                    <circle cx="7" cy="9.75" r="0.7" fill="currentColor" />
                  </svg>
                  <span className="graph-info-tip" role="tooltip">
                    Historical series is a deterministic presentation layer based on the live vault value until a dedicated net-value indexer lands.
                  </span>
                </span>
              </div>

              <div className="chart-shell">
                <div className="chart-grid">
                  {chartGeometry.ticks.map((_, index) => (
                    <div key={index} className="chart-grid-line" />
                  ))}
                </div>

                <div className="chart-axis-labels">
                  {chartGeometry.ticks.map((tick, index) => (
                    <span key={index}>{formatUsd(tick)}</span>
                  ))}
                </div>

                <svg
                  className="vault-chart"
                  viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                  preserveAspectRatio="none"
                  aria-label="Vault net value chart"
                >
                  <defs>
                    <linearGradient id="vault-chart-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#8686AC" stopOpacity="0.48" />
                      <stop offset="100%" stopColor="#505081" stopOpacity="0.04" />
                    </linearGradient>
                  </defs>
                  <path d={chartGeometry.areaPath} fill="url(#vault-chart-fill)" />
                  <path d={chartGeometry.linePath} fill="none" stroke="#A4A4D1" strokeWidth="3" />
                </svg>

                <div className="chart-footer">
                  <div className="chart-volume">
                    {chartSeries.map((point, index) => (
                      <span
                        key={`${point.label}-${index}`}
                        className="volume-bar"
                        style={{ height: `${Math.max(10, Math.min(point.volume, 100))}%` }}
                      />
                    ))}
                  </div>

                  <div className="chart-labels">
                    {chartSeries.map((point, index) => (
                      <span key={`${point.label}-${index}`}>{point.label}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "policies" && (
            <div className="policies-tab">
              <div className="policies-header">
                <div>
                  <p className="eyebrow">Risk parameters</p>
                  <h3 className="display-text">Vault policy rules</h3>
                </div>
                {isOwner && walletClient && !editingPolicy && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setPolicyDraft({
                        maxAmountPerTrade: (Number(data.maxAmountPerTrade) / 1e6).toString(),
                        maxDailyVolume: (Number(data.maxDailyVolume) / 1e6).toString(),
                        maxSlippageBps: (Number(data.maxSlippageBps) / 100).toString(),
                        cooldownSeconds: Number(data.cooldownSeconds).toString(),
                      });
                      setEditingPolicy(true);
                    }}
                  >
                    Edit Policy
                  </button>
                )}
              </div>

              {!editingPolicy ? (
                <div className="policy-cards">
                  <div className="policy-card">
                    <div className="policy-card-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 2L18 6v6c0 4-3.5 6.5-8 8-4.5-1.5-8-4-8-8V6l8-4z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                      </svg>
                    </div>
                    <span className="policy-card-label">Max per trade</span>
                    <strong className="policy-card-value">{formatUsdFromBigInt(data.maxAmountPerTrade)}</strong>
                    <span className="policy-card-unit">USDT</span>
                  </div>
                  <div className="policy-card">
                    <div className="policy-card-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M10 5v5l3.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <span className="policy-card-label">Daily volume cap</span>
                    <strong className="policy-card-value">{formatUsdFromBigInt(data.maxDailyVolume)}</strong>
                    <span className="policy-card-unit">USDT</span>
                  </div>
                  <div className="policy-card">
                    <div className="policy-card-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M3 17L10 3l7 14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        <path d="M10 11v2M10 15v0.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <span className="policy-card-label">Max slippage</span>
                    <strong className="policy-card-value">{(Number(data.maxSlippageBps) / 100).toFixed(2)}</strong>
                    <span className="policy-card-unit">%</span>
                  </div>
                  <div className="policy-card">
                    <div className="policy-card-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M7 10h6M10 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <span className="policy-card-label">Cooldown</span>
                    <strong className="policy-card-value">{formatCooldown(data.cooldownSeconds)}</strong>
                    <span className="policy-card-unit">between trades</span>
                  </div>
                </div>
              ) : (
                <div className="policy-edit-form" ref={policyFormRef}>
                  <div className="policy-edit-grid">
                    <label className="policy-edit-field">
                      <span className="field-label">Max per trade (USDT)</span>
                      <input
                        type="number"
                        value={policyDraft.maxAmountPerTrade}
                        onChange={(e) => setPolicyDraft({ ...policyDraft, maxAmountPerTrade: e.target.value })}
                        placeholder="e.g. 1000"
                      />
                    </label>
                    <label className="policy-edit-field">
                      <span className="field-label">Daily volume cap (USDT)</span>
                      <input
                        type="number"
                        value={policyDraft.maxDailyVolume}
                        onChange={(e) => setPolicyDraft({ ...policyDraft, maxDailyVolume: e.target.value })}
                        placeholder="e.g. 10000"
                      />
                    </label>
                    <label className="policy-edit-field">
                      <span className="field-label">Max slippage (%)</span>
                      <input
                        type="number"
                        step="0.01"
                        value={policyDraft.maxSlippageBps}
                        onChange={(e) => setPolicyDraft({ ...policyDraft, maxSlippageBps: e.target.value })}
                        placeholder="e.g. 1.5"
                      />
                    </label>
                    <label className="policy-edit-field">
                      <span className="field-label">Cooldown (seconds)</span>
                      <input
                        type="number"
                        value={policyDraft.cooldownSeconds}
                        onChange={(e) => setPolicyDraft({ ...policyDraft, cooldownSeconds: e.target.value })}
                        placeholder="e.g. 60"
                      />
                    </label>
                  </div>
                  <div className="policy-edit-actions">
                    <button
                      className="btn btn-ghost btn-wide"
                      disabled={busy !== null}
                      onClick={() => setEditingPolicy(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary btn-wide"
                      disabled={busy !== null}
                      onClick={() => {
                        const maxTrade = BigInt(Math.round(parseFloat(policyDraft.maxAmountPerTrade) * 1e6));
                        const maxDaily = BigInt(Math.round(parseFloat(policyDraft.maxDailyVolume) * 1e6));
                        const slipBps = BigInt(Math.round(parseFloat(policyDraft.maxSlippageBps) * 100));
                        const cooldown = BigInt(Math.round(parseFloat(policyDraft.cooldownSeconds)));
                        exec("update-policy", () =>
                          writeVault("updatePolicy", [maxTrade, maxDaily, slipBps, cooldown])
                        );
                        setEditingPolicy(false);
                      }}
                    >
                      {busy === "update-policy" ? "Updating..." : "Save Policy"}
                    </button>
                  </div>
                </div>
              )}

              <div className="policy-usage-bar">
                <div className="policy-usage-header">
                  <span className="field-label">Daily volume usage</span>
                  <span className="policy-usage-values">
                    {formatUsdFromBigInt(data.dailyVolumeUsed)} / {formatUsdFromBigInt(data.maxDailyVolume)} USDT
                  </span>
                </div>
                <div className="policy-usage-track">
                  <div
                    className="policy-usage-fill"
                    style={{
                      width: `${data.maxDailyVolume > 0n ? Math.min(Number((data.dailyVolumeUsed * 100n) / data.maxDailyVolume), 100) : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="policy-info-row">
                <div className="policy-info-item">
                  <span className="field-label">Operator</span>
                  <strong>{shortAddr(data.operator)}</strong>
                </div>
                <div className="policy-info-item">
                  <span className="field-label">Last execution</span>
                  <strong>
                    {data.lastExecution > 0n
                      ? new Date(Number(data.lastExecution) * 1000).toLocaleDateString()
                      : "Never"}
                  </strong>
                </div>
                <div className="policy-info-item">
                  <span className="field-label">Next nonce</span>
                  <strong>{data.nextNonce !== null ? data.nextNonce.toString() : "Legacy vault"}</strong>
                </div>
                <div className="policy-info-item">
                  <span className="field-label">USDT balance</span>
                  <strong>{formatUsdFromBigInt(data.balanceUsdt)}</strong>
                </div>
                <div className="policy-info-item">
                  <span className="field-label">USDC balance</span>
                  <strong>{formatUsdFromBigInt(data.balanceUsdc)}</strong>
                </div>
              </div>
            </div>
          )}

          {activeTab === "configuration" && (
            <div className="config-tab">
              <div className="config-nav">
                {(["controllers", "tokens", "emergency"] as ConfigSection[]).map((section) => (
                  <button
                    key={section}
                    className={`config-nav-btn ${configSection === section ? "active" : ""}`}
                    onClick={() => setConfigSection(section)}
                  >
                    {section === "controllers" && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/>
                        <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    )}
                    {section === "tokens" && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
                        <path d="M5.5 8h5M8 5.5v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    )}
                    {section === "emergency" && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2L14.5 13H1.5L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                        <path d="M8 7v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    )}
                    <span>{section === "controllers" ? "Controllers" : section === "tokens" ? "Allowed Tokens" : "Emergency"}</span>
                  </button>
                ))}
              </div>

              {configSection === "controllers" && (
                <div className="config-section">
                  <div className="config-section-header">
                    <div>
                      <h4 className="display-text">Authorized controllers</h4>
                      <p className="muted-copy">
                        Addresses that can submit execution intents to this vault.
                      </p>
                    </div>
                    <span className="config-count">{controllers.length}</span>
                  </div>

                  {controllers.length === 0 ? (
                    <div className="config-empty">
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="12" r="5" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M6 28c0-5.5 4.5-9 10-9s10 3.5 10 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <p>No controllers authorized yet.</p>
                    </div>
                  ) : (
                    <div className="config-list">
                      {controllers.map((controller) => (
                        <div key={controller} className="config-list-item">
                          <div className="config-list-info">
                            <span className="config-list-mono">{shortAddr(controller)}</span>
                            <span className="config-list-full">{controller}</span>
                          </div>
                          {isOwner && walletClient && (
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={busy !== null}
                              onClick={() =>
                                exec("revoke-controller", () => writeVault("revokeController", [controller]))
                              }
                            >
                              {busy === "revoke-controller" ? "..." : "Revoke"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {isOwner && walletClient && (
                    <div className="config-add-form">
                      <label className="field-label" htmlFor="controller-address">
                        Add controller
                      </label>
                      <div className="glass-input-row">
                        <input
                          id="controller-address"
                          type="text"
                          placeholder="0x... controller address"
                          value={controllerInput}
                          onChange={(e) => setControllerInput(e.target.value)}
                        />
                        <button
                          className="btn btn-primary"
                          disabled={busy !== null || !controllerInput.startsWith("0x")}
                          onClick={() => {
                            exec("add-controller", () => writeVault("authorizeController", [controllerInput]));
                            setControllerInput("");
                          }}
                        >
                          {busy === "add-controller" ? "Adding..." : "Authorize"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {configSection === "tokens" && (
                <div className="config-section">
                  <div className="config-section-header">
                    <div>
                      <h4 className="display-text">Asset allowlists</h4>
                      <p className="muted-copy">
                        Separate the assets the vault can spend from the assets it is allowed to receive.
                      </p>
                    </div>
                    <span className="config-count">{allowedInputTokens.length + allowedTokens.length}</span>
                  </div>

                  <div className="config-subsection">
                    <div className="config-subsection-header">
                      <div>
                        <h5>Allowed input / deposit tokens</h5>
                        <p className="muted-copy">
                          Tokens the vault can hold, accept as owner deposits, and spend as `tokenIn`.
                        </p>
                      </div>
                      <span className="config-count">{allowedInputTokens.length}</span>
                    </div>

                    {allowedInputTokens.length === 0 ? (
                      <div className="config-empty">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                          <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M11 16h10M16 11v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <p>No input tokens configured yet.</p>
                      </div>
                    ) : (
                      <div className="config-list">
                        {allowedInputTokens.map((token) => (
                          <div key={token} className="config-list-item">
                            <div className="config-list-info">
                              <span className="config-list-badge">{tokenLabel(token)}</span>
                              <span className="config-list-full">{token}</span>
                            </div>
                            {isOwner && walletClient && (
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={busy !== null}
                                onClick={() =>
                                  exec("remove-input-token", () => writeVault("removeAllowedInputToken", [token]))
                                }
                              >
                                {busy === "remove-input-token" ? "..." : "Remove"}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {isOwner && walletClient && (
                      <div className="config-add-form">
                        <label className="field-label" htmlFor="input-token-address">
                          Add input / deposit token
                        </label>
                        <div className="glass-input-row">
                          <input
                            id="input-token-address"
                            type="text"
                            placeholder="0x... token address"
                            value={inputTokenInput}
                            onChange={(e) => setInputTokenInput(e.target.value)}
                          />
                          <button
                            className="btn btn-primary"
                            disabled={busy !== null || !inputTokenInput.startsWith("0x")}
                            onClick={() => {
                              exec("add-input-token", () => writeVault("addAllowedInputToken", [inputTokenInput]));
                              setInputTokenInput("");
                            }}
                          >
                            {busy === "add-input-token" ? "Adding..." : "Add Token"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="config-subsection">
                    <div className="config-subsection-header">
                      <div>
                        <h5>Allowed output tokens</h5>
                        <p className="muted-copy">
                          Tokens that the vault is allowed to receive as swap output.
                        </p>
                      </div>
                      <span className="config-count">{allowedTokens.length}</span>
                    </div>

                    {allowedTokens.length === 0 ? (
                      <div className="config-empty">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                          <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M11 16h10M16 11v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <p>No output tokens in the allowlist yet.</p>
                      </div>
                    ) : (
                      <div className="config-list">
                        {allowedTokens.map((token) => (
                          <div key={token} className="config-list-item">
                            <div className="config-list-info">
                              <span className="config-list-badge">{tokenLabel(token)}</span>
                              <span className="config-list-full">{token}</span>
                            </div>
                            {isOwner && walletClient && (
                              <button
                                className="btn btn-danger btn-sm"
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
                      <div className="config-add-form">
                        <label className="field-label" htmlFor="token-address">
                          Add output token
                        </label>
                        <div className="glass-input-row">
                          <input
                            id="token-address"
                            type="text"
                            placeholder="0x... token address"
                            value={outputTokenInput}
                            onChange={(e) => setOutputTokenInput(e.target.value)}
                          />
                          <button
                            className="btn btn-primary"
                            disabled={busy !== null || !outputTokenInput.startsWith("0x")}
                            onClick={() => {
                              exec("add-token", () => writeVault("addAllowedToken", [outputTokenInput]));
                              setOutputTokenInput("");
                            }}
                          >
                            {busy === "add-token" ? "Adding..." : "Add Token"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {configSection === "emergency" && (
                <div className="config-section">
                  <div className="config-section-header">
                    <div>
                      <h4 className="display-text">Emergency controls</h4>
                      <p className="muted-copy">
                        Immediately pause or resume all delegated execution at the vault level.
                      </p>
                    </div>
                    <span className={`config-status-badge ${data.paused ? "paused" : "active"}`}>
                      {data.paused ? "Paused" : "Active"}
                    </span>
                  </div>

                  <div className="emergency-panel">
                    <div className="emergency-info">
                      <p>
                        When paused, no controller can execute swaps through this vault.
                        Deposits and withdrawals by the owner remain available.
                      </p>
                    </div>

                    {isOwner && walletClient ? (
                      <button
                        className={`btn ${data.paused ? "btn-primary" : "btn-danger"} btn-wide`}
                        disabled={busy !== null}
                        onClick={() =>
                          exec("pause-toggle", () => writeVault(data.paused ? "unpause" : "pause", []))
                        }
                      >
                        {busy === "pause-toggle"
                          ? "Submitting..."
                          : data.paused
                            ? "Unpause Vault"
                            : "Pause Vault"}
                      </button>
                    ) : (
                      <p className="muted-copy">Only the vault owner can toggle the pause state.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="vault-tokens-panel liquid-panel liquid-panel-soft">
          <div className="history-panel-header">
            <div>
              <p className="eyebrow">Holdings</p>
              <h3 className="display-text">Tokens</h3>
            </div>
          </div>
          <div className="token-rows">
            {[
              { symbol: "USDT", balance: data.balanceUsdt, name: "Tether USD" },
              { symbol: "USDC", balance: data.balanceUsdc, name: "USD Coin" },
            ].map((row) => (
              <div key={row.symbol} className="token-row">
                <span className={`token-badge token-badge-${row.symbol.toLowerCase()}`}>
                  {row.symbol}
                </span>
                <div className="token-row-meta">
                  <strong className="token-row-amount">{formatUsd(Number(row.balance) / 1e6)}</strong>
                  <span className="token-row-sub">{row.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <VaultHistory events={events} loading={historyLoading} />
      </section>

      {error ? <p className="error dashboard-error">{error}</p> : null}

      {depositOpen ? (
        <div className="modal-backdrop" onClick={() => (busy === "deposit" ? null : setDepositOpen(false))}>
          <div className="deposit-modal liquid-panel" onClick={(event) => event.stopPropagation()}>
            <div className="deposit-modal-header">
              <div>
                <p className="eyebrow">Owner deposit</p>
                <h3 className="display-text">Add USDT liquidity</h3>
              </div>
              <button
                className="modal-close"
                onClick={() => (busy === "deposit" ? null : setDepositOpen(false))}
                aria-label="Close deposit modal"
              >
                ×
              </button>
            </div>

            <p className="muted-copy">
              This uses the live onchain flow: first approve USDT, then deposit it into the vault.
            </p>

            <div className="deposit-stat-grid">
              <div className="summary-stat">
                <span className="field-label">Vault</span>
                <strong>{shortAddr(vault)}</strong>
              </div>
              <div className="summary-stat">
                <span className="field-label">Current USDT balance</span>
                <strong>{formatUsdFromBigInt(data.balanceUsdt)} USDT</strong>
              </div>
            </div>

            <label className="field-label" htmlFor="deposit-amount">
              Deposit amount (USDT)
            </label>
            <input
              id="deposit-amount"
              type="number"
              placeholder="Amount in USDT"
              value={depositAmount}
              onChange={(event) => setDepositAmount(event.target.value)}
            />

            <div className="deposit-modal-actions">
              <button className="btn btn-ghost btn-wide" onClick={() => setDepositOpen(false)} disabled={busy === "deposit"}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-wide"
                disabled={!canSubmitDeposit}
                onClick={() => {
                  const amount = BigInt(Math.round(depositParsed * 1e6));
                  exec("deposit", async () => {
                    const approveHash = await walletClient!.writeContract({
                      address: ADDRESSES.usdt,
                      abi: ERC20_ABI,
                      functionName: "approve",
                      args: [vault, amount],
                      account: address!,
                      chain: walletClient!.chain,
                    });
                    await publicClient.waitForTransactionReceipt({ hash: approveHash });
                    return writeVault("deposit", [ADDRESSES.usdt, amount]);
                  });
                }}
              >
                {busy === "deposit" ? "Depositing..." : "Approve & Deposit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
