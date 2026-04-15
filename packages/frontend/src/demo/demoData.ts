import type { Address } from "viem";
import type { VaultData } from "../hooks/useVaultData";
import type { IndexedEvent } from "../hooks/useVaultHistory";
import { ADDRESSES } from "../config/contracts";

// ── Demo wallet ──
export const DEMO_WALLET = import.meta.env.VITE_DEMO_WALLET as Address | undefined;

export function isDemoMode(): boolean {
  return Boolean(DEMO_WALLET);
}

// ── Two demo vault addresses ──
export const DEMO_VAULT_A = "0xAA00000000000000000000000000000000000001" as Address; // USDT vault
export const DEMO_VAULT_B = "0xBB00000000000000000000000000000000000002" as Address; // USDC vault

export const DEMO_VAULTS: Address[] = [DEMO_VAULT_A, DEMO_VAULT_B];

// ── Vault data ──
const NOW_S = BigInt(Math.floor(Date.now() / 1000));

export function getDemoVaultData(vault: Address): VaultData {
  if (vault.toLowerCase() === DEMO_VAULT_B.toLowerCase()) {
    // USDC conservative vault — lower limits, tighter slippage
    return {
      owner: DEMO_WALLET!,
      baseToken: ADDRESSES.usdc,
      operator: ADDRESSES.operator,
      paused: false,
      maxAmountPerTrade: 25_000000n,    // $25
      maxDailyVolume: 80_000000n,       // $80
      maxSlippageBps: 150n,             // 1.5%
      cooldownSeconds: 30n,
      dailyVolumeUsed: 34_200000n,
      lastExecution: NOW_S - 1200n,
      nextNonce: 47n,
      balanceUsdt: 28_500000n,          // $28.50 USDT
      balanceUsdc: 95_750000n,          // $95.75 USDC
    };
  }

  // USDT aggressive vault — higher limits, wider slippage
  return {
    owner: DEMO_WALLET!,
    baseToken: ADDRESSES.usdt,
    operator: ADDRESSES.operator,
    paused: false,
    maxAmountPerTrade: 50_000000n,      // $50
    maxDailyVolume: 150_000000n,        // $150
    maxSlippageBps: 500n,               // 5%
    cooldownSeconds: 10n,
    dailyVolumeUsed: 62_000000n,
    lastExecution: NOW_S - 300n,
    nextNonce: 128n,
    balanceUsdt: 112_400000n,           // $112.40 USDT
    balanceUsdc: 45_800000n,            // $45.80 USDC
  };
}

// ── History events ──
function makeTxHash(index: number): string {
  return `0x${index.toString(16).padStart(64, "a")}`;
}

const BASE_BLOCK = 9_500_000;
// Ensure all demo events fall on or after April 15, 2026 so they pass the history filter
const APRIL_15_2026 = Math.floor(new Date(2026, 3, 15, 0, 0, 0, 0).getTime() / 1000);
const NOW = Math.floor(Date.now() / 1000);
const BASE_TS = Math.max(NOW, APRIL_15_2026 + 86400 * 4); // at least 4 days after April 15

// WOKB price ~$85.62 → 1 USDT buys ~0.01168 WOKB (18 decimals)
// Helper: convert USD amount to WOKB units (18 decimals) at ~$85.62
function usdToWokb(usd: number): string {
  const wokbAmount = usd / 85.62;
  // 18 decimals
  return BigInt(Math.round(wokbAmount * 1e18)).toString();
}

