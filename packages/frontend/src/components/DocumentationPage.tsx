import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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
}

const HACKATHON_URL = "https://web3.okx.com/es-la/xlayer/build-x-hackathon";

const DOC_SECTIONS = [
  {
    id: "docs-pitch",
    label: "Overview",
    eyebrow: "Documentation",
    summary:
      "High-level context: what X402 Operator is, why the wedge matters, and how the system is positioned for Build X.",
  },
  {
    id: "docs-live",
    label: "What Is Live",
    eyebrow: "Honest scope",
    summary:
      "What the repo already ships today, what can be verified directly, and what we are intentionally not claiming yet.",
  },
  {
    id: "docs-demo",
    label: "Demo",
    eyebrow: "90-second path",
    summary:
      "The exact sequence that makes the product legible: preview, sign, x402 payment, onchain execution, and receipt.",
  },
  {
    id: "docs-architecture",
    label: "Architecture",
    eyebrow: "Trust boundaries",
    summary:
      "Roles, boundaries, and why the operator is useful without becoming a broad custodian.",
  },
  {
    id: "docs-mainnet",
    label: "Mainnet",
    eyebrow: "Proof surface",
    summary:
      "Current X Layer constants, frontend-wired addresses, and the reference policy used for the demo path.",
  },
  {
    id: "docs-api",
    label: "API",
    eyebrow: "Integration surface",
    summary:
      "Typed endpoints, intent shape, preview semantics, and the formulas that tie quote to execution.",
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
    eyebrow: "Common questions",
    summary:
      "Short answers to the questions an integrator, contributor, or protocol partner is likely to ask first.",
  },
] as const;

type DocSectionId = (typeof DOC_SECTIONS)[number]["id"];

const DEFAULT_SECTION: DocSectionId = "docs-pitch";

const WIN_REASONS = [
  {
    title: "It solves a real agent problem",
    body:
      "Most agent projects prove decision-making. We prove execution without broad wallet delegation. That is the uncomfortable layer between demos and real capital.",
  },
  {
    title: "It gives x402 a natural job",
    body:
      "The operator charges per execution attempt, which makes sense when software consumes execution-as-a-service. The fee is separated cleanly from vault capital.",
  },
  {
    title: "It leaves an audit trail",
    body:
      "Every successful execution can be checked through tx hash, receipt data, and operator track record instead of relying on backend-only claims.",
  },
] as const;

const BUILD_X_FIT = [
  {
    title: "Agent-native",
    body:
      "The controller agent is the first-class caller. Humans configure the vault once; the agent decides when to act.",
  },
  {
    title: "Full-stack on X Layer",
    body:
      "Contracts, backend, reference agent, frontend console, and current addresses are all shaped around X Layer mainnet.",
  },
  {
    title: "Easy to understand",
    body:
      "The product can be understood in under two minutes because the trust boundaries are narrow and the runtime loop is typed and concrete.",
  },
] as const;

const LIVE_NOW = [
  {
    title: "Contracts live in the repo",
    body:
      "VaultFactory, OperatorVault, OkxAggregatorSwapAdapter, and ExecutionRegistry are implemented and wired together around delegated swap execution.",
  },
  {
    title: "Typed execution path",
    body:
      "Preview computes the signable package, the controller signs EIP-712, execute enforces x402, and the vault re-validates onchain.",
  },
  {
    title: "Frontend and agent included",
    body:
      "The repo ships a vault console plus a reference controller agent so the full story can be shown end to end.",
  },
] as const;

const VERIFIABLE_SURFACE = [
  {
    title: "What can be verified",
    body:
      "Current chain constants, current addresses, typed intent shape, route binding via executionHash, execution receipts, and the operator success counter.",
  },
  {
    title: "What we are intentionally not claiming",
    body:
      "We are not claiming a universal DeFi automation layer, an open operator marketplace, or a finished reputation economy. Today we solve delegated swaps well.",
  },
  {
    title: "Why narrow scope is a strength",
    body:
      "Build X rewards practical systems. A tight wedge is easier to trust, easier to demo, and harder to dismiss as a vague vision deck.",
  },
] as const;

