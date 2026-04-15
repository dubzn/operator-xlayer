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
}

const PRODUCTION_BACKEND_URL = "https://operator-xlayer.onrender.com";

const DOC_SECTIONS = [
  {
    id: "docs-overview",
    label: "Overview",
    eyebrow: "Documentation",
    summary: "What it is and why it exists.",
  },
  {
    id: "docs-problem",
    label: "Real Problem",
    eyebrow: "Tradeoff",
    summary: "The custody vs autonomy tradeoff.",
  },
  {
    id: "docs-live",
    label: "What Is Live",
    eyebrow: "Current scope",
    summary: "What ships today.",
  },
  {
    id: "docs-system",
    label: "System",
    eyebrow: "Architecture",
    summary: "The four-role execution loop.",
  },
  {
    id: "docs-flow",
    label: "Execution Flow",
    eyebrow: "Runtime path",
    summary: "Preview to receipt.",
  },
  {
    id: "docs-mainnet",
    label: "Mainnet",
    eyebrow: "Reference surface",
    summary: "Live backend and key addresses.",
  },
  {
    id: "docs-api",
    label: "API",
    eyebrow: "Typed surface",
    summary: "Endpoints and signed payload.",
  },
  {
    id: "docs-security",
    label: "Security",
    eyebrow: "Hard boundaries",
    summary: "What the vault enforces.",
  },
  {
    id: "docs-faq",
    label: "FAQ",
    eyebrow: "Common questions",
    summary: "Quick answers.",
  },
] as const;

type DocSectionId = (typeof DOC_SECTIONS)[number]["id"];

const DEFAULT_SECTION: DocSectionId = "docs-overview";

const PROBLEM_CARDS = [
  {
    title: "Broad custody is risky",
    body:
      "Giving an agent a wallet key makes execution easy, but the blast radius is too wide.",
  },
  {
    title: "Manual approval kills autonomy",
    body:
      "If the owner signs every action, the agent stops being operationally useful.",
  },
  {
    title: "Bounded execution is the wedge",
    body:
      "Keep capital in a vault, let the controller sign intent, and let policy decide whether funds can move.",
  },
] as const;

const LIVE_NOW = [
  {
    title: "Delegated swaps",
    body:
      "A focused swap-v2 path instead of a broad automation claim.",
  },
  {
    title: "Vault + policy",
    body:
      "Vault, adapter, registry, and onchain policy checks are already wired.",
  },
  {
    title: "Preview binding",
    body:
      "Preview returns the exact package later signed and executed.",
  },
  {
    title: "Paid execution",
    body:
      "POST /execute is gated by x402 and successful jobs leave receipts.",
  },
] as const;

const NOT_CLAIMING = [
  "lending or staking flows",
  "many operators",
  "a consumer trading app",
  "a bot-builder inside the product",
] as const;

const PACKAGE_MAP = [
  { title: "packages/contracts", body: "Vault contracts." },
  { title: "packages/backend", body: "Operator API." },
  { title: "packages/shared", body: "Types and hashes." },
  { title: "packages/agent", body: "Demo controller." },
  { title: "packages/frontend", body: "Vault UI + docs." },
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
    body: "Funds the vault and defines policy.",
  },
  {
    title: "Controller agent",
    body: "Requests preview, signs, and pays.",
  },
  {
    title: "Operator backend",
    body: "Quotes, validates, charges, and executes.",
  },
  {
    title: "OperatorVault",
    body: "The vault decides if capital can move.",
  },
  {
    title: "Swap adapter",
    body: "Venue abstraction. Current path: OKX.",
  },
  {
    title: "ExecutionRegistry",
    body: "Public receipts and success count.",
  },
] as const;