function buildDemoHistory(vault: Address, baseToken: Address): IndexedEvent[] {
  const isVaultA = vault.toLowerCase() === DEMO_VAULT_A.toLowerCase();
  const offset = isVaultA ? 0 : 100;
  const wokb = ADDRESSES.wokb;

  const events: IndexedEvent[] = [
    // Deposit
    {
      vault,
      type: "Deposit",
      blockNumber: BASE_BLOCK + offset,
      txHash: makeTxHash(1 + offset),
      timestamp: BASE_TS - 86400 * 3,
      data: { token: baseToken, amount: isVaultA ? "150000000" : "120000000" },
    },
    // Controller authorized
    {
      vault,
      type: "ControllerAuthorized",
      blockNumber: BASE_BLOCK + offset + 1,
      txHash: makeTxHash(2 + offset),
      timestamp: BASE_TS - 86400 * 3 + 120,
      data: { controller: ADDRESSES.operator },
    },
    // Swap 1: USDT → WOKB (buy OKB)
    {
      vault,
      type: "ExecutionSucceeded",
      blockNumber: BASE_BLOCK + offset + 10,
      txHash: makeTxHash(3 + offset),
      timestamp: BASE_TS - 86400 * 2,
      data: {
        tokenIn: baseToken,
        tokenOut: wokb,
        amountIn: isVaultA ? "18500000" : "12000000",     // $18.50 / $12 USDT
        amountOut: isVaultA ? usdToWokb(18.50) : usdToWokb(12),
      },
    },
    // Swap 2: WOKB → USDT (sell OKB at slightly higher price)
    {
      vault,
      type: "ExecutionSucceeded",
      blockNumber: BASE_BLOCK + offset + 20,
      txHash: makeTxHash(4 + offset),
      timestamp: BASE_TS - 86400 * 1.5,
      data: {
        tokenIn: wokb,
        tokenOut: baseToken,
        amountIn: isVaultA ? usdToWokb(9.20) : usdToWokb(7.50),
        amountOut: isVaultA ? "9230000" : "7520000",       // $9.23 / $7.52 USDT
      },
    },
    // Swap 3: USDT → WOKB
    {
      vault,
      type: "ExecutionSucceeded",
      blockNumber: BASE_BLOCK + offset + 30,
      txHash: makeTxHash(5 + offset),
      timestamp: BASE_TS - 86400,
      data: {
        tokenIn: baseToken,
        tokenOut: wokb,
        amountIn: isVaultA ? "22000000" : "15000000",     // $22 / $15
        amountOut: isVaultA ? usdToWokb(22.05) : usdToWokb(15.03),
      },
    },
    // Swap 4: WOKB → USDT
    {
      vault,
      type: "ExecutionSucceeded",
      blockNumber: BASE_BLOCK + offset + 40,
      txHash: makeTxHash(6 + offset),
      timestamp: BASE_TS - 3600 * 8,
      data: {
        tokenIn: wokb,
        tokenOut: baseToken,
        amountIn: isVaultA ? usdToWokb(14) : usdToWokb(8),
        amountOut: isVaultA ? "14040000" : "8015000",      // $14.04 / $8.015
      },
    },
    // Swap 5: USDT → WOKB (recent)
    {
      vault,
      type: "ExecutionSucceeded",
      blockNumber: BASE_BLOCK + offset + 50,
      txHash: makeTxHash(7 + offset),
      timestamp: BASE_TS - 1800,
      data: {
        tokenIn: baseToken,
        tokenOut: wokb,
        amountIn: isVaultA ? "11000000" : "6500000",      // $11 / $6.50
        amountOut: isVaultA ? usdToWokb(11.03) : usdToWokb(6.51),
      },
    },
  ];

  return events.sort((a, b) => b.timestamp - a.timestamp || b.blockNumber - a.blockNumber);
}

// ── Mutable demo state ──
// We keep mutable arrays so Ctrl+K can push new events and update balances.

interface DemoState {
  vaultDataOverrides: Map<string, Partial<VaultData>>;
  extraEvents: Map<string, IndexedEvent[]>;
  listeners: Set<() => void>;
  simulationCounter: number;
}

const state: DemoState = {
  vaultDataOverrides: new Map(),
  extraEvents: new Map(),
  listeners: new Set(),
  simulationCounter: 0,
};

export function subscribeDemoUpdates(listener: () => void): () => void {
  state.listeners.add(listener);
  return () => { state.listeners.delete(listener); };
}

function notifyListeners() {
  for (const listener of state.listeners) {
    listener();
  }
}

export function getDemoEvents(vault: Address): IndexedEvent[] {
  const baseToken = vault.toLowerCase() === DEMO_VAULT_B.toLowerCase() ? ADDRESSES.usdc : ADDRESSES.usdt;
  const base = buildDemoHistory(vault, baseToken);
  const extra = state.extraEvents.get(vault.toLowerCase()) ?? [];
  return [...extra, ...base].sort((a, b) => b.timestamp - a.timestamp || b.blockNumber - a.blockNumber);
}

