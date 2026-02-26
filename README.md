# SHLL Skills — AI Agent DeFi Toolkit on BSC

[![Website](https://img.shields.io/badge/Website-shll.run-blue)](https://shll.run) [![Twitter](https://img.shields.io/badge/Twitter-@shllrun-1DA1F2)](https://twitter.com/shllrun) [![npm](https://img.shields.io/npm/v/shll-skills)](https://www.npmjs.com/package/shll-skills)

A CLI toolkit that gives **any AI agent** (OpenClaw, Claude, Codex, ChatGPT, etc.) the ability to execute DeFi operations on BSC Mainnet securely. All transactions are validated by the on-chain PolicyGuard — even if the AI hallucinates, the contract rejects unsafe operations.

## Install

```bash
npm install -g shll-skills
```

## Quick Start

```bash
# 1. Generate an operator wallet (hot wallet for AI)
shll-run generate-wallet
# -> Outputs address + private key

export RUNNER_PRIVATE_KEY="0x...(operator key)..."

# 2. Get setup instructions (user completes on shll.run with their OWN wallet)
shll-run setup-guide --listing-id 0xABC...DEF --days 30
# -> Outputs shll.run link for rent + authorize + fund

# 3. After setup, trade with your token-id
shll-run swap --from BNB --to USDC --amount 0.1 --token-id 5
```

## Commands

### Trading & Asset Management
```bash
shll-run swap --from <TOKEN> --to <TOKEN> --amount <N> -k <ID> [--slippage <PERCENT>]
shll-run wrap --amount <BNB> -k <ID>         # BNB -> WBNB
shll-run unwrap --amount <BNB> -k <ID>       # WBNB -> BNB
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

## AI Agent Integration

This skill outputs **structured JSON** on stdout, making it easy for any AI agent to parse:

```json
{"status":"success","tx":"0xabc...","message":"Swapped 0.1 BNB -> 12.5 USDC"}
```

```json
{"status":"rejected","reason":"Spending limit exceeded"}
```

### For AI providers:
- **SKILL.md** — Structured skill metadata (name, description, commands, install instructions)
- **stdout** — JSON-only output, designed for programmatic parsing
- **stderr** — Human-readable errors
- **Exit codes** — `0` = success, `1` = failure

## How It Works

```
AI Agent -> CLI command -> PolicyClient.validate() -> PolicyGuard (on-chain) -> execute via vault
```

1. AI constructs a CLI command based on user intent
2. `PolicyClient.validate()` simulates against all on-chain policies
3. If approved, `AgentNFA.execute()` routes through PolicyGuard -> vault
4. PolicyGuard enforces: spending limits, cooldowns, DEX whitelist, receiver guard

## Security: Dual-Wallet Architecture

SHLL enforces **separation of owner and operator wallets**:

| | Owner Wallet | Operator Wallet (RUNNER_PRIVATE_KEY) |
|---|---|---|
| **Who holds it** | User (MetaMask/hardware) | AI agent |
| **Can trade** | — | ✅ Within PolicyGuard limits |
| **Can withdraw vault** | ✅ | ❌ |
| **Can transfer NFT** | ✅ | ❌ |
| **Risk if leaked** | 🚨 Full vault access | ⚠️ Limited to policy-allowed trades |

**Additional on-chain enforcement:**
- PolicyGuard validates every transaction, not the AI
- Vault isolation — operator key cannot directly access vault funds
- Risk limits can only be tightened, never loosened
- Unknown selectors, targets, or recipients are rejected

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RUNNER_PRIVATE_KEY` | Yes | Operator wallet key (hot wallet, ~$1 BNB for gas) |
| `RPC_URL` | No | BSC RPC (default: public endpoint) |
| `NFA_ADDRESS` | No | AgentNFA contract override |
| `GUARD_ADDRESS` | No | PolicyGuard contract override |

## Updating

```bash
npm update -g shll-skills
```

## Links

- Website: [shll.run](https://shll.run)
- Twitter: [@shllrun](https://twitter.com/shllrun)
- npm: [shll-skills](https://www.npmjs.com/package/shll-skills)
- GitHub: [kledx/shll-skills](https://github.com/kledx/shll-skills)

## License

MIT
