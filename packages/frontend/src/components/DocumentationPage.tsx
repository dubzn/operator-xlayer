import { useEffect, useState, type ReactNode } from "react";
import {
  ADDRESSES,
  CHAIN_ID,
  EXPLORER_URL,
  NATIVE_SYMBOL,
  RPC_URL,
} from "../config/contracts";
import "./DocumentationPage.css";

interface DocumentationPageProps {
  isConnected: boolean;
  onBack: () => void;
  onConnect: () => void;
}

const DOC_SECTIONS = [
  {
    id: "docs-overview",
    label: "Overview",
    eyebrow: "Protocol thesis",
    summary:
      "What X402 Operator is, why the scope is intentionally narrow, and why that is an advantage for the hackathon.",
  },
  {
    id: "docs-architecture",
    label: "Architecture",
    eyebrow: "System design",
    summary:
      "Roles, trust boundaries, and the separation between owner, controller, operator, and contracts.",
  },
  {
    id: "docs-flow",
    label: "Execution Flow",
    eyebrow: "Runtime loop",
    summary:
      "The full path from preview to x402 payment, execution submission, and receipt recording.",
  },
  {
    id: "docs-contracts",
    label: "Contracts",
    eyebrow: "Onchain surface",
    summary:
      "How VaultFactory, OperatorVault, the OKX adapter, and the registry work together.",
  },
  {
    id: "docs-mainnet",
    label: "Mainnet",
    eyebrow: "Deployment constants",
    summary:
      "Current X Layer addresses, network metadata, and the initial reference policy deployed from the repo.",
  },
  {
    id: "docs-api",
    label: "API + Intent",
    eyebrow: "Integration surface",
    summary:
      "Typed endpoints, ExecutionIntent shape, preview payloads, and the formulas that bind quote to execution.",
  },
  {
    id: "docs-security",
    label: "Security",
    eyebrow: "Hard guarantees",
    summary:
      "What the vault enforces onchain and what trust still remains in the operator service.",
  },
  {
    id: "docs-faq",
    label: "FAQ",
    eyebrow: "Judge questions",
    summary:
      "Fast answers to the questions a judge, integrator, or protocol partner is likely to ask first.",
  },
] as const;

type DocSectionId = (typeof DOC_SECTIONS)[number]["id"];

const DEFAULT_SECTION: DocSectionId = "docs-overview";

const PROTOCOL_PILLARS = [
  {
    title: "Delegated execution without broad delegation",
    body:
      "Controller agents decide when to trade, but they never receive a generic path to spend vault capital. The owner keeps policy authority and the vault enforces it onchain.",
  },
  {
    title: "Execution-as-a-service priced with x402",
    body:
      "The operator is not a free relayer. The controller pays the execution fee over x402, which cleanly separates strategy capital from operator economics.",
  },
  {
    title: "Preview-driven quote binding",
    body:
      "The controller signs the final package returned by preview, including adapter, quote bounds, nonce, deadline, and executionHash. That tight binding is what makes the system legible and auditable.",
  },
] as const;

const ACTORS = [
  {
    title: "Vault owner",
    body:
      "Deposits capital, sets policy, authorizes controllers, and can pause or withdraw. The owner is the policy source of truth, not the execution engine.",
  },
  {
    title: "Controller agent",
    body:
      "Builds the ExecutionIntent, requests preview, signs the final payload, and pays the operator. It decides when to act but cannot bypass vault rules.",
  },
  {
    title: "Operator backend",
    body:
      "Runs preview and execute, validates signatures and policy snapshots, verifies x402 payment, packages calldata, and submits the final transaction.",
  },
  {
    title: "Onchain contracts",
    body:
      "OperatorVault, VaultFactory, OkxAggregatorSwapAdapter, and ExecutionRegistry form the hard trust boundary and the public audit surface.",
  },
] as const;

