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
    id: "docs-overview",
    label: "Overview",
    eyebrow: "Documentation",
    summary:
      "High-level context: what X402 Operator is, what wedge it pursues, and how the product is framed for Build X.",
  },
  {
    id: "docs-problem",
    label: "Real Problem",
    eyebrow: "Tradeoff",
    summary:
      "Why agent execution is hard once real capital is involved and why broad wallet delegation is the wrong default.",
  },
  {
    id: "docs-live",
    label: "What Is Live",
    eyebrow: "Current scope",
    summary:
      "What the repo already ships today, what is intentionally excluded, and where the current product boundary sits.",
  },
  {
    id: "docs-system",
    label: "System",
    eyebrow: "Architecture",
    summary:
      "The system in one minute: owner, controller, operator, vault, adapter, and registry.",
  },
  {
    id: "docs-flow",
    label: "Execution Flow",
    eyebrow: "Runtime path",
    summary:
      "The end-to-end delegated swap loop plus the demo sequence that makes the product legible quickly.",
  },
  {
    id: "docs-mainnet",
    label: "Mainnet",
    eyebrow: "Reference surface",
    summary:
      "Current X Layer constants, frontend-wired addresses, and the reference policy used in the default demo path.",
  },
  {
    id: "docs-api",
    label: "API",
    eyebrow: "Typed surface",
    summary:
      "Endpoints, ExecutionIntent, formulas, and the exact fields that bind preview to execution.",
  },
  {
    id: "docs-security",
    label: "Security",
    eyebrow: "Hard boundaries",
    summary:
      "What the vault enforces onchain, why x402 belongs in the flow, and why the product is more than OKX routing.",
  },
  {
    id: "docs-faq",
    label: "FAQ",
    eyebrow: "Common questions",
    summary:
      "Short answers to the questions integrators, contributors, and protocol partners usually ask first.",
  },
] as const;

type DocSectionId = (typeof DOC_SECTIONS)[number]["id"];

const DEFAULT_SECTION: DocSectionId = "docs-overview";

const OVERVIEW_CARDS = [
  {
    title: "Build X submission",
    body:
      "X402 Operator is our Build X Hackathon submission for the X Layer Arena.",
  },
  {
    title: "One-line pitch",
    body:
      "The secure execution rail for agents on X Layer: owners keep custody in policy-bound vaults, controllers sign exact execution packages, the operator charges via x402, and every successful job leaves a public onchain receipt.",
  },
  {
    title: "Core wedge",
    body:
      "Agents should be able to execute real swaps without receiving broad wallet custody. The system separates capital, policy, decision-making, and paid execution into narrow roles.",
  },
] as const;

const PROBLEM_CARDS = [
  {
    title: "Where agent demos usually stop",
    body:
      "Most agent demos stop at decision-making. The hard part begins when an agent needs to touch real capital repeatedly.",
  },
  {
    title: "Bad option one",
    body:
      "If you give the agent a private key or broad wallet delegation, execution is powerful but dangerous.",
  },
  {
    title: "Bad option two",
    body:
      "If the owner signs every action manually, execution is safer but no longer autonomous.",
  },
  {
    title: "The third option",
    body:
      "Capital stays in a vault, authority stays bounded by policy, the controller signs a typed intent, the operator gets paid for execution-as-a-service, and the vault re-validates everything onchain before capital can move.",
  },
  {
    title: "Who this is for",
    body:
      "Trader agents, rebalancers, portfolio rotators, treasury automation systems, protocol integrations, and multi-agent systems where one agent decides and another pays.",
  },
  {
    title: "Who this is not for",
    body:
      "It is not meant for casual manual one-off swaps, broad consumer trading UX, or a product where users build strategies inside the app.",
  },
] as const;

