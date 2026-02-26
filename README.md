# SHLL Skills 鈥?AI Agent DeFi Toolkit on BSC

[![Website](https://img.shields.io/badge/Website-shll.run-blue)](https://shll.run) [![Twitter](https://img.shields.io/badge/Twitter-@shllrun-1DA1F2)](https://twitter.com/shllrun) [![npm](https://img.shields.io/npm/v/shll-skills)](https://www.npmjs.com/package/shll-skills)

A CLI toolkit that gives **any AI agent** (OpenClaw, Claude, Codex, ChatGPT, etc.) the ability to execute DeFi operations on BSC Mainnet securely. All transactions are validated by the on-chain PolicyGuard 鈥?even if the AI hallucinates, the contract rejects unsafe operations.

## 馃摝 Install

```bash
npm install -g shll-skills
```

## 馃殌 Quick Start

```bash
export RUNNER_PRIVATE_KEY="0x..."

# 1. One-click onboarding: rent agent + authorize + fund vault
shll-run init --listing-id 0xABC...DEF --days 30 --fund 0.5
# 鈫?Agent #5 is ready!

# 2. Trade
shll-run swap --from BNB --to USDC --amount 0.1 --token-id 5
```

## 馃搵 Commands

### Onboarding
```bash
shll-run init --listing-id <BYTES32> --days <N> [--fund <BNB>]
```

### Trading & Asset Management
```bash
shll-run swap --from <TOKEN> --to <TOKEN> --amount <N> -k <ID> [--slippage <PERCENT>]
shll-run wrap --amount <BNB> -k <ID>         # BNB 鈫?WBNB
shll-run unwrap --amount <BNB> -k <ID>       # WBNB 鈫?BNB
shll-run transfer --token <SYM> --amount <N> --to <ADDR> -k <ID>
shll-run raw --target <ADDR> --data <HEX> -k <ID>
```

### Market Data (read-only, no key needed)
```bash
shll-run portfolio -k <ID>        # Vault holdings + USD values
shll-run price --token <SYM>      # Real-time price (DexScreener)
shll-run search --query <TEXT>     # Find token by name on BSC
shll-run tokens                   # List known token addresses
```

### Risk Management
```bash
shll-run policies -k <ID>         # View active policies
shll-run config -k <ID> --tx-limit <BNB> --daily-limit <BNB> --cooldown <SEC>
```

## 馃 AI Agent Integration

This skill outputs **structured JSON** on stdout, making it easy for any AI agent to parse:

```json
{"status":"success","tx":"0xabc...","message":"Swapped 0.1 BNB 鈫?12.5 USDC"}
```

```json
{"status":"rejected","reason":"Spending limit exceeded"}
```

### For AI providers:
- **SKILL.md** 鈥?Structured skill metadata (name, description, commands, install instructions)
- **stdout** 鈥?JSON-only output, designed for programmatic parsing
- **stderr** 鈥?Human-readable errors
- **Exit codes** 鈥?`0` = success, `1` = failure

## 馃敡 How It Works

```
AI Agent 鈫?CLI command 鈫?PolicyClient.validate() 鈫?PolicyGuard (on-chain) 鈫?execute via vault
```

1. AI constructs a CLI command based on user intent
2. `PolicyClient.validate()` simulates against all on-chain policies
3. If approved, `AgentNFA.execute()` routes through PolicyGuard 鈫?vault
4. PolicyGuard enforces: spending limits, cooldowns, DEX whitelist, receiver guard

## 馃洝锔?Security

- **On-chain enforcement** 鈥?PolicyGuard validates every transaction, not the AI
- **Vault isolation** 鈥?Operator key cannot directly access vault funds
- **Renter-only config** 鈥?Risk limits can only be tightened, never loosened
- **Safe by default** 鈥?Unknown selectors, targets, or recipients are rejected

## 馃搫 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RUNNER_PRIVATE_KEY` | 鉁?| Operator/renter private key |
| `RPC_URL` | 鉂?| BSC RPC (default: public endpoint) |
| `NFA_ADDRESS` | 鉂?| AgentNFA contract override |
| `GUARD_ADDRESS` | 鉂?| PolicyGuard contract override |

## 馃敆 Links

- 馃寪 **Website**: [shll.run](https://shll.run)
- 馃惁 **Twitter**: [@shllrun](https://twitter.com/shllrun)
- 馃摝 **npm**: [shll-skills](https://www.npmjs.com/package/shll-skills)
- 馃捇 **GitHub**: [kledx/shll-skills](https://github.com/kledx/shll-skills)

## 馃摐 License

MIT