const FLOW_STEPS = [
  {
    step: "01",
    title: "Vault ready",
    body: "Owner funds the vault and sets policy.",
  },
  {
    step: "02",
    title: "Preview",
    body: "Backend quotes and returns a signable package.",
  },
  {
    step: "03",
    title: "Sign",
    body: "Controller signs the exact intent.",
  },
  {
    step: "04",
    title: "Pay + execute",
    body: "POST /execute can return 402; caller pays and retries.",
  },
  {
    step: "05",
    title: "Receipt",
    body: "Vault re-checks policy onchain and records the result.",
  },
] as const;

const NETWORK_FACTS = [
  { label: "Network", value: "X Layer Mainnet" },
  { label: "Chain ID", value: String(CHAIN_ID) },
  { label: "RPC URL", value: RPC_URL },
  { label: "Native currency", value: NATIVE_SYMBOL },
  { label: "Explorer", value: EXPLORER_URL },
  { label: "Backend API", value: PRODUCTION_BACKEND_URL },
] as const;

const DEPLOYMENT_ADDRESSES = [
  {
    label: "VaultFactory",
    value: ADDRESSES.factory,
  },
  {
    label: "ExecutionRegistry",
    value: ADDRESSES.registry,
  },
  {
    label: "OKX Swap Adapter",
    value: ADDRESSES.swapAdapter,
  },
  {
    label: "Reference Vault",
    value: ADDRESSES.initialVault,
  },
  {
    label: "Operator",
    value: ADDRESSES.operator,
  },
] as const;

const INITIAL_POLICY = [
  { label: "Base token", value: "USDT" },
  { label: "Allowed output token", value: "USDC" },
  { label: "Token policy", value: "Allowlisted inputs + outputs" },
  { label: "Default swap adapter", value: "OKX" },
  { label: "Operator", value: "Shared" },
  { label: "Authorized controller", value: "1 controller" },
] as const;