const LIVE_NOW = [
  {
    title: "Delegated spot-swap execution",
    body:
      "The current repo implements a narrow but credible swap-v2 execution slice instead of pretending to be a universal protocol automation layer.",
  },
  {
    title: "Full contract surface",
    body:
      "VaultFactory, OperatorVault, OkxAggregatorSwapAdapter, and ExecutionRegistry are implemented and wired together around delegated swap execution.",
  },
  {
    title: "Policy controls",
    body:
      "Controllers, input tokens, output tokens, pairs, adapters, per-trade caps, daily volume, slippage, and cooldown are all part of the current flow.",
  },
  {
    title: "Typed quote binding",
    body:
      "Preview drives the final signable package through executionHash and EIP-712 intents using version 2.",
  },
  {
    title: "Paid execution path",
    body:
      "POST /execute is gated by x402, and successful executions update public receipts plus the operator success count.",
  },
  {
    title: "Repo includes the full story",
    body:
      "There is a reference controller agent in packages/agent and a frontend console with in-app documentation in packages/frontend.",
  },
] as const;

const NOT_CLAIMING = [
  "a universal execution primitive for every DeFi action",
  "an open marketplace of many operators",
  "a full reputation economy",
  "a consumer trading app",
  "a bot builder where users create strategies inside the product",
] as const;

const PACKAGE_MAP = [
  { title: "packages/contracts", body: "Vault, factory, adapter, registry." },
  { title: "packages/backend", body: "Preview, execute, payment checks, submission." },
  { title: "packages/shared", body: "ExecutionIntent types, hashes, EIP-712 helpers." },
  { title: "packages/agent", body: "Reference controller agent that signs and pays." },
  { title: "packages/frontend", body: "Vault console plus this documentation layer." },
] as const;

const SYSTEM_ASCII = `┌──────────────┐   preview + sign   ┌──────────────┐   executeSwap   ┌──────────────┐
│ Controller   │ ─────────────────▶ │   Operator   │ ──────────────▶ │ OperatorVault │
│   Agent      │   pays fee (402)   │   Backend    │   via adapter   │   (onchain)   │
└──────────────┘                    └──────────────┘                  └──────────────┘
        │                                     │                               │
        │                                     │                               ▼
        │                                     │                        ┌──────────────┐
        │                                     └──── OKX DEX quote ───▶ │ Execution    │
        │                                                              │ Registry     │
        └──────────── preview / execute API ◀───────────────────────────└──────────────┘`;

const ROLE_CARDS = [
  {
    title: "Vault owner",
    body:
      "Deposits capital, defines policy, authorizes controllers, and can pause or withdraw.",
  },
  {
    title: "Controller agent",
    body:
      "Requests preview, signs the final intent, and pays the operator fee.",
  },
  {
    title: "Operator backend",
    body:
      "Quotes, validates, enforces x402, and submits execution.",
  },
  {
    title: "OperatorVault",
    body:
      "The hard trust boundary. Capital only moves if policy allows it.",
  },
  {
    title: "Swap adapter",
    body:
      "Venue abstraction. Today the backend supports the OKX adapter.",
  },
  {
    title: "ExecutionRegistry",
    body:
      "Public receipt ledger plus simple operator track record.",
  },
] as const;

const FLOW_STEPS = [
  {
    step: "01",
    title: "Owner creates and funds the vault",
    body:
      "The owner creates a vault, deposits capital, and prepares the execution boundary before any agent can act.",
  },
  {
    step: "02",
    title: "Owner configures policy",
    body:
      "Controllers, token allowlists, pair allowlists, adapter allowlists, and risk limits are configured onchain.",
  },
  {
    step: "03",
    title: "Controller requests preview",
    body:
      "The backend reads live vault state, asks OKX DEX for a route, computes executionHash, derives a policy-safe minAmountOut, and returns the final signable package.",
  },
  {
    step: "04",
    title: "Controller signs the final intent",
    body:
      "The controller signs the final EIP-712 ExecutionIntent rather than approving a vague instruction.",
  },
  {
    step: "05",
    title: "Execute enforces x402",
    body:
      "If there is no payment yet, the backend returns HTTP 402. The controller pays and retries with paymentReference.",
  },
  {
    step: "06",
    title: "Backend validates and executes",
    body:
      "Payment, signature, cached quote, and current vault state are checked before the backend calls vault.executeSwap.",
  },
  {
    step: "07",
    title: "Vault re-validates onchain",
    body:
      "The vault checks policy again onchain before allowing capital to move and writing a receipt through ExecutionRegistry.",
  },
] as const;

