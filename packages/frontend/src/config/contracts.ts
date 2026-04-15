export const CHAIN_ID = 196;

export const RPC_URL = "https://rpc.xlayer.tech";
export const EXPLORER_URL = "https://www.okx.com/explorer/xlayer";
export const NATIVE_SYMBOL = "OKB";

export const ADDRESSES = {
  factory: "0x9b9453B159E67563ae4656841CB53F71fD64B557" as `0x${string}`,
  registry: "0xa4D8B6764743dFf59bB7b71119d44aC19F0e2235" as `0x${string}`,
  swapAdapter: "0x60cA56681bEa06fE72A73B18Ca62D766B040f7E1" as `0x${string}`,
  initialVault: "0x749f9bE6366373A85fD6130927fDc90Eb7862bED" as `0x${string}`,
  operator: "0xf88A50EF4CFCaa82021D6B362530Bc0887CB570B" as `0x${string}`,
  router: "0xD1b8997AaC08c619d40Be2e4284c9C72cAB33954" as `0x${string}`,
  approvalTarget: "0x8b773D83bc66Be128c60e07E17C8901f7a64F000" as `0x${string}`,
  usdt: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d" as `0x${string}`,
  usdc: "0x74b7F16337b8972027F6196A17a631aC6dE26d22" as `0x${string}`,
  wokb: "0xe538905cf8410324e03a5A23C1c177a474D59b2b" as `0x${string}`,
} as const;

export const VAULT_FACTORY_ABI = [
  {
    type: "function",
    name: "createVault",
    inputs: [
      { name: "baseToken", type: "address" },
      { name: "maxAmountPerTrade", type: "uint256" },
      { name: "maxDailyVolume", type: "uint256" },
      { name: "maxSlippageBps", type: "uint256" },
      { name: "cooldownSeconds", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getVaultsByOwner",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVaultCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "VaultCreated",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "vault", type: "address", indexed: true },
      { name: "baseToken", type: "address", indexed: false },
    ],
  },
] as const;

export const OPERATOR_VAULT_ABI = [
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "baseToken",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "authorizedOperator",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "trustedRouter",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "paused",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxAmountPerTrade",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxDailyVolume",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxSlippageBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "cooldownSeconds",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "dailyVolumeUsed",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastExecution",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextNonce",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "authorizedControllers",
    inputs: [{ name: "controller", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowedInputTokens",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowedTokens",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAuthorizedControllers",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAllowedInputTokens",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAllowedTokens",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "authorizeController",
    inputs: [{ name: "controller", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeController",
    inputs: [{ name: "controller", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addAllowedInputToken",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addAllowedToken",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeAllowedInputToken",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "pause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unpause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updatePolicy",
    inputs: [
      { name: "_maxAmountPerTrade", type: "uint256" },
      { name: "_maxDailyVolume", type: "uint256" },
      { name: "_maxSlippageBps", type: "uint256" },
      { name: "_cooldownSeconds", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "ExecutionSucceeded",
    inputs: [
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "controller", type: "address", indexed: true },
      { name: "tokenIn", type: "address", indexed: false },
      { name: "tokenOut", type: "address", indexed: false },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdraw",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "to", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ControllerAuthorized",
    inputs: [
      { name: "controller", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ControllerRevoked",
    inputs: [
      { name: "controller", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "InputTokenAllowed",
    inputs: [
      { name: "token", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "InputTokenRemoved",
    inputs: [
      { name: "token", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "TokenAllowed",
    inputs: [
      { name: "token", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "TokenRemoved",
    inputs: [
      { name: "token", type: "address", indexed: true },
    ],
  },
  {
    type: "function",
    name: "removeAllowedToken",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Paused",
    inputs: [],
  },
  {
    type: "event",
    name: "Unpaused",
    inputs: [],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const EXECUTION_REGISTRY_ABI = [
  {
    type: "function",
    name: "getTrackRecord",
    inputs: [{ name: "operator", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "authorizedVaults",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;
