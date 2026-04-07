export interface ExecutionIntent {
  vaultAddress: string;
  controller: string;
  tokenIn: string;
  tokenOut: string;
  amount: string; // bigint as string for JSON serialization
  maxSlippageBps: number;
  nonce: number;
  deadline: number;
}

export interface ExecutionReceipt {
  jobId: string;
  vaultAddress: string;
  controller: string;
  operator: string;
  paymentReference: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  timestamp: number;
  status: "success" | "failed";
}

export interface ExecuteRequest {
  intent: ExecutionIntent;
  signature: string;
  paymentReference?: string;
}

export interface PreviewRequest {
  intent: ExecutionIntent;
}

export interface ExecuteResponse {
  status: "success" | "failed";
  jobId: string;
  txHash: string;
}

export interface ExecutionPreview {
  jobClass: "single-swap";
  vaultAddress: string;
  estimatedFee: {
    amount: string;
    token: string;
  };
  quotedRoute: {
    routerAddress: string;
    hasRouteData: boolean;
    expectedOut: string;
  };
  riskFlags: string[];
  warnings: string[];
  policyCheckSummary: {
    controllerAuthorized: boolean;
    nonceAvailable: boolean;
    tokenInMatchesBaseToken: boolean;
    tokenOutAllowed: boolean;
    amountWithinLimit: boolean;
    withinDailyVolume: boolean;
    cooldownMet: boolean;
    vaultNotPaused: boolean;
    effectiveMaxSlippageBps: number;
  };
  expiresAt: number;
}

export interface TrackRecord {
  operator: string;
  successCount: string;
}

export interface PaymentChallenge {
  fee: string;
  token: string;
  paymentAddress: string;
  message: string;
}
