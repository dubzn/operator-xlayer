import { useState } from "react";
import type { WalletClient, PublicClient, Address } from "viem";
import { ADDRESSES, VAULT_FACTORY_ABI } from "../config/contracts";

interface Props {
  walletClient: WalletClient;
  publicClient: PublicClient;
  address: Address;
  onVaultCreated: (vault: Address) => void;
}

export function CreateVault({ walletClient, publicClient, address, onVaultCreated }: Props) {
  const [maxPerTrade, setMaxPerTrade] = useState("5");
  const [maxDaily, setMaxDaily] = useState("10");
  const [slippageBps, setSlippageBps] = useState("500");
  const [cooldown, setCooldown] = useState("10");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const hash = await walletClient.writeContract({
        address: ADDRESSES.factory,
        abi: VAULT_FACTORY_ABI,
        functionName: "createVault",
        args: [
          ADDRESSES.usdt,
          BigInt(parseFloat(maxPerTrade) * 1e6),
          BigInt(parseFloat(maxDaily) * 1e6),
          BigInt(slippageBps),
          BigInt(cooldown),
        ],
        account: address,
        chain: walletClient.chain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Parse VaultCreated event to get vault address
      const log = receipt.logs.find(
        (l) => l.topics[0] === "0x15120e52907e2bf0e2e079c3ddaf6c5a1aadb5cca22f0f0e0bca77b0e5be23e7"
      );

      if (log && log.topics[2]) {
        const vaultAddr = ("0x" + log.topics[2].slice(26)) as Address;
        onVaultCreated(vaultAddr);
      } else {
        // Fallback: read from factory
        const vaults = await publicClient.readContract({
          address: ADDRESSES.factory,
          abi: VAULT_FACTORY_ABI,
          functionName: "getVaultsByOwner",
          args: [address],
        });
        if (vaults.length > 0) {
          onVaultCreated(vaults[vaults.length - 1] as Address);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create vault");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="card">
      <h2>Create Vault</h2>
      <p className="subtitle">Deploy your own OperatorVault via the factory</p>

      <div className="form-grid">
        <label>
          Base Token
          <input value="USDT" disabled />
        </label>
        <label>
          Max per Trade (USDT)
          <input type="number" value={maxPerTrade} onChange={(e) => setMaxPerTrade(e.target.value)} />
        </label>
        <label>
          Max Daily Volume (USDT)
          <input type="number" value={maxDaily} onChange={(e) => setMaxDaily(e.target.value)} />
        </label>
        <label>
          Max Slippage (bps)
          <input type="number" value={slippageBps} onChange={(e) => setSlippageBps(e.target.value)} />
        </label>
        <label>
          Cooldown (seconds)
          <input type="number" value={cooldown} onChange={(e) => setCooldown(e.target.value)} />
        </label>
      </div>

      <button onClick={handleCreate} disabled={creating} className="btn btn-primary">
        {creating ? "Deploying..." : "Create Vault"}
      </button>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