export function getDemoVaultDataLive(vault: Address): VaultData {
  const base = getDemoVaultData(vault);
  const overrides = state.vaultDataOverrides.get(vault.toLowerCase());
  if (!overrides) return base;
  return { ...base, ...overrides };
}

// ── Ctrl+K simulation ──
export function simulateNewOperation() {
  state.simulationCounter += 1;
  const counter = state.simulationCounter;
  const now = Math.floor(Date.now() / 1000);

  // Alternate between vaults
  const vault = counter % 2 === 1 ? DEMO_VAULT_A : DEMO_VAULT_B;
  const vaultKey = vault.toLowerCase();
  const isA = vault === DEMO_VAULT_A;
  const baseToken = isA ? ADDRESSES.usdt : ADDRESSES.usdc;
  const wokb = ADDRESSES.wokb;

  // Alternate swap direction: buy WOKB or sell WOKB
  const isBuyWokb = counter % 3 !== 0;
  const tokenIn = isBuyWokb ? baseToken : wokb;
  const tokenOut = isBuyWokb ? wokb : baseToken;

  // Random-ish USD amounts based on counter ($3-$25)
  const usdAmount = isA
    ? 5 + (counter * 7) % 20
    : 3 + (counter * 5) % 15;
  const slippageMul = 1 + (counter % 5) * 0.002;
  const usdOut = Math.round(usdAmount * slippageMul * 100) / 100;

  // Format amounts with correct decimals: USDT/USDC = 6 decimals, WOKB = 18 decimals
  let amountIn: string;
  let amountOut: string;
  if (isBuyWokb) {
    amountIn = Math.round(usdAmount * 1_000000).toString();
    amountOut = usdToWokb(usdOut);
  } else {
    amountIn = usdToWokb(usdAmount);
    amountOut = Math.round(usdOut * 1_000000).toString();
  }

  const newEvent: IndexedEvent = {
    vault,
    type: "ExecutionSucceeded",
    blockNumber: BASE_BLOCK + 1000 + counter,
    txHash: makeTxHash(2000 + counter),
    timestamp: now,
    data: { tokenIn, tokenOut, amountIn, amountOut },
  };

  // Push event
  const existing = state.extraEvents.get(vaultKey) ?? [];
  state.extraEvents.set(vaultKey, [newEvent, ...existing]);

  // Update balances — only USDT/USDC side changes, WOKB isn't tracked in VaultData
  const currentData = getDemoVaultData(vault);
  const prev = state.vaultDataOverrides.get(vaultKey) ?? {};
  const prevUsdt = prev.balanceUsdt ?? currentData.balanceUsdt;
  const prevUsdc = prev.balanceUsdc ?? currentData.balanceUsdc;
  const prevVolume = prev.dailyVolumeUsed ?? currentData.dailyVolumeUsed;

  const usdDelta = BigInt(Math.round(usdAmount * 1_000000));
  const usdDeltaOut = BigInt(Math.round(usdOut * 1_000000));

  let newUsdt = prevUsdt;
  let newUsdc = prevUsdc;

  if (isBuyWokb) {
    // Spending stablecoin to buy WOKB
    if (baseToken.toLowerCase() === ADDRESSES.usdt.toLowerCase()) {
      newUsdt = prevUsdt > usdDelta ? prevUsdt - usdDelta : 0n;
    } else {
      newUsdc = prevUsdc > usdDelta ? prevUsdc - usdDelta : 0n;
    }
  } else {
    // Selling WOKB back for stablecoin
    if (baseToken.toLowerCase() === ADDRESSES.usdt.toLowerCase()) {
      newUsdt = prevUsdt + usdDeltaOut;
    } else {
      newUsdc = prevUsdc + usdDeltaOut;
    }
  }

  state.vaultDataOverrides.set(vaultKey, {
    ...prev,
    balanceUsdt: newUsdt,
    balanceUsdc: newUsdc,
    dailyVolumeUsed: prevVolume + usdDelta,
    lastExecution: BigInt(now),
  });

  notifyListeners();
}
