import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import { config } from "./config.js";
import executeRouter from "./routes/execute.js";
import { startIndexer, registerVault, getEventsForVault, getWatchedVaults } from "./services/indexer.js";

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/", executeRouter);

// Indexer API
app.get("/events/:vaultAddress", (req, res) => {
  const events = getEventsForVault(req.params.vaultAddress);
  res.json(events);
});

app.post("/indexer/watch", (req, res) => {
  const rawVaults: string[] = Array.isArray(req.body?.vaults)
    ? req.body.vaults
    : req.body?.vault
      ? [String(req.body.vault)]
      : [];

  if (rawVaults.length === 0) {
    res.status(400).json({ error: "Missing vault address" });
    return;
  }

  const watching = rawVaults.map((vault) => String(vault));
  if (watching.some((vault) => !ethers.isAddress(vault))) {
    res.status(400).json({ error: "Invalid vault address in watch request" });
    return;
  }
  watching.forEach(registerVault);

  res.json({ ok: true, watching });
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    mode: "multi-vault",
    registry: config.registryAddress,
    adapter: config.swapAdapterAddress,
    watchedVaults: getWatchedVaults().length,
  });
});

app.listen(config.port, () => {
  console.log(`[x402-operator] Backend running on port ${config.port}`);
  console.log(`[x402-operator] Registry: ${config.registryAddress}`);
  console.log(`[x402-operator] Adapter: ${config.swapAdapterAddress}`);
  console.log("[x402-operator] Mode: multi-vault");

  for (const vault of config.defaultWatchVaults) {
    registerVault(vault);
  }
  startIndexer();
});
