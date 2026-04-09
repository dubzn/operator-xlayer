import express from "express";
import cors from "cors";
import { config } from "./config.js";
import executeRouter from "./routes/execute.js";
import { startIndexer, registerVault, getEventsForVault } from "./services/indexer.js";

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
  const { vault } = req.body;
  if (!vault) {
    res.status(400).json({ error: "Missing vault address" });
    return;
  }
  registerVault(vault);
  res.json({ ok: true, watching: vault });
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", vault: config.vaultAddress, registry: config.registryAddress });
});

app.listen(config.port, () => {
  console.log(`[x402-operator] Backend running on port ${config.port}`);
  console.log(`[x402-operator] Vault: ${config.vaultAddress}`);
  console.log(`[x402-operator] Registry: ${config.registryAddress}`);

  // Start indexer and watch the configured vault
  registerVault(config.vaultAddress);
  startIndexer();
});
