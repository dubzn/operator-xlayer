import { ethers } from "ethers";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getProvider } from "../config.js";

const EVENTS_PATH = resolve(process.cwd(), "vault-events.json");
const POLL_INTERVAL = 5_000; // 5s

// Events we index from OperatorVault
const VAULT_IFACE = new ethers.Interface([
  "event ExecutionSucceeded(bytes32 indexed jobId, address indexed controller, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)",
  "event Deposit(address indexed token, uint256 amount)",
  "event Withdraw(address indexed token, uint256 amount, address indexed to)",
  "event ControllerAuthorized(address indexed controller)",
  "event ControllerRevoked(address indexed controller)",
  "event Paused()",
  "event Unpaused()",
]);

export interface IndexedEvent {
  vault: string;
  type: string;
  blockNumber: number;
  txHash: string;
  timestamp: number;
  data: Record<string, string>;
}

interface IndexerState {
  lastBlock: number;
  events: IndexedEvent[];
}

let state: IndexerState;
const watchedVaults = new Set<string>();

function load(): IndexerState {
  if (existsSync(EVENTS_PATH)) {
    return JSON.parse(readFileSync(EVENTS_PATH, "utf-8"));
  }
  return { lastBlock: 0, events: [] };
}

function save(): void {
  writeFileSync(EVENTS_PATH, JSON.stringify(state, null, 2), "utf-8");
}

function getState(): IndexerState {
  if (!state) {
    state = load();
  }
  return state;
}

export function registerVault(vaultAddress: string): void {
  watchedVaults.add(vaultAddress.toLowerCase());
}

export function getEventsForVault(vaultAddress: string): IndexedEvent[] {
  return getState().events.filter(
    (e) => e.vault.toLowerCase() === vaultAddress.toLowerCase()
  );
}

export function getAllEvents(): IndexedEvent[] {
  return getState().events;
}

async function pollEvents(): Promise<void> {
  if (watchedVaults.size === 0) return;

  const provider = getProvider();
  const s = getState();

  try {
    const currentBlock = await provider.getBlockNumber();

    // On first run, start from current block (only index new events going forward)
    if (s.lastBlock === 0) {
      s.lastBlock = currentBlock;
      save();
      console.log(`[indexer] Initialized at block ${currentBlock}`);
      return;
    }

    // Nothing new
    if (currentBlock <= s.lastBlock) return;

    // X Layer testnet limits getLogs to 100 blocks
    const fromBlock = s.lastBlock + 1;
    const toBlock = Math.min(currentBlock, fromBlock + 99);

    for (const vaultAddr of watchedVaults) {
      const logs = await provider.getLogs({
        address: vaultAddr,
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        try {
          const parsed = VAULT_IFACE.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (!parsed) continue;

          // Avoid duplicates
          const exists = s.events.some(
            (e) => e.txHash === log.transactionHash && e.type === parsed.name
          );
          if (exists) continue;

          // Get block timestamp
          let timestamp = 0;
          try {
            const block = await provider.getBlock(log.blockNumber);
            timestamp = block?.timestamp ?? 0;
          } catch {
            // skip
          }

          const data: Record<string, string> = {};
          for (const input of parsed.fragment.inputs) {
            const val = parsed.args.getValue(input.name);
            if (val !== undefined) {
              data[input.name] = String(val);
            }
          }

          s.events.push({
            vault: vaultAddr,
            type: parsed.name,
            blockNumber: log.blockNumber,
            txHash: log.transactionHash,
            timestamp,
            data,
          });
        } catch {
          // not our event, skip
        }
      }
    }

    s.lastBlock = toBlock;
    save();
  } catch (err) {
    console.error("[indexer] Poll error:", err);
  }
}

export function startIndexer(): void {
  console.log("[indexer] Starting event indexer...");
  // Initial poll
  pollEvents();
  // Then poll every POLL_INTERVAL
  setInterval(pollEvents, POLL_INTERVAL);
}