const FLOW_STEPS = [
  {
    step: "01",
    title: "Owner deploys and funds a vault",
    body:
      "VaultFactory creates a new OperatorVault, auto-registers it in ExecutionRegistry, and wires the shared operator plus the default OKX swap adapter.",
  },
  {
    step: "02",
    title: "Policy is configured onchain",
    body:
      "The owner allowlists controllers, input tokens, output tokens, token pairs, and swap adapters, then sets limits for max trade size, daily volume, slippage, and cooldown.",
  },
  {
    step: "03",
    title: "Controller requests preview",
    body:
      "POST /preview reads the live vault state, fetches an OKX DEX quote, derives policyMinAmountOut, computes executionHash, and returns the exact signable package.",
  },
  {
    step: "04",
    title: "Controller signs and pays",
    body:
      "The controller signs the EIP-712 intent and calls POST /execute. If unpaid, the backend returns HTTP 402. The controller then pays the fee and retries with paymentReference.",
  },
  {
    step: "05",
    title: "Backend re-validates and executes",
    body:
      "The backend checks the cached quote, validates signature and live policy, verifies payment, and submits vault.executeSwap using the cached routeData.",
  },
  {
    step: "06",
    title: "Vault enforces and records receipt",
    body:
      "OperatorVault re-checks adapter, signer, nonce, deadline, allowlists, volume, cooldown, executionHash, and slippage before updating accounting and writing the receipt.",
  },
] as const;

const CONTRACTS = [
  {
    title: "OperatorVault",
    surface: "Custody + policy engine",
    body:
      "Holds funds, stores the operator + controller allowlists, verifies the EIP-712 intent, enforces execution policy, delegates into the selected adapter, and records the receipt.",
  },
  {
    title: "VaultFactory",
    surface: "Vault deployer",
    body:
      "Creates new vaults directly from the frontend and auto-authorizes them in the registry so every new vault is immediately part of the auditable receipt system.",
  },
  {
    title: "OkxAggregatorSwapAdapter",
    surface: "Execution venue abstraction",
    body:
      "Approves tokenIn to the OKX approval target, calls the router with backend-provided calldata, and measures amountOut from tokenOut balance delta.",
  },
  {
    title: "ExecutionRegistry",
    surface: "Public receipts + track record",
    body:
      "Stores execution receipts keyed by jobId and increments operator successCount, giving judges and integrators a concrete audit surface instead of a backend-only claim.",
  },
] as const;

const NETWORK_FACTS = [
  { label: "Network", value: "X Layer Mainnet" },
  { label: "Chain ID", value: String(CHAIN_ID) },
  { label: "RPC URL", value: RPC_URL },
  { label: "Native currency", value: NATIVE_SYMBOL },
  { label: "Explorer", value: EXPLORER_URL },
] as const;

const DEPLOYMENT_ADDRESSES = [
  {
    label: "ExecutionRegistry",
    value: ADDRESSES.registry,
    note: "Current registry address referenced by the frontend config.",
  },
  {
    label: "VaultFactory",
    value: ADDRESSES.factory,
    note: "Factory wired into the frontend for vault creation.",
  },
  {
    label: "OKX Swap Adapter",
    value: ADDRESSES.swapAdapter,
    note: "Adapter deployed in the latest mainnet artifact and used by swap-v2.",
  },
  {
    label: "Reference Vault",
    value: ADDRESSES.initialVault,
    note: "Initial vault created through the mainnet deployment script.",
  },
  {
    label: "Operator / Deployer",
    value: ADDRESSES.operator,
    note: "Operator identity from the latest repo deployment artifact.",
  },
  {
    label: "OKX Router",
    value: ADDRESSES.router,
    note: "Current router constant for live routing on X Layer.",
  },
  {
    label: "OKX Approval Target",
    value: ADDRESSES.approvalTarget,
    note: "Approval target used before the router call.",
  },
  {
    label: "USDT",
    value: ADDRESSES.usdt,
    note: "Base token and fee token in the reference mainnet deployment.",
  },
  {
    label: "USDC",
    value: ADDRESSES.usdc,
    note: "Allowed output token in the reference mainnet deployment.",
  },
] as const;

