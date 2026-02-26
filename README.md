# SHLL Skills — AI Agent DeFi Toolkit on BSC

A CLI toolkit that gives **any AI agent** (OpenClaw, Claude, Codex, ChatGPT, etc.) the ability to execute DeFi operations on BSC Mainnet securely. All transactions are validated by the on-chain PolicyGuard — even if the AI hallucinates, the contract rejects unsafe operations.

## 📦 Install

```bash
npm install -g shll-skills
```

## 🚀 Quick Start

```bash
export RUNNER_PRIVATE_KEY="0x..."

# 1. One-click onboarding: rent agent + authorize + fund vault
shll-onchain-runner init --listing-id 0xABC...DEF --days 30 --fund 0.5
# → Agent #5 is ready!

# 2. Trade
shll-onchain-runner swap --from BNB --to USDC --amount 0.1 --token-id 5
```

## 📋 Commands

### Onboarding
```bash
shll-onchain-runner init --listing-id <BYTES32> --days <N> [--fund <BNB>]
```

### Trading & Asset Management
```bash
shll-onchain-runner swap --from <TOKEN> --to <TOKEN> --amount <N> -k <ID> [--slippage <PERCENT>]
shll-onchain-runner wrap --amount <BNB> -k <ID>         # BNB → WBNB
shll-onchain-runner unwrap --amount <BNB> -k <ID>       # WBNB → BNB
shll-onchain-runner transfer --token <SYM> --amount <N> --to <ADDR> -k <ID>
shll-onchain-runner raw --target <ADDR> --data <HEX> -k <ID>
```

### Market Data (read-only, no key needed)
```bash
shll-onchain-runner portfolio -k <ID>        # Vault holdings + USD values
shll-onchain-runner price --token <SYM>      # Real-time price (DexScreener)
shll-onchain-runner search --query <TEXT>     # Find token by name on BSC
shll-onchain-runner tokens                   # List known token addresses
```

### Risk Management
```bash
shll-onchain-runner policies -k <ID>         # View active policies
shll-onchain-runner config -k <ID> --tx-limit <BNB> --daily-limit <BNB> --cooldown <SEC>
```

## 🤖 AI Agent Integration

This skill outputs **structured JSON** on stdout, making it easy for any AI agent to parse:

```json
{"status":"success","tx":"0xabc...","message":"Swapped 0.1 BNB → 12.5 USDC"}
```

```json
{"status":"rejected","reason":"Spending limit exceeded"}
```

### For AI providers:
- **SKILL.md** — Structured skill metadata (name, description, commands, install instructions)
- **stdout** — JSON-only output, designed for programmatic parsing
- **stderr** — Human-readable errors
- **Exit codes** — `0` = success, `1` = failure

## 🔧 How It Works

```
AI Agent → CLI command → PolicyClient.validate() → PolicyGuard (on-chain) → execute via vault
```

1. AI constructs a CLI command based on user intent
2. `PolicyClient.validate()` simulates against all on-chain policies
3. If approved, `AgentNFA.execute()` routes through PolicyGuard → vault
4. PolicyGuard enforces: spending limits, cooldowns, DEX whitelist, receiver guard

## 🛡️ Security

- **On-chain enforcement** — PolicyGuard validates every transaction, not the AI
- **Vault isolation** — Operator key cannot directly access vault funds
- **Renter-only config** — Risk limits can only be tightened, never loosened
- **Safe by default** — Unknown selectors, targets, or recipients are rejected

## 📄 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RUNNER_PRIVATE_KEY` | ✅ | Operator/renter private key |
| `RPC_URL` | ❌ | BSC RPC (default: public endpoint) |
| `NFA_ADDRESS` | ❌ | AgentNFA contract override |
| `GUARD_ADDRESS` | ❌ | PolicyGuard contract override |

## 📜 License

MIT
