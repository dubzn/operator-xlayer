const consumedPaymentReferences = new Set<string>();

function normalizePaymentReference(paymentReference: string): string {
  return paymentReference.toLowerCase();
}

/**
 * Marks a payment reference as consumed.
 * Returns false if the same payment reference has already been used.
 *
 * This is an in-memory MVP guardrail. It prevents obvious double-spend
 * behavior inside a single backend instance, but it is not durable across
 * restarts yet.
 */
export function consumePaymentReference(paymentReference: string): boolean {
  const normalized = normalizePaymentReference(paymentReference);
  if (consumedPaymentReferences.has(normalized)) {
    return false;
  }

  consumedPaymentReferences.add(normalized);
  return true;
}
