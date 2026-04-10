export const OperatorVaultABI = [
  "function executeSwap(tuple(address vaultAddress, address controller, address adapter, address tokenIn, address tokenOut, uint256 amountIn, uint256 quotedAmountOut, uint256 minAmountOut, uint256 nonce, uint256 deadline, bytes32 executionHash) intent, bytes executionData, bytes signature, bytes32 paymentRef, address registry) external returns (bytes32 jobId)",
  "function authorizedControllers(address) view returns (bool)",
  "function allowedSwapAdapters(address) view returns (bool)",
  "function usedNonces(uint256) view returns (bool)",
  "function allowedInputTokens(address) view returns (bool)",
  "function allowedTokens(address) view returns (bool)",
  "function allowedPairs(address,address) view returns (bool)",
  "function baseToken() view returns (address)",
  "function maxAmountPerTrade() view returns (uint256)",
  "function maxDailyVolume() view returns (uint256)",
  "function maxSlippageBps() view returns (uint256)",
  "function cooldownSeconds() view returns (uint256)",
  "function currentDay() view returns (uint256)",
  "function dailyVolumeUsed() view returns (uint256)",
  "function lastExecution() view returns (uint256)",
  "function paused() view returns (bool)",
  "function authorizedOperator() view returns (address)",
  "function owner() view returns (address)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "event ExecutionSucceeded(bytes32 indexed jobId, address indexed controller, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)",
] as const;

export const ExecutionRegistryABI = [
  "function authorizeVault(address vault) external",
  "function recordReceipt(tuple(bytes32 jobId, address vault, address controller, address operator, address adapter, bytes32 paymentRef, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 timestamp, bool success) receipt) external",
  "function getReceipt(bytes32 jobId) view returns (tuple(bytes32 jobId, address vault, address controller, address operator, address adapter, bytes32 paymentRef, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 timestamp, bool success))",
  "function getTrackRecord(address operator) view returns (uint256)",
  "event ReceiptRecorded(bytes32 indexed jobId, address indexed vault, address indexed operator)",
] as const;

export const ERC20ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
] as const;
