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
  paymentRef: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  timestamp: number;
  success: boolean;
}

export interface ExecuteRequest {
  intent: ExecutionIntent;
  signature: string;
  paymentReference?: string;
}

export interface ExecuteResponse {
  status: "success" | "failed";
  jobId: string;
  txHash: string;
}

export interface PaymentChallenge {
  fee: string;
  token: string;
  paymentAddress: string;
  message: string;
}
