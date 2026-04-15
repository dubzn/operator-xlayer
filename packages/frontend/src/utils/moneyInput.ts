import { formatUnits, parseUnits } from "viem";

function groupThousands(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatMoneyInput(value: string, maxFractionDigits = 6): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";

  const [rawWhole = "", ...rest] = cleaned.split(".");
  const rawFraction = rest.join("").slice(0, maxFractionDigits);
  const hasDot = cleaned.includes(".");
  const whole = rawWhole.replace(/^0+(?=\d)/, "") || "0";
  const groupedWhole = groupThousands(whole);

  if (!hasDot) return groupedWhole;
  return `${groupedWhole}.${rawFraction}`;
}

export function parseMoneyInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";

  const [rawWhole = "", ...rest] = cleaned.split(".");
  const rawFraction = rest.join("");
  const whole = rawWhole.replace(/^0+(?=\d)/, "") || "0";

  if (!rest.length || rawFraction.length === 0) return whole;
  return `${whole}.${rawFraction}`;
}

export function moneyInputToNumber(value: string): number {
  const parsed = parseMoneyInput(value);
  return parsed ? Number(parsed) : Number.NaN;
}

export function moneyInputToUnits(value: string, decimals: number): bigint {
  const parsed = parseMoneyInput(value);
  if (!parsed) return 0n;
  return parseUnits(parsed, decimals);
}

export function unitsToMoneyInput(value: bigint, decimals: number, maxFractionDigits = 2): string {
  const formatted = formatUnits(value, decimals);
  const [whole, rawFraction = ""] = formatted.split(".");
  const fraction = rawFraction.slice(0, maxFractionDigits).replace(/0+$/, "");
  const groupedWhole = groupThousands(whole);

  if (!fraction) return groupedWhole;
  return `${groupedWhole}.${fraction}`;
}