const DEMO_STEPS = [
  {
    step: "01",
    title: "Frame the problem",
    body:
      "Explain the tradeoff: broad wallet delegation is dangerous, manual signing kills autonomy. This project creates the third option.",
  },
  {
    step: "02",
    title: "Show a funded vault",
    body:
      "Open the console, show the owner-controlled vault, show the authorized controller and operator, and make the policy surface visible.",
  },
  {
    step: "03",
    title: "Show preview and the exact intent",
    body:
      "Display the preview response, the quote-derived bounds, and the final EIP-712 ExecutionIntent that the controller signs.",
  },
  {
    step: "04",
    title: "Show the x402 gate",
    body:
      "Hit execute, surface HTTP 402, and show the fee payment as the monetization rail between the controller and the operator.",
  },
  {
    step: "05",
    title: "Show enforcement",
    body:
      "Explain that the backend validates early, but the vault still re-checks adapter, signer, nonce, pairs, caps, cooldown, and executionHash onchain.",
  },
  {
    step: "06",
    title: "Close on the receipt",
    body:
      "Show the tx hash, the registry receipt, and the operator success count update. End on accountability, not on marketing language.",
  },
] as const;

const ACTORS = [
  {
    title: "Vault owner",
    body:
      "Deposits capital, sets the rules, authorizes controllers, and can pause or withdraw. The owner is the policy source of truth.",
  },
  {
    title: "Controller agent",
    body:
      "Builds the ExecutionIntent, requests preview, signs the final payload, and pays the operator fee. It decides when to act but cannot bypass vault rules.",
  },
  {
    title: "Operator backend",
    body:
      "Runs preview and execute, verifies signatures and payment, packages calldata, and submits the final transaction.",
  },
  {
    title: "Onchain contracts",
    body:
      "VaultFactory deploys, OperatorVault enforces, the OKX adapter executes, and ExecutionRegistry stores the audit surface.",
  },
] as const;

const BOUNDARIES = [
  {
    title: "Preview boundary",
    body: "The controller sees the exact package it is being asked to sign.",
  },
  {
    title: "Signature boundary",
    body: "The operator only gets a valid action if the controller approved the final typed package.",
  },
  {
    title: "Payment boundary",
    body: "x402 prices the service independently from the capital inside the vault.",
  },
  {
    title: "Vault boundary",
    body: "Even a paid and signed request still fails if the owner policy no longer allows it.",
  },
] as const;

const NETWORK_FACTS = [
  { label: "Arena", value: "Build X · X Layer Arena" },
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
    note: "Current registry address wired into the frontend config.",
  },
  {
    label: "VaultFactory",
    value: ADDRESSES.factory,
    note: "Factory used by the frontend to deploy new vault shells.",
  },
  {
    label: "OKX Swap Adapter",
    value: ADDRESSES.swapAdapter,
    note: "Swap adapter address used by the current delegated execution path.",
  },
  {
    label: "Reference Vault",
    value: ADDRESSES.initialVault,
    note: "Current reference vault used for the live demo path.",
  },
  {
    label: "Operator",
    value: ADDRESSES.operator,
    note: "Current operator identity surfaced by the frontend config.",
  },
  {
    label: "OKX Router",
    value: ADDRESSES.router,
    note: "Current router constant used by the adapter flow.",
  },
  {
    label: "OKX Approval Target",
    value: ADDRESSES.approvalTarget,
    note: "Approval target used before the router call.",
  },
  {
    label: "USDT",
    value: ADDRESSES.usdt,
    note: "Reference base token and fee token in the default path.",
  },
  {
    label: "USDC",
    value: ADDRESSES.usdc,
    note: "Reference output token in the default path.",
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
      "Reads live vault state, fetches an OKX route, derives the policy-safe minimum output, computes executionHash, and returns the final signable package.",
  },
  {
    method: "POST",
    path: "/execute",
    body:
      "Enforces x402 payment, validates the signed intent against the cached quote and current vault state, then calls vault.executeSwap.",
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
    question: "Is this just a relayer?",
    answer:
      "No. A relayer forwards transactions. X402 Operator adds custody separation, typed intent approval, onchain execution policy, x402 monetization, and public receipts.",
  },
  {
    question: "Is this centralized because there is a backend in the middle?",
    answer:
      "There is an offchain operator service, and we are explicit about that. The important security line still sits onchain in the vault, which means the operator cannot bypass policy and withdraw funds arbitrarily.",
  },
  {
    question: "Why is x402 important here?",
    answer:
      "Because the natural buyer of this service is another agent or protocol. x402 gives the operator a clean, request-level execution business model without mixing fee revenue with vault capital.",
  },
  {
    question: "Why not just use session keys?",
    answer:
      "Session keys help, but they do not create the same separation between strategy, custody, execution, and public auditability. The vault makes those boundaries explicit and inspectable.",
  },
  {
    question: "What happens if the controller is compromised?",
    answer:
      "The owner pauses the vault, revokes the controller, and can rotate policy. The compromise is still bounded by token, pair, amount, slippage, volume, and cooldown rules.",
  },
  {
    question: "What happens if the agent pays and execution later fails?",
    answer:
      "In the current MVP, the fee pays for the execution attempt, not a guaranteed fill. That is why preview and pre-validation happen before the x402 challenge.",
  },
  {
    question: "Is this just an OKX wrapper?",
    answer:
      "No. OKX provides routing and calldata. X402 Operator adds the custody boundary, controller authorization, quote binding, x402 monetization, and onchain receipts.",
  },
  {
    question: "Where is the AI in this project?",
    answer:
      "The AI sits in the controller side of the system: deciding when to act. We solve the harder downstream problem of making that decision executable on real capital without broad custody delegation.",
  },
] as const;

