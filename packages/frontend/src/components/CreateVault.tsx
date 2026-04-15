import { useEffect, useRef, useState } from "react";
import type { WalletClient, PublicClient, Address } from "viem";
import { ADDRESSES, VAULT_FACTORY_ABI } from "../config/contracts";
import { getTokenMeta, TOKEN_REGISTRY, tokenIcon, tokenLabel, tokenName } from "../config/tokens";
import { formatMoneyInput, moneyInputToNumber, moneyInputToUnits } from "../utils/moneyInput";

interface Props {
  walletClient: WalletClient;
  publicClient: PublicClient;
  address: Address;
  onVaultCreated: (vault: Address) => void;
}

const BASE_TOKEN_OPTIONS = Object.entries(TOKEN_REGISTRY).reduce<Address[]>((options, [tokenAddress, meta]) => {
  const alreadyIncluded = options.some((address) => tokenLabel(address) === meta.symbol);
  if (!alreadyIncluded) {
    options.push(tokenAddress as Address);
  }
  return options;
}, []);

export function CreateVault({ walletClient, publicClient, address, onVaultCreated }: Props) {
  const [baseToken, setBaseToken] = useState<Address>(ADDRESSES.usdt);
  const [baseTokenOpen, setBaseTokenOpen] = useState(false);
  const [maxPerTrade, setMaxPerTrade] = useState(formatMoneyInput("5"));
  const [maxDaily, setMaxDaily] = useState(formatMoneyInput("10"));
  const [slippagePercent, setSlippagePercent] = useState("5.0");
  const [cooldown, setCooldown] = useState("10");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baseTokenSelectRef = useRef<HTMLDivElement>(null);
  const baseTokenDecimals = getTokenMeta(baseToken)?.decimals ?? 6;
  const baseTokenIcon = tokenIcon(baseToken);
  const maxPerTradeValue = moneyInputToNumber(maxPerTrade);
  const maxDailyValue = moneyInputToNumber(maxDaily);
  const cooldownValue = Number(cooldown);
  const canCreate =
    Number.isFinite(maxPerTradeValue) &&
    maxPerTradeValue > 0 &&
    Number.isFinite(maxDailyValue) &&
    maxDailyValue > 0 &&
    Number.isFinite(cooldownValue) &&
    cooldownValue >= 0;

  useEffect(() => {
    if (!baseTokenOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!baseTokenSelectRef.current?.contains(event.target as Node)) {
        setBaseTokenOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setBaseTokenOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [baseTokenOpen]);

  const handleCreate = async () => {
    if (!canCreate) return;

    setCreating(true);
    setError(null);
    try {
      const hash = await walletClient.writeContract({
        address: ADDRESSES.factory,
        abi: VAULT_FACTORY_ABI,
        functionName: "createVault",
        args: [
          baseToken,
          moneyInputToUnits(maxPerTrade, baseTokenDecimals),
          moneyInputToUnits(maxDaily, baseTokenDecimals),
          BigInt(Math.round(Number(slippagePercent) * 100)),
          BigInt(Math.round(cooldownValue)),
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
      {/* Row 1: Base Token full width */}
      <div className="cv-section">
        <label className="cv-field">
          <span className="cv-label">Base Token</span>
          <div
            ref={baseTokenSelectRef}
            className={`base-token-select cv-token-select ${baseTokenOpen ? "open" : ""}`}
          >
            <button
              type="button"
              className="base-token-select-trigger"
              onClick={() => setBaseTokenOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={baseTokenOpen}
            >
              <span className="token-with-icon">
                {baseTokenIcon ? <img src={baseTokenIcon} alt="" className="token-icon-sm" /> : null}
                <span className="base-token-trigger-copy">
                  <strong className="base-token-symbol">{tokenLabel(baseToken)}</strong>
                  <span className="vault-chip-address">{tokenName(baseToken)}</span>
                </span>
              </span>
              <span className="base-token-chevron" aria-hidden="true">
                {baseTokenOpen ? "▴" : "▾"}
              </span>
            </button>

            {baseTokenOpen ? (
              <div className="base-token-menu" role="listbox" aria-label="Base token options">
                {BASE_TOKEN_OPTIONS.map((tokenAddress) => {
                  const selected = baseToken.toLowerCase() === tokenAddress.toLowerCase();
                  const icon = tokenIcon(tokenAddress);

                  return (
                    <button
                      key={tokenAddress}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`base-token-option ${selected ? "selected" : ""}`}
                      onClick={() => {
                        setBaseToken(tokenAddress);
                        setBaseTokenOpen(false);
                      }}
                    >
                      <span className="token-with-icon">
                        {icon ? <img src={icon} alt="" className="token-icon-sm" /> : null}
                        <span className="base-token-trigger-copy">
                          <strong className="base-token-symbol">{tokenLabel(tokenAddress)}</strong>
                          <span className="vault-chip-address">{tokenName(tokenAddress)}</span>
                        </span>
                      </span>
                      {selected ? <span className="base-token-check">✓</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </label>
      </div>

      {/* Row 2: Limits side by side */}
      <div className="cv-section">
        <span className="cv-section-title">Limits</span>
        <div className="cv-row">
          <label className="cv-field">
            <span className="cv-label">Max per Trade</span>
            <div className="money-input-shell">
              <span className="money-input-prefix">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={maxPerTrade}
                onChange={(event) => setMaxPerTrade(formatMoneyInput(event.target.value))}
                placeholder="1,000.00"
              />
            </div>
          </label>
          <label className="cv-field">
            <span className="cv-label">Max Daily Volume</span>
            <div className="money-input-shell">
              <span className="money-input-prefix">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={maxDaily}
                onChange={(event) => setMaxDaily(formatMoneyInput(event.target.value))}
                placeholder="10,000.00"
              />
            </div>
          </label>
        </div>
      </div>

      {/* Row 3: Risk controls side by side */}
      <div className="cv-section">
        <span className="cv-section-title">Risk Controls</span>
        <div className="cv-row">
          <label className="cv-field">
            <span className="cv-label">Max Slippage</span>
            <div className="slider-field">
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={slippagePercent}
                onChange={(event) => setSlippagePercent(event.target.value)}
              />
              <div className="slider-meta">
                <span>0%</span>
                <strong>{Number(slippagePercent).toFixed(1)}%</strong>
                <span>100%</span>
              </div>
            </div>
          </label>
          <label className="cv-field">
            <span className="cv-label">Cooldown</span>
            <div className="cv-cooldown-shell">
              <input
                type="number"
                min="0"
                value={cooldown}
                onChange={(event) => setCooldown(event.target.value)}
              />
              <span className="cv-cooldown-unit">sec</span>
            </div>
          </label>
        </div>
      </div>

      <div className="cv-actions">
        <button onClick={handleCreate} disabled={creating || !canCreate} className="btn btn-primary btn-xl cv-submit">
          {creating ? "Deploying..." : "Create Vault"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
}
