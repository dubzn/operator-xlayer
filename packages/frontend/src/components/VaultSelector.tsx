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
    <div className="card">
      <h2>Your Vaults</h2>

      {vaults.length === 0 ? (
        <p className="subtitle">No vaults found. Create one or enter an address below.</p>
      ) : (
        <div className="vault-list">
          {vaults.map((v) => (
            <button
              key={v}
              className={`vault-item ${selectedVault?.toLowerCase() === v.toLowerCase() ? "selected" : ""}`}
              onClick={() => onSelect(v)}
            >
              {v.slice(0, 6)}...{v.slice(-4)}
            </button>
          ))}
        </div>
      )}

      <div className="action-row" style={{ marginTop: "1rem" }}>
        <input
          type="text"
          placeholder="0x... vault address"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
        />
        <button
          className="btn btn-sm"
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
  );
}
