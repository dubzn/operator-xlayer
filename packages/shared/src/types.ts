export interface ExecutionIntent {
  vaultAddress: string;
  controller: string;
  adapter: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  quotedAmountOut: string;
  minAmountOut: string;
  nonce: number;
  deadline: number;
  executionHash: string;
}

export interface RoutePreferences {
  dexIds?: string[];
  excludeDexIds?: string[];
}

export interface ExecutionReceipt {
  jobId: string;
  vaultAddress: string;
  controller: string;
  operator: string;
  adapter: string;
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
  routePreferences?: RoutePreferences;
}

export interface ExecuteResponse {
  status: "success" | "failed";
  jobId: string;
  txHash: string;
}

export interface ExecutionPreview {
  jobClass: "swap-v2";
  vaultAddress: string;
  estimatedFee: {
    amount: string;
    token: string;
  };
  quotedRoute: {
    adapterAddress: string;
    routerAddress: string;
    hasRouteData: boolean;
    expectedOut: string;
    minAmountOut: string;
    executionHash: string;
  };
  riskFlags: string[];
  warnings: string[];
  routePreferencesApplied: RoutePreferences;
  policyCheckSummary: {
    operatorMatchesBackend: boolean;
    registryAuthorized: boolean;
    controllerAuthorized: boolean;
    adapterAllowed: boolean;
    nonceAvailable: boolean;
    inputTokenAllowed: boolean;
    outputTokenAllowed: boolean;
    pairAllowed: boolean;
    amountWithinLimit: boolean;
    withinDailyVolume: boolean;
    cooldownMet: boolean;
    vaultNotPaused: boolean;
    policyMinAmountOut: string;
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
