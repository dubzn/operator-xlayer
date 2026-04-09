export const CHAIN_ID = 1952;

export const RPC_URL = "https://testrpc.xlayer.tech/terigon";

export const ADDRESSES = {
  factory: "0xdA3f23F937d530120F1DeAcBDA08770b1CF99CA7" as `0x${string}`,
  registry: "0x3d77c98D4E0f150Fd28D3A12708fd0300076ce97" as `0x${string}`,
  router: "0x54Bf470359EaE4A9BEe20F587Df9dc20C333e25F" as `0x${string}`,
  usdt: "0x9e29b3AaDa05Bf2D2c827Af80Bd28Dc0b9b4FB0c" as `0x${string}`,
  usdc: "0xcB8BF24c6cE16Ad21D707c9505421a17f2bec79D" as `0x${string}`,
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
    name: "authorizedControllers",
    inputs: [{ name: "controller", type: "address" }],
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
    name: "addAllowedToken",
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