const PACKAGE_MAP = [
  { title: "packages/contracts", body: "Vault, factory, adapter, registry." },
  { title: "packages/backend", body: "Preview, execute, payment checks, submission." },
  { title: "packages/shared", body: "ExecutionIntent types, hashes, EIP-712 helpers." },
  { title: "packages/agent", body: "Reference controller agent that signs and pays." },
  { title: "packages/frontend", body: "Vault console plus this documentation layer." },
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

function DocumentationPage({ isConnected }: DocumentationPageProps) {
  const navigate = useNavigate();
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
      title: "What is live",
      body: "Scope, proof surface, and the parts we are intentionally not claiming yet.",
      target: "docs-live" as const,
    },
    {
      title: "Mainnet proof",
      body: "Current X Layer constants and addresses wired into the frontend.",
      target: "docs-mainnet" as const,
    },
    {
      title: "Typed API",
      body: "Preview, execute, ExecutionIntent, and executionHash binding.",
      target: "docs-api" as const,
    },
  ];

  const sectionViews: Record<DocSectionId, ReactNode> = {
    "docs-pitch": (
      <>
        <section className="docs-hero glass-card">
          <div className="docs-hero-copy">
            <p className="hero-pill">Build X Hackathon · X Layer Arena</p>
            <h2 className="display-text docs-hero-title">
              The wedge should be clear in under 30 seconds.
            </h2>
            <p className="docs-hero-text">
              X402 Operator is the secure execution rail for agents on X Layer.
              Owners keep capital inside policy-bound vaults, controller agents sign
              exact execution packages, the operator monetizes execution with x402,
              and every successful job leaves an onchain receipt.
            </p>

            <div className="docs-actions">
              {isConnected ? (
                <button className="btn btn-primary" onClick={() => navigate("/vaults")}>
                  Open Dashboard
                </button>
              ) : null}
              <a
                className="btn btn-ghost"
                href={HACKATHON_URL}
                target="_blank"
                rel="noreferrer"
              >
                Hackathon page
              </a>
            </div>

            <div className="docs-stat-row">
              <div className="docs-stat-card">
                <span className="docs-stat-label">Main wedge</span>
                <strong>1</strong>
              </div>
              <div className="docs-stat-card">
                <span className="docs-stat-label">Demo runtime</span>
                <strong>90s</strong>
              </div>
              <div className="docs-stat-card">
                <span className="docs-stat-label">X Layer chain</span>
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
              <p>Enforces policy before capital can move.</p>
            </div>
            <div className="docs-blueprint-link" />
            <div className="docs-blueprint-node">
              <span className="docs-blueprint-tag">Audit</span>
              <strong>Registry</strong>
              <p>Stores receipts and updates operator success count.</p>
            </div>
          </div>
        </section>

        <section className="docs-section glass-card">
          <SectionLead
            eyebrow="Why this fits Build X"
            title="This project is narrow, agent-native, and easy to understand"
            copy="The strength of the repo is not breadth. The strength is that the thesis, the payment rail, and the trust boundary all line up cleanly in one end-to-end loop."
          />

          <div className="docs-card-grid docs-card-grid-3">
            {WIN_REASONS.map((pillar) => (
              <article key={pillar.title} className="docs-card">
                <h3>{pillar.title}</h3>
                <p>{pillar.body}</p>
              </article>
            ))}
          </div>

          <div className="docs-card-grid docs-card-grid-3">
            {BUILD_X_FIT.map((item) => (
              <article key={item.title} className="docs-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      </>
    ),
    "docs-live": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="What is live"
          title="The repo already proves the core loop"
          copy="This is not a docs-only idea. Contracts, backend, reference agent, and frontend all exist around the same delegated swap execution path."
        />

        <div className="docs-card-grid docs-card-grid-3">
          {LIVE_NOW.map((item) => (
            <article key={item.title} className="docs-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>

        <div className="docs-card-grid docs-card-grid-3">
          {VERIFIABLE_SURFACE.map((item) => (
            <article key={item.title} className="docs-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
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
    "docs-demo": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="Demo story"
          title="The winning path is preview -> sign -> 402 -> execute -> receipt"
          copy="Do not present this as a consumer dashboard. Present it as the execution layer that becomes necessary once agents move from thinking to touching real capital."
        />

        <div className="docs-timeline">
          {DEMO_STEPS.map((step) => (
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
    "docs-architecture": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="Architecture"
          title="Role separation is the product"
          copy="The system works because each actor has a narrow job. The owner defines policy, the controller decides when to act, the operator performs paid execution, and the vault decides whether capital can move."
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
          {BOUNDARIES.map((boundary) => (
            <article key={boundary.title} className="docs-boundary-card">
              <span className="docs-mini-label">{boundary.title}</span>
              <p>{boundary.body}</p>
            </article>
          ))}
        </div>
      </section>
    ),
    "docs-mainnet": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="Mainnet proof"
          title="Current X Layer reference surface"
          copy="These values come from the current frontend config and define the proof surface available directly from the repo and the running app."
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
            <span className="docs-mini-label">Reference demo policy</span>
            <h3>Configured to make the trust model obvious</h3>
            <p>
              The current reference setup is intentionally small: one operator, one
              controller, one pair, and limits that make guardrails visible during the
              first live demo.
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
          copy="The controller integrates against a deterministic API. That is what makes preview, signature, payment, and execution line up cleanly enough for onchain enforcement."
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

        <div className="docs-risk-callout">
          <span className="docs-mini-label">Operational note</span>
          <p>
            Preview can explicitly tell you when route data is not ready or the quote is
            missing. That keeps the product honest: executable when live routing exists,
            informational when the upstream quote path is not ready.
          </p>
        </div>
      </section>
    ),
    "docs-security": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="Security model"
          title="The vault is the real security line"
          copy="The backend helps with efficiency and payment handling, but the vault decides whether the action is legal. That is the difference between a backend with promises and a protocol with hard boundaries."
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
          <span className="docs-mini-label">Remaining trust</span>
          <p>
            The operator can be offline or choose not to serve a valid request, but it
            still cannot bypass the vault and take arbitrary funds. The design is
            trust-minimized, not trust-free.
          </p>
        </div>
      </section>
    ),
    "docs-faq": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="FAQ"
          title="Questions that usually matter first"
          copy="These are the objections that matter. The right answer is direct, honest about the MVP, and always returns to the same wedge: secure delegated execution without broad custody."
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
    <section className="docs-screen" aria-label="X402 Operator documentation">
      <header className="docs-header glass-card">
        <div className="docs-header-brand">
          <p className="eyebrow">Documentation</p>
          <h1 className="display-text">X402 Operator Documentation</h1>
          <p>
            The same story as the root README, presented inside the frontend: wedge,
            live proof, trust model, and demo path.
          </p>
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
              The project lands when the trust boundary, the x402 fee rail, and the
              onchain receipt surface are clear without opening ten markdown files.
            </p>
          </div>

          <div className="docs-sidebar-block docs-sidebar-sources">
            <span className="docs-mini-label">Backed by repo sources</span>
            <ul>
              <li>README.md</li>
              <li>OperatorVault.sol</li>
              <li>execute.ts</li>
              <li>contracts.ts</li>
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
