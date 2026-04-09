import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const LEDGER_PATH = resolve(process.cwd(), "payment-ledger.json");

let consumedPaymentReferences: Set<string>;

function load(): Set<string> {
  if (existsSync(LEDGER_PATH)) {
    const data = JSON.parse(readFileSync(LEDGER_PATH, "utf-8"));
    return new Set(data);
  }
  return new Set();
}

function save(): void {
  writeFileSync(LEDGER_PATH, JSON.stringify([...consumedPaymentReferences]), "utf-8");
}

function getSet(): Set<string> {
  if (!consumedPaymentReferences) {
    consumedPaymentReferences = load();
  }
  return consumedPaymentReferences;
}

function normalizePaymentReference(paymentReference: string): string {
  return paymentReference.toLowerCase();
}

/**
 * Marks a payment reference as consumed.
 * Returns false if the same payment reference has already been used.
 * Persists to payment-ledger.json.
 */
export function consumePaymentReference(paymentReference: string): boolean {
  const normalized = normalizePaymentReference(paymentReference);
  const set = getSet();

  if (set.has(normalized)) {
    return false;
  }

  set.add(normalized);
  save();
  return true;
}