const DEMO_STEPS = [
  "Show the problem: wallet delegation is dangerous, manual signing kills autonomy.",
  "Show the vault: funded vault, policy fields, authorized controller, and operator.",
  "Show preview: ExecutionIntent fields, expectedOut, minAmountOut, and executionHash.",
  "Show x402: POST /execute, HTTP 402, and fee payment.",
  "Show enforcement: backend attempts execution and the vault still re-validates onchain.",
  "Show the receipt: tx hash, receipt, and operator track record update.",
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
    label: "VaultFactory",
    value: ADDRESSES.factory,
    note: "Current factory address wired into the frontend config.",
  },
  {
    label: "ExecutionRegistry",
    value: ADDRESSES.registry,
    note: "Current registry address wired into the frontend config.",
  },
  {
    label: "OKX Swap Adapter",
    value: ADDRESSES.swapAdapter,
    note: "Swap adapter address used by the current delegated execution path.",
  },
  {
    label: "Reference Vault",
    value: ADDRESSES.initialVault,
    note: "Current reference vault used by the default live path.",
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
  { label: "Default swap adapter", value: "OKX" },
  { label: "Operator", value: "One shared operator" },
  { label: "Authorized controller", value: "One initial authorized controller" },
] as const;

const ENDPOINTS = [
  {
    method: "POST",
    path: "/preview",
    body:
      "Build the signable execution package and run free preflight checks.",
  },
  {
    method: "POST",
    path: "/execute",
    body:
      "Enforce x402, validate the final payload, and submit execution.",
  },
  {
    method: "GET",
    path: "/receipts/:jobId",
    body:
      "Fetch the public receipt from ExecutionRegistry.",
  },
  {
    method: "GET",
    path: "/operator/track-record",
    body:
      "Return the current onchain success counter.",
  },
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

const SIGNED_FIELDS = [
  "vault address",
  "controller address",
  "adapter",
  "token pair",
  "amount",
  "quote-derived output bounds",
  "nonce",
  "deadline",
  "executionHash",
] as const;

const FORMULA_SNIPPET = `policyMinAmountOut = quotedAmountOut * (10_000 - maxSlippageBps) / 10_000
jobId = keccak256(intentHash, paymentReference)`;

const SECURITY_GUARDS = [
  "vault not paused",
  "intent.vaultAddress matches the vault contract",
  "selected adapter is allowlisted",
  "recovered signer matches intent.controller",
  "controller is currently authorized",
  "nonce is unused",
  "deadline has not expired",
  "tokenIn is allowlisted",
  "tokenOut is allowlisted",
  "tokenIn -> tokenOut pair is allowlisted",
  "amountIn fits the single-trade cap",
  "daily volume cap is respected",
  "cooldown has elapsed",
  "keccak256(executionData) == intent.executionHash",
  "intent.minAmountOut is not weaker than the policy floor",
  "realized amountOut still satisfies intent.minAmountOut",
] as const;

const MONEY_FLOWS = [
  {
    title: "Vault capital",
    body:
      "Belongs to the owner, remains inside the vault, and is only touched by successful swap execution if policy allows it.",
  },
  {
    title: "Operator fee",
    body:
      "Is paid by the caller agent, pays for execution-as-a-service, and does not grant permission to move vault capital.",
  },
] as const;

const OKX_DIFFERENCE = [
  "custody separation",
  "controller authorization",
  "pair-level execution policy",
  "typed quote binding",
  "x402 monetization",
  "public receipts and operator track record",
] as const;

const FAQS = [
  {
    question: "Does the user create their own agent?",
    answer:
      "Not necessarily. The owner authorizes a controller address. That controller can be the repo demo agent, a private bot, a third-party strategy agent, or a protocol integration.",
  },
  {
    question: "Is this just a relayer?",
    answer:
      "No. A relayer forwards transactions. X402 Operator adds custody separation, typed intent approval, onchain execution policy, x402 monetization, and public receipts.",
  },
  {
    question: "Is x402 paying for access to the vault?",
    answer:
      "No. x402 pays the operator for execution-as-a-service. The capital remains in the vault and can only move if the signed request also passes the vault policy.",
  },
  {
    question: "Is this just an OKX wrapper?",
    answer:
      "No. OKX provides routing and calldata. X402 Operator adds the custody boundary, controller authorization, quote binding, x402 monetization, and onchain receipts.",
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
    question: "What happens if execution fails after payment?",
    answer:
      "In the current MVP, the fee pays for the execution attempt, not a guaranteed fill. That is why preview and pre-validation happen before the x402 challenge.",
  },
] as const;

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

  function goToNeighbor(direction: -1 | 1) {
    const currentIndex = DOC_SECTIONS.findIndex((section) => section.id === activeSection);
    const target = DOC_SECTIONS[currentIndex + direction];
    if (target) {
      selectSection(target.id);
    }
  }

  const activeIndex = DOC_SECTIONS.findIndex((section) => section.id === activeSection);
  const activeMeta = DOC_SECTIONS[activeIndex];
  const progressPercent = ((activeIndex + 1) / DOC_SECTIONS.length) * 100;

  const overviewShortcuts = [
    {
      title: "What is live",
      body: "Current scope, what exists today, and the current product boundary.",
      target: "docs-live" as const,
    },
    {
      title: "Mainnet reference",
      body: "Current X Layer constants, addresses, and reference policy.",
      target: "docs-mainnet" as const,
    },
    {
      title: "API surface",
      body: "Endpoints, ExecutionIntent, and executionHash binding.",
      target: "docs-api" as const,
    },
  ];

  const sectionViews: Record<DocSectionId, ReactNode> = {
    "docs-overview": (
      <>
        <section className="docs-hero glass-card">
          <div className="docs-hero-copy">
            <p className="hero-pill">Build X Hackathon · X Layer Arena</p>
            <h2 className="display-text docs-hero-title">
              The secure execution rail for agents on X Layer.
            </h2>
            <p className="docs-hero-text">
              Owners keep capital inside policy-bound vaults, controller agents
              sign exact execution packages, the operator charges via x402, and every
              successful job leaves an onchain receipt.
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
                <span className="docs-stat-label">Core roles</span>
                <strong>4</strong>
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
              <span className="docs-blueprint-tag">Capital</span>
              <strong>Owner</strong>
              <p>Keeps custody and defines policy guardrails.</p>
            </div>
            <div className="docs-blueprint-link" />
            <div className="docs-blueprint-node">
              <span className="docs-blueprint-tag">Decision</span>
              <strong>Controller</strong>
              <p>Decides when to act and signs the final typed package.</p>
            </div>
            <div className="docs-blueprint-link" />
            <div className="docs-blueprint-node">
              <span className="docs-blueprint-tag">Execution</span>
              <strong>Operator</strong>
              <p>Sells execution-as-a-service and submits the transaction.</p>
            </div>
            <div className="docs-blueprint-link" />
            <div className="docs-blueprint-node">
              <span className="docs-blueprint-tag">Proof</span>
              <strong>Receipt</strong>
              <p>Every successful job leaves a public onchain trace.</p>
            </div>
          </div>
        </section>

        <section className="docs-section glass-card">
          <SectionLead
            eyebrow="Overview"
            title="What this documentation is trying to explain"
            copy="The product should feel simple once the four roles are clear: the owner keeps capital in an onchain vault, the owner defines policy guardrails, a controller agent decides when to act, and the operator sells execution as a paid API via x402."
          />

          <div className="docs-card-grid docs-card-grid-3">
            {OVERVIEW_CARDS.map((item) => (
              <article key={item.title} className="docs-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      </>
    ),
    "docs-problem": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="The real problem"
          title="Why execution becomes hard once an agent touches capital"
          copy="Most agent demos stop at decision-making. The hard part begins when an agent needs to act repeatedly on real capital without either receiving broad wallet custody or forcing the owner to sign every transaction manually."
        />

        <div className="docs-card-grid docs-card-grid-2">
          {PROBLEM_CARDS.map((item) => (
            <article key={item.title} className="docs-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    ),
    "docs-live": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="What is live today"
          title="The current repo already proves a narrow but credible swap-v2 slice"
          copy="The current implementation is intentionally narrow. That is a strength: it solves one real execution problem clearly instead of overreaching into every protocol action at once."
        />

        <div className="docs-card-grid docs-card-grid-3">
          {LIVE_NOW.map((item) => (
            <article key={item.title} className="docs-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>

        <div className="docs-risk-callout">
          <span className="docs-mini-label">What we are intentionally not claiming</span>
          <p>
            This is not yet {NOT_CLAIMING.join(", ")}. That restraint keeps the story
            honest and the demo sharp.
          </p>
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
    "docs-system": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="System in one minute"
          title="A delegated execution loop with narrow roles"
          copy="The system works because each component has a constrained job. The owner defines policy, the controller requests action, the operator performs paid execution, and the vault decides whether capital can move."
        />

        <div className="docs-snippet-grid">
          <article className="docs-snippet-card docs-snippet-card-wide">
            <span className="docs-mini-label">System overview</span>
            <pre>
              <code>{SYSTEM_ASCII}</code>
            </pre>
          </article>
        </div>

        <div className="docs-card-grid docs-card-grid-2">
          {ROLE_CARDS.map((item) => (
            <article key={item.title} className="docs-card docs-card-actor">
              <span className="docs-card-kicker">{item.title}</span>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    ),
    "docs-flow": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="Execution flow"
          title="From preview to receipt"
          copy="The flow is the product. Preview, signature, payment, execution, and receipt each answer a different question and become much less useful when they blur together."
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

        <div className="docs-card-grid docs-card-grid-3">
          {DEMO_STEPS.map((step) => (
            <article key={step} className="docs-card">
              <h3>Suggested demo flow</h3>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </section>
    ),
    "docs-mainnet": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="Mainnet reference"
          title="Current X Layer constants and addresses"
          copy="These values come from the current frontend config and define the reference surface exposed by the running app and the repo today."
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
            <h3>Configured for a crisp first live path</h3>
            <p>
              The current frontend and deployment flow are optimized for a small,
              legible demo path rather than a broad product claim.
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
          eyebrow="API surface"
          title="Typed payloads, not fuzzy prompts"
          copy="The controller is supposed to integrate against a deterministic API. That matters because preview, signature, payment, and execution all need to agree about the exact package before capital can move."
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
            <span className="docs-mini-label">Critical formulas</span>
            <pre>
              <code>{FORMULA_SNIPPET}</code>
            </pre>
          </article>

          <article className="docs-snippet-card docs-snippet-card-wide">
            <span className="docs-mini-label">Why executionHash matters</span>
            <pre>
              <code>{SIGNED_FIELDS.map((field) => `- ${field}`).join("\n")}</code>
            </pre>
          </article>
        </div>

        <div className="docs-risk-callout">
          <span className="docs-mini-label">Execution binding</span>
          <p>
            The controller is not signing a vague instruction like "swap into safety".
            It signs the exact execution package that came back from preview, which
            keeps preview and execution tightly bound without forcing the controller to
            parse router calldata directly.
          </p>
        </div>
      </section>
    ),
    "docs-security": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="Security model"
          title="The vault is the real trust boundary"
          copy="Every delegated swap still goes through hard checks in the vault. That is the core claim of the project: the operator is useful, but the operator is not a broad custodian."
        />

        <div className="docs-guard-grid">
          {SECURITY_GUARDS.map((guard) => (
            <article key={guard} className="docs-guard-card">
              <span className="docs-guard-dot" />
              <p>{guard}</p>
            </article>
          ))}
        </div>

        <div className="docs-card-grid docs-card-grid-2">
          <article className="docs-card">
            <h3>Why x402 belongs here</h3>
            {MONEY_FLOWS.map((flow) => (
              <p key={flow.title}>
                <strong>{flow.title}:</strong> {flow.body}
              </p>
            ))}
          </article>

          <article className="docs-card">
            <h3>Why this is more than OKX routing</h3>
            <p>
              OKX provides route discovery and calldata. X402 Operator adds:
            </p>
            <p>{OKX_DIFFERENCE.join(", ")}.</p>
          </article>
        </div>
      </section>
    ),
    "docs-faq": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="FAQ"
          title="Questions that usually matter first"
          copy="These answers stay close to the current product boundary and to the same wedge used across the root README."
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
            The same story as the root README, presented inside the frontend: problem,
            current scope, system design, flow, mainnet reference, API, security, and
            FAQ.
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
              The product becomes much easier to understand when the trust boundary, the
              x402 fee rail, and the onchain receipt surface are visible in one place.
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