const INITIAL_POLICY = [
  { label: "Base token", value: "USDT" },
  { label: "Allowed output token", value: "USDC" },
  { label: "Allowed pair", value: "USDT -> USDC" },
  { label: "Max per trade", value: "50 USDT" },
  { label: "Max daily volume", value: "200 USDT" },
  { label: "Max slippage", value: "300 bps / 3%" },
  { label: "Cooldown", value: "30 seconds" },
  { label: "Authorized controller", value: "Operator / deployer address" },
] as const;

const ENDPOINTS = [
  {
    method: "POST",
    path: "/preview",
    body:
      "Reads live vault policy, fetches an OKX quote, derives policyMinAmountOut, computes executionHash, and returns the final signable execution package plus risk flags and warnings.",
  },
  {
    method: "POST",
    path: "/execute",
    body:
      "Enforces x402 payment, validates the signed intent against the cached quote and live vault state, then calls vault.executeSwap and returns jobId plus txHash.",
  },
  {
    method: "GET",
    path: "/receipts/:jobId",
    body:
      "Fetches the public receipt written into ExecutionRegistry for a paid execution attempt.",
  },
  {
    method: "GET",
    path: "/operator/track-record",
    body:
      "Returns the current onchain success counter for the operator address.",
  },
] as const;

const SECURITY_GUARDS = [
  "Controller must be allowlisted onchain.",
  "Recovered EIP-712 signer must match intent.controller.",
  "Nonce must be unused and deadline must still be valid.",
  "tokenIn, tokenOut, and tokenIn -> tokenOut pair must all be allowlisted.",
  "Selected adapter must be explicitly allowlisted.",
  "amountIn must fit maxAmountPerTrade and maxDailyVolume.",
  "cooldownSeconds must have elapsed before the next swap.",
  "keccak256(executionData) must exactly match intent.executionHash.",
  "intent.minAmountOut cannot be weaker than the policy floor derived from quotedAmountOut.",
  "Realized amountOut must still satisfy intent.minAmountOut after execution.",
] as const;

const FAQS = [
  {
    question: "Is this just an OKX wrapper?",
    answer:
      "No. OKX provides route discovery and calldata, but X402 Operator adds the custody boundary, controller authorization, quote binding, x402 monetization, and onchain receipts.",
  },
  {
    question: "Does x402 payment grant access to vault capital?",
    answer:
      "No. x402 only pays the operator for execution-as-a-service. Capital still moves only if the signed intent and the vault policy both allow the swap.",
  },
  {
    question: "Why does the controller sign executionHash instead of raw calldata?",
    answer:
      "It keeps the interface clean while still binding the operator to the exact cached route package that came back from preview.",
  },
  {
    question: "What happens if the controller key is compromised?",
    answer:
      "The owner pauses the vault, revokes the controller, and can rotate policy. That is one reason the vault exists instead of broad wallet delegation.",
  },
  {
    question: "Why is this hackathon-ready?",
    answer:
      "Because the system is narrow, legible, and production-shaped: contracts enforce policy, APIs are typed, addresses are concrete, and the docs make the trust model understandable in minutes.",
  },
] as const;

const PACKAGE_MAP = [
  { title: "packages/contracts", body: "Solidity vault, factory, adapter, and registry." },
  { title: "packages/backend", body: "Operator service, payment checks, intent validation, execution." },
  { title: "packages/shared", body: "Shared types, EIP-712 helpers, and hashes." },
  { title: "packages/agent", body: "Reference controller agent that signs and pays." },
  { title: "packages/frontend", body: "Human-facing vault console plus this protocol documentation layer." },
] as const;

const INTENT_SNIPPET = `type ExecutionIntent = {
  vaultAddress: string
  controller: string
  adapter: string
  tokenIn: string
  tokenOut: string
  amountIn: string
  quotedAmountOut: string
  minAmountOut: string
  nonce: number
  deadline: number
  executionHash: string
}`;

