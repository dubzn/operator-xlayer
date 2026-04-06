# 01. Problem and Wedge

## The real problem
Autonomous agents need to act repeatedly. DeFi execution is not hard once; it becomes hard when the same system needs to make decisions and execute many times without constant human intervention.

Today that creates an ugly tradeoff:
- If the owner gives the agent a private key or broad smart-wallet rights, the automation is powerful but dangerous.
- If the owner signs every transaction manually, the setup is safer but no longer autonomous.

This gets worse for treasury systems, policy-driven strategies, risk exits, and always-on agent workflows. The underlying issue is not "how do I do a swap". It is "how do I delegate repeated execution without handing over full custody".

## The wedge
The wedge is **vault-constrained execution by a paid operator**.

The model is simple:
- The owner puts capital in a vault.
- The owner defines what is allowed.
- A controller agent decides when to request an action.
- The controller signs a typed execution intent.
- The operator charges a per-job fee through `x402` and tries to execute.
- The vault enforces the rules onchain.

This creates a third option between unrestricted wallet delegation and manual signing.

## Who this is not for
`X402 Operator` is not intended for:
- casual users doing one-off swaps manually
- someone who already prefers to sign every action by hand
- a generic retail trading experience
- users looking for a broad social or marketplace product

If a person just wants to make a single swap, the vault plus operator setup is unnecessary overhead. The system only makes sense when repeated, policy-bounded execution matters.

## Who this is for
The first credible users are:
- treasury bots
- autonomous portfolio agents
- risk exit systems
- delegated DeFi workflows
- protocols that need repeatable execution but cannot trust arbitrary wallet delegation

## The framing that survived the debate
- The **vault** answers: "What is allowed to happen with this capital?"
- The **agent** answers: "When should something happen?"
- The **operator** answers: "How do I execute this safely and get paid?"

That framing is important because it keeps the system from collapsing into "just another trading bot". The operator is not the strategy brain. The controller agent is not the custodian. The owner is not approving each transaction manually. Each component has a narrow role.

## Why this wedge matters for the hackathon
The hackathon rewards projects that are native to the agent economy, deeply integrated with Onchain OS, meaningful within X Layer, and complete enough to judge automatically. A constrained execution primitive fits that shape better than a consumer-only app because:
- it can be consumed by other agents and protocols
- it has a natural `x402` revenue loop
- it has strong onchain activity and receipts
- it can showcase multiple Onchain OS components without becoming an app zoo
