import express from "express";
import { config } from "./config.js";
import executeRouter from "./routes/execute.js";

const app = express();
app.use(express.json());

// Routes
app.use("/", executeRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", vault: config.vaultAddress, registry: config.registryAddress });
});

app.listen(config.port, () => {
  console.log(`[x402-operator] Backend running on port ${config.port}`);
  console.log(`[x402-operator] Vault: ${config.vaultAddress}`);
  console.log(`[x402-operator] Registry: ${config.registryAddress}`);
});
