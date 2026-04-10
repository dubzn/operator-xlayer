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
      const log = receipt.logs.find(
        (entry) =>
          entry.topics[0] ===
          "0x15120e52907e2bf0e2e079c3ddaf6c5a1aadb5cca22f0f0e0bca77b0e5be23e7"
      );

      if (log && log.topics[2]) {
        const vaultAddress = `0x${log.topics[2].slice(26)}` as Address;
        onVaultCreated(vaultAddress);
      } else {
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
    <section className="create-vault-panel liquid-panel">
      <div className="create-vault-copy">
        <p className="eyebrow">Vault builder</p>
        <h2 className="display-text">Deploy a new liquid shell</h2>
        <p className="muted-copy">
          Base token is fixed to USDT in this flow. Tune limits, slippage, and cooldown
          before shipping the vault to the factory.
        </p>
      </div>

      <div className="create-vault-grid">
        <label>
          <span className="field-label">Base Token</span>
          <input value="USDT" disabled />
        </label>
        <label>
          <span className="field-label">Max per Trade (USDT)</span>
          <input
            type="number"
            value={maxPerTrade}
            onChange={(event) => setMaxPerTrade(event.target.value)}
          />
        </label>
        <label>
          <span className="field-label">Max Daily Volume (USDT)</span>
          <input
            type="number"
            value={maxDaily}
            onChange={(event) => setMaxDaily(event.target.value)}
          />
        </label>
        <label>
          <span className="field-label">Max Slippage (bps)</span>
          <input
            type="number"
            value={slippageBps}
            onChange={(event) => setSlippageBps(event.target.value)}
          />
        </label>
        <label>
          <span className="field-label">Cooldown (seconds)</span>
          <input
            type="number"
            value={cooldown}
            onChange={(event) => setCooldown(event.target.value)}
          />
        </label>
      </div>

      <div className="create-vault-actions">
        <button onClick={handleCreate} disabled={creating} className="btn btn-primary btn-wide">
          {creating ? "Deploying..." : "Create Vault"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
}
