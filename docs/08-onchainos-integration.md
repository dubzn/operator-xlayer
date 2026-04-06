# 08. Onchain OS Integration

## Integration philosophy
The project should prefer **3-4 deep integrations over 6 shallow ones**. Using many labels is less valuable than proving a few integrations matter in the core loop.

## MVP services

### Wallet / Agentic Wallet
**Why it exists**
- gives the operator a clear onchain identity
- receives operator execution fees
- can be used to sign or submit service-related transactions

**Blocking for MVP**
- yes

**Feeds**
- operator identity
- fee receipt destination
- execution transaction sender role

### Trade / DEX
**Why it exists**
- provides route and quote data for planned execution
- supports the actual swap or execution path

**Blocking for MVP**
- yes

**Feeds**
- preview output
- execution preparation
- receipt metadata such as route or quoted expectations

### Market
**Why it exists**
- provides market context for the preview and optional execution checks
- helps justify that the operator is not blindly firing transactions

**Blocking for MVP**
- recommended, but lighter than Trade

**Feeds**
- preview context
- market sanity checks
- optional display data in the console

### Security
**Why it exists**
- screens assets or routes for obvious safety issues
- makes the operator feel more deliberate and less like a raw relay

**Blocking for MVP**
- recommended

**Feeds**
- preview warnings
- execution pre-flight checks

## Stretch-only service
### Portfolio
Portfolio is interesting for richer before/after vault snapshots and monitoring, but it is not required to prove the main concept.

**Use only if**
- it clearly improves receipt quality or the console
- the integration is straightforward
- it does not displace core work on vault enforcement or payment flow

## Integration priorities
1. Wallet / Agentic Wallet
2. Trade / DEX
3. Security
4. Market
5. Portfolio only if time remains

## MVP decision
Portfolio is explicitly **stretch-only**. It should not block contracts, typed intent validation, `x402`, or the controller demo flow.

## Anti-pattern to avoid
Do not inflate the project by claiming every available module while only using each one superficially. The hackathon pitch is stronger if every listed integration is part of the critical execution path.