const PREVIEW_SNIPPET = `POST /preview
{
  "intent": {
    "vaultAddress": "${ADDRESSES.initialVault}",
    "controller": "${ADDRESSES.operator}",
    "adapter": "${ADDRESSES.swapAdapter}",
    "tokenIn": "${ADDRESSES.usdt}",
    "tokenOut": "${ADDRESSES.usdc}",
    "amountIn": "50000000",
    "quotedAmountOut": "0",
    "minAmountOut": "0",
    "nonce": 7,
    "deadline": 1777777777,
    "executionHash": "0x0000000000000000000000000000000000000000000000000000000000000000"
  }
}`;

const FORMULA_SNIPPET = `policyMinAmountOut = quotedAmountOut * (10_000 - maxSlippageBps) / 10_000
jobId = keccak256(intentHash, paymentReference)`;

function SectionLead(props: { eyebrow: string; title: string; copy: string }) {
  const { eyebrow, title, copy } = props;

  return (
    <div className="docs-section-lead">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display-text">{title}</h2>
      <p>{copy}</p>
    </div>
  );
}

function isDocSectionId(value: string): value is DocSectionId {
  return DOC_SECTIONS.some((section) => section.id === value);
}

function getSectionFromHash(): DocSectionId {
  const currentHash = window.location.hash.replace(/^#/, "");
  return isDocSectionId(currentHash) ? currentHash : DEFAULT_SECTION;
}

function DocumentationPage({ isConnected, onBack, onConnect }: DocumentationPageProps) {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<DocSectionId>(() => getSectionFromHash());

  useEffect(() => {
    const syncSectionFromHash = () => {
      setActiveSection(getSectionFromHash());
    };

    syncSectionFromHash();
    window.addEventListener("hashchange", syncSectionFromHash);
    return () => window.removeEventListener("hashchange", syncSectionFromHash);
  }, []);

  useEffect(() => {
    if (!copiedLabel) return;

    const timeout = window.setTimeout(() => setCopiedLabel(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [copiedLabel]);

  async function handleCopy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedLabel(label);
    } catch (error) {
      console.error("Copy failed", error);
    }
  }

  function selectSection(sectionId: DocSectionId) {
    if (window.location.hash !== `#${sectionId}`) {
      window.location.hash = sectionId;
      return;
    }

    setActiveSection(sectionId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handlePrimaryAction() {
    if (isConnected) {
      onBack();
      return;
    }

    onBack();
    onConnect();
  }

  const activeIndex = DOC_SECTIONS.findIndex((section) => section.id === activeSection);
  const activeMeta = DOC_SECTIONS[activeIndex];
  const progressPercent = ((activeIndex + 1) / DOC_SECTIONS.length) * 100;

  function goToNeighbor(direction: -1 | 1) {
    const target = DOC_SECTIONS[activeIndex + direction];
    if (target) {
      selectSection(target.id);
    }
  }

  const overviewShortcuts = [
    {
      title: "Architecture",
      body: "Roles, trust boundaries, and the protocol split.",
      target: "docs-architecture" as const,
    },
    {
      title: "Mainnet",
      body: "Addresses, chain constants, and reference deployment.",
      target: "docs-mainnet" as const,
    },
    {
      title: "API + Intent",
      body: "Typed endpoints, preview flow, and signed payload shape.",
      target: "docs-api" as const,
    },
  ];

  const sectionViews: Record<DocSectionId, ReactNode> = {
    "docs-overview": (
      <>
        <section className="docs-hero glass-card">
          <div className="docs-hero-copy">
            <p className="hero-pill">Agentic swaps, policy first</p>
            <h2 className="display-text docs-hero-title">
              Delegated execution for agents that should not hold the keys.
            </h2>
            <p className="docs-hero-text">
              X402 Operator is a narrow but serious protocol surface: the owner keeps
              funds in an onchain vault, a controller agent signs typed intents, the
              operator sells execution as a paid API, and the vault remains the hard
              enforcement boundary on X Layer mainnet.
            </p>

            <div className="docs-actions">
              <button className="btn btn-primary" onClick={() => handlePrimaryAction()}>
                {isConnected ? "Return to cockpit" : "Connect and launch"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => selectSection("docs-mainnet")}
              >
                Inspect mainnet constants
              </button>
            </div>

            <div className="docs-stat-row">
              <div className="docs-stat-card">
                <span className="docs-stat-label">Signed fields</span>
                <strong>11</strong>
              </div>
              <div className="docs-stat-card">
                <span className="docs-stat-label">Hard boundaries</span>
                <strong>4</strong>
              </div>
              <div className="docs-stat-card">
                <span className="docs-stat-label">Mainnet chain</span>
                <strong>196</strong>
              </div>
            </div>

            <div className="docs-overview-shortcuts">
              {overviewShortcuts.map((shortcut) => (
                <button
                  key={shortcut.title}
                  type="button"
                  className="docs-overview-shortcut"
                  onClick={() => selectSection(shortcut.target)}
                >
                  <span className="docs-mini-label">Quick link</span>
                  <strong>{shortcut.title}</strong>
                  <p>{shortcut.body}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="docs-blueprint">
            <div className="docs-blueprint-node">
              <span className="docs-blueprint-tag">Agent</span>
              <strong>Controller</strong>
              <p>Requests preview, signs EIP-712, pays x402.</p>
            </div>
            <div className="docs-blueprint-link" />
            <div className="docs-blueprint-node">
              <span className="docs-blueprint-tag">Service</span>
              <strong>Operator API</strong>
              <p>Quotes, validates, charges, and submits execution.</p>
            </div>
            <div className="docs-blueprint-link" />
            <div className="docs-blueprint-node">
              <span className="docs-blueprint-tag">Onchain</span>
              <strong>OperatorVault</strong>
              <p>Checks policy, delegates adapter call, updates receipt state.</p>
            </div>
            <div className="docs-blueprint-link" />
            <div className="docs-blueprint-node">
              <span className="docs-blueprint-tag">Audit</span>
              <strong>Registry</strong>
              <p>Stores jobId, paymentRef, operator, pair, and success count.</p>
            </div>
          </div>
        </section>

        <section className="docs-section glass-card">
          <SectionLead
            eyebrow="Core thesis"
            title="Why this architecture is differentiated"
            copy="The protocol is intentionally narrow. It does one thing well: policy-bounded delegated swap execution for agents. That restraint makes the system easier to trust, easier to audit, and easier to explain."
          />

          <div className="docs-card-grid docs-card-grid-3">
            {PROTOCOL_PILLARS.map((pillar) => (
              <article key={pillar.title} className="docs-card">
                <h3>{pillar.title}</h3>
                <p>{pillar.body}</p>
              </article>
            ))}
          </div>
        </section>
      </>
    ),
    "docs-architecture": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="Architecture"
          title="Role separation is the product"
          copy="The system becomes credible because each actor has a narrow job. The owner defines policy, the controller requests action, the operator performs paid execution, and the vault decides whether capital can move."
        />

        <div className="docs-card-grid docs-card-grid-2">
          {ACTORS.map((actor) => (
            <article key={actor.title} className="docs-card docs-card-actor">
              <span className="docs-card-kicker">{actor.title}</span>
              <p>{actor.body}</p>
            </article>
          ))}
        </div>

        <div className="docs-boundary-grid">
          <article className="docs-boundary-card">
            <span className="docs-mini-label">Preview boundary</span>
            <p>The controller sees the exact package it is about to approve.</p>
          </article>
          <article className="docs-boundary-card">
            <span className="docs-mini-label">Signature boundary</span>
            <p>The operator only gets a valid action if the controller signed it.</p>
          </article>
          <article className="docs-boundary-card">
            <span className="docs-mini-label">Payment boundary</span>
            <p>x402 prices the service independently from the vault capital.</p>
          </article>
          <article className="docs-boundary-card">
            <span className="docs-mini-label">Vault boundary</span>
            <p>Even a paid and signed request still fails if policy no longer allows it.</p>
          </article>
        </div>
      </section>
    ),
    "docs-flow": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="Execution loop"
          title="From preview to receipt"
          copy="The full loop is designed to be redundant in the right places: the backend validates early to save gas and the vault validates again because onchain policy is the real security line."
        />

        <div className="docs-timeline">
          {FLOW_STEPS.map((step) => (
            <article key={step.step} className="docs-timeline-item">
              <div className="docs-timeline-index">{step.step}</div>
              <div className="docs-timeline-copy">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    ),
    "docs-contracts": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="Contract system"
          title="Four contracts, one execution thesis"
          copy="Every contract exists for a reason. The vault holds capital and enforces rules. The factory deploys. The adapter talks to the venue. The registry makes outcomes inspectable."
        />

        <div className="docs-card-grid docs-card-grid-2">
          {CONTRACTS.map((contract) => (
            <article key={contract.title} className="docs-card">
              <span className="docs-card-kicker">{contract.surface}</span>
              <h3>{contract.title}</h3>
              <p>{contract.body}</p>
            </article>
          ))}
        </div>

        <div className="docs-package-grid">
          {PACKAGE_MAP.map((entry) => (
            <article key={entry.title} className="docs-package-card">
              <strong>{entry.title}</strong>
              <p>{entry.body}</p>
            </article>
          ))}
        </div>
      </section>
    ),
    "docs-mainnet": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="Mainnet"
          title="Current X Layer deployment constants"
          copy="These values are taken from the current frontend config, the mainnet deployment script, and the latest broadcast artifact in the repo. They should be treated as the repo's live reference set and refreshed after every new production deploy."
        />

        <div className="docs-fact-grid">
          {NETWORK_FACTS.map((fact) => (
            <article key={fact.label} className="docs-fact-card">
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </article>
          ))}
        </div>

        <div className="docs-address-grid">
          {DEPLOYMENT_ADDRESSES.map((entry) => (
            <article key={entry.label} className="docs-address-card">
              <div className="docs-address-header">
                <span className="docs-mini-label">{entry.label}</span>
                <button
                  type="button"
                  className="docs-copy-button"
                  onClick={() => handleCopy(entry.label, entry.value)}
                >
                  {copiedLabel === entry.label ? "Copied" : "Copy"}
                </button>
              </div>
              <code>{entry.value}</code>
              <p>{entry.note}</p>
            </article>
          ))}
        </div>

        <div className="docs-policy-panel">
          <div className="docs-policy-copy">
            <span className="docs-mini-label">Reference genesis policy</span>
            <h3>What the mainnet script configures by default</h3>
            <p>
              The latest deployment script creates an initial vault optimized for a
              tight demo loop: one operator, one controller, one live pair, and limits
              that make risk controls obvious during judging.
            </p>
          </div>

          <div className="docs-policy-grid">
            {INITIAL_POLICY.map((item) => (
              <article key={item.label} className="docs-policy-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>
    ),
    "docs-api": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="API + intent"
          title="Typed payloads, not fuzzy prompts"
          copy="The controller integrates against a deterministic API. That matters because the whole system depends on agreeing about the exact execution package before anyone pays for or submits a transaction."
        />

        <div className="docs-endpoint-list">
          {ENDPOINTS.map((endpoint) => (
            <article key={endpoint.path} className="docs-endpoint-card">
              <div className="docs-endpoint-head">
                <span className="docs-method">{endpoint.method}</span>
                <code>{endpoint.path}</code>
              </div>
              <p>{endpoint.body}</p>
            </article>
          ))}
        </div>

        <div className="docs-snippet-grid">
          <article className="docs-snippet-card">
            <span className="docs-mini-label">Execution intent</span>
            <pre>
              <code>{INTENT_SNIPPET}</code>
            </pre>
          </article>

          <article className="docs-snippet-card">
            <span className="docs-mini-label">Preview request shape</span>
            <pre>
              <code>{PREVIEW_SNIPPET}</code>
            </pre>
          </article>

          <article className="docs-snippet-card docs-snippet-card-wide">
            <span className="docs-mini-label">Critical formulas</span>
            <pre>
              <code>{FORMULA_SNIPPET}</code>
            </pre>
          </article>
        </div>
      </section>
    ),
    "docs-security": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="Security model"
          title="What the vault enforces onchain"
          copy="The backend helps with efficiency, but the vault decides whether the swap is legal. That is the difference between an operator with soft promises and a protocol with hard rules."
        />

        <div className="docs-guard-grid">
          {SECURITY_GUARDS.map((guard) => (
            <article key={guard} className="docs-guard-card">
              <span className="docs-guard-dot" />
              <p>{guard}</p>
            </article>
          ))}
        </div>

        <div className="docs-risk-callout">
          <span className="docs-mini-label">Operational note</span>
          <p>
            The remaining trust is intentionally narrow: the operator can be offline or
            choose not to serve a valid job, but it still cannot bypass the vault and
            take arbitrary funds.
          </p>
        </div>
      </section>
    ),
    "docs-faq": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="FAQ"
          title="Questions a judge or integrator will ask"
          copy="This section is designed to remove ambiguity fast. If someone only spends three minutes with the product, these answers should still make the thesis clear."
        />

        <div className="docs-faq-list">
          {FAQS.map((item) => (
            <details key={item.question} className="docs-faq-item">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    ),
  };

  return (
    <section className="docs-screen" aria-label="Protocol documentation">
      <header className="docs-header glass-card">
        <div className="docs-header-brand">
          <p className="eyebrow">Protocol documentation</p>
          <h1 className="display-text">X402 Operator Atlas</h1>
          <p>
            A protocol-style walkthrough of delegated execution, trust boundaries, and
            mainnet deployment on X Layer.
          </p>
        </div>

        <div className="docs-header-actions">
          <button className="btn btn-ghost" onClick={() => handlePrimaryAction()}>
            {isConnected ? "Open Dashboard" : "Connect Wallet"}
          </button>
          <button className="btn btn-primary" onClick={() => onBack()}>
            Back
          </button>
        </div>
      </header>

      <div className="docs-layout">
        <aside className="docs-sidebar liquid-panel liquid-panel-soft">
          <div className="docs-sidebar-block">
            <p className="eyebrow">Sections</p>
            <nav className="docs-nav" aria-label="Documentation sections">
              {DOC_SECTIONS.map((section, index) => (
                <button
                  key={section.id}
                  type="button"
                  className={`docs-nav-button ${section.id === activeSection ? "active" : ""}`}
                  onClick={() => selectSection(section.id)}
                  aria-pressed={section.id === activeSection}
                >
                  <span className="docs-nav-meta">
                    <span className="docs-nav-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="docs-nav-copy">
                      <strong>{section.label}</strong>
                    </span>
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <div className="docs-sidebar-block docs-sidebar-active">
            <span className="docs-mini-label">Current section</span>
            <strong className="docs-sidebar-active-title">{activeMeta.label}</strong>
            <p>{activeMeta.summary}</p>
            <div className="docs-sidebar-progress">
              <span>
                {activeIndex + 1} / {DOC_SECTIONS.length}
              </span>
              <div className="docs-sidebar-progress-track">
                <div
                  className="docs-sidebar-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="docs-sidebar-block docs-sidebar-callout">
            <span className="docs-mini-label">Why this matters</span>
            <p>
              The product wins when a judge can see the trust model, the payment rail,
              and the onchain enforcement path without opening five different files.
            </p>
          </div>

          <div className="docs-sidebar-block docs-sidebar-sources">
            <span className="docs-mini-label">Backed by repo sources</span>
            <ul>
              <li>OperatorVault.sol</li>
              <li>execute.ts</li>
              <li>mainnet deployment artifact</li>
              <li>shared ExecutionIntent types</li>
            </ul>
          </div>
        </aside>

        <div className="docs-content">
          <div className="docs-view">{sectionViews[activeSection]}</div>

          <div className="docs-view-footer glass-card">
            <div className="docs-view-footer-copy">
              <span className="docs-mini-label">{activeMeta.eyebrow}</span>
              <strong>{activeMeta.label}</strong>
              <p>{activeMeta.summary}</p>
            </div>

            <div className="docs-view-nav">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => goToNeighbor(-1)}
                disabled={activeIndex === 0}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => goToNeighbor(1)}
                disabled={activeIndex === DOC_SECTIONS.length - 1}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default DocumentationPage;
