import { useState, useEffect, useCallback } from "react";
import type { PublicClient, Address } from "viem";
import { ADDRESSES, VAULT_FACTORY_ABI } from "../config/contracts";

interface Props {
  publicClient: PublicClient;
  address: Address;
  selectedVault: Address | null;
  onSelect: (vault: Address) => void;
}

export function VaultSelector({ publicClient, address, selectedVault, onSelect }: Props) {
  const [vaults, setVaults] = useState<Address[]>([]);
  const [manualInput, setManualInput] = useState("");

  const fetchVaults = useCallback(() => {
    publicClient
      .readContract({
        address: ADDRESSES.factory,
        abi: VAULT_FACTORY_ABI,
        functionName: "getVaultsByOwner",
        args: [address],
      })
      .then((result) => setVaults(result as Address[]))
      .catch(console.error);
  }, [publicClient, address]);

  useEffect(() => {
    fetchVaults();
  }, [fetchVaults, selectedVault]);

  return (
    <section className="vault-selector liquid-panel liquid-panel-soft">
      <div className="vault-selector-header">
        <div>
          <p className="eyebrow">Vault workspace</p>
          <h2 className="display-text">Open a live vault</h2>
        </div>
        <span className="selector-count">{vaults.length} tracked</span>
      </div>

      {vaults.length === 0 ? (
        <p className="muted-copy selector-empty">
          No vaults found for this wallet yet. You can still load a vault address manually.
        </p>
      ) : (
        <div className="vault-chip-grid">
          {vaults.map((vault) => (
            <button
              key={vault}
              className={`vault-chip ${
                selectedVault?.toLowerCase() === vault.toLowerCase() ? "selected" : ""
              }`}
              onClick={() => onSelect(vault)}
            >
              <span className="vault-chip-title">Vault</span>
              <span className="display-text vault-chip-address">
                {vault.slice(0, 6)}...{vault.slice(-4)}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="selector-manual">
        <label className="field-label" htmlFor="manual-vault-address">
          Manual vault address
        </label>
        <div className="glass-input-row">
          <input
            id="manual-vault-address"
            type="text"
            placeholder="0x... vault address"
            value={manualInput}
            onChange={(event) => setManualInput(event.target.value)}
          />
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (manualInput.startsWith("0x")) {
                onSelect(manualInput as Address);
              }
            }}
          >
            Load
          </button>
        </div>
      </div>
    </section>
  );
}