const ENDPOINTS = [
  {
    method: "POST",
    path: "/preview",
    body: "Returns quote + signable package.",
  },
  {
    method: "POST",
    path: "/execute",
    body: "Validates, charges x402, and submits execution.",
  },
  {
    method: "GET",
    path: "/receipts/:jobId",
    body: "Fetch receipt by jobId.",
  },
  {
    method: "GET",
    path: "/operator/track-record",
    body: "Return the success counter.",
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

const FORMULA_SNIPPET = `policyMinAmountOut = quotedAmountOut * (10_000 - maxSlippageBps) / 10_000
jobId = keccak256(intentHash, paymentReference)`;

const SECURITY_GUARDS = [
  "vault not paused",
  "controller is authorized",
  "nonce and deadline are valid",
  "adapter is allowlisted",
  "input and output token allowlists pass",
  "trade caps, daily volume, and cooldown pass",
  "executionData hash matches intent",
  "minAmountOut still meets policy",
] as const;

const MONEY_FLOWS = [
  {
    title: "Vault capital",
    body: "Owner funds it. It moves only if policy passes.",
  },
  {
    title: "Operator fee",
    body: "Caller pays for execution. It never grants custody.",
  },
] as const;

const OKX_DIFFERENCE = [
  "custody separation",
  "controller authorization",
  "token-level execution policy",
  "typed quote binding",
  "x402 monetization",
  "public receipts and operator track record",
] as const;

const FAQS = [
  {
    question: "Is this just a relayer?",
    answer:
      "No. It adds custody separation, typed intent approval, onchain policy, x402 monetization, and receipts.",
  },
  {
    question: "Is x402 paying for access to the vault?",
    answer:
      "No. x402 pays the operator for execution. Capital still stays behind vault policy.",
  },
  {
    question: "What happens if the controller is compromised?",
    answer:
      "The owner can pause the vault and revoke the controller. Policy still limits blast radius.",
  },
  {
    question: "What happens if execution fails after payment?",
    answer:
      "In the current MVP, the fee pays for the attempt, not a guaranteed fill.",
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

function DocumentationPage({ isConnected: _isConnected }: DocumentationPageProps) {
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

  const sectionViews: Record<DocSectionId, ReactNode> = {
    "docs-overview": (
      <section className="docs-section glass-card">
        <div className="docs-section-lead">
          <p className="eyebrow">Overview</p>
          <h2 className="display-text">X402 Operator - X Layer</h2>
        </div>

        <blockquote className="docs-overview-quote">
          <p>The secure execution rail for agents on X Layer.</p>
        </blockquote>

        <div className="docs-overview-copy">
          <p>X402 Operator is our Build X Hackathon submission for the X Layer Arena.</p>
          <p>
            The wedge is simple: agents should be able to execute real swaps without
            receiving broad wallet custody. We solve that by separating four roles:
          </p>

          <ul className="docs-overview-list">
            <li>the owner keeps capital in an onchain vault</li>
            <li>the owner defines policy guardrails</li>
            <li>a controller agent decides when to act</li>
            <li>the operator sells execution as a paid API via `x402`</li>
          </ul>

          <p>Every successful execution leaves an onchain receipt.</p>
        </div>
      </section>
    ),
    "docs-problem": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="The real problem"
          title="Why execution becomes hard once an agent touches capital"
          copy="Broad custody is risky. Manual approval breaks autonomy."
        />

        <div className="docs-card-grid docs-card-grid-2">
          {PROBLEM_CARDS.map((item) => (
            <article key={item.title} className="docs-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>

        <div className="docs-risk-callout">
          <span className="docs-mini-label">Best fit</span>
          <p>Good fit for rebalancers, rotators, treasury automation, and repeatable agent actions.</p>
        </div>
      </section>
    ),
    "docs-live": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="What is live today"
          title="A narrow swap-v2 slice"
          copy="The current build focuses on one execution path and keeps the claim tight."
        />

        <div className="docs-card-grid docs-card-grid-2">
          {LIVE_NOW.map((item) => (
            <article key={item.title} className="docs-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>

        <div className="docs-risk-callout">
          <span className="docs-mini-label">Not claiming</span>
          <p>Not yet {NOT_CLAIMING.join(", ")}.</p>
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
          copy="Each part has one job: capital, decision, execution, or proof."
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
          copy="Preview, sign, pay, execute, receipt."
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

        <div className="docs-risk-callout">
          <span className="docs-mini-label">Demo flow</span>
          <p>Show vault, preview, 402 payment, and final receipt.</p>
        </div>
      </section>
    ),
    "docs-mainnet": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="Mainnet reference"
          title="Live surface"
          copy="Production backend plus the key addresses wired into the app."
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
            </article>
          ))}
        </div>

        <div className="docs-policy-panel">
          <div className="docs-policy-copy">
            <span className="docs-mini-label">Reference demo policy</span>
            <h3>Configured for a crisp first live path</h3>
            <p>Small, legible, and easy to demo.</p>
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
          copy="Preview and execute must agree on the exact package."
        />

        <div className="docs-risk-callout">
          <span className="docs-mini-label">Production base URL</span>
          <p>
            Mainnet operator backend: <code>{PRODUCTION_BACKEND_URL}</code>
          </p>
        </div>

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
        </div>

        <div className="docs-risk-callout">
          <span className="docs-mini-label">Execution binding</span>
          <p>The controller signs the exact package returned by preview.</p>
        </div>
      </section>
    ),
    "docs-security": (
      <section className="docs-section glass-card">
        <SectionLead
          eyebrow="Security model"
          title="The vault is the real trust boundary"
          copy="The operator is useful, but the vault still decides whether capital can move."
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
            <h3>More than routing</h3>
            <p>X402 Operator adds:</p>
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
          copy="Short answers for the common objections."
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
          <p>Short, scannable docs for the live X402 Operator flow.</p>
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
        </aside>

        <div className="docs-content">
          <div className="docs-view">{sectionViews[activeSection]}</div>

          <div className="docs-view-footer glass-card">
            <div className="docs-view-footer-copy">
              <span className="docs-mini-label">{activeMeta.eyebrow}</span>
              <strong>{activeMeta.label}</strong>
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
