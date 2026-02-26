# SHLL OpenClaw Skill (@shll/openclaw-skill)

A native [OpenClaw](https://openclaw.ai) skill for the SHLL Agent Protocol. Execute DeFi transactions on BSC securely — every action goes through PolicyGuard.

## 📦 Installation

```bash
cd repos/shll-openclaw-skill
npm install && npm run build
npm link                          # registers `shll-onchain-runner` CLI
cp .env.example .env              # edit with your private key
export RUNNER_PRIVATE_KEY="0x..."  # operator key
```

## 🚀 Quick Start

```bash
# 1. One-click onboarding: rent + authorize + fund
shll-onchain-runner init --listing-id 0xABC...DEF --days 30 --fund 0.5
# → Agent #5 is ready!

# 2. Start trading
shll-onchain-runner swap --from BNB --to USDC --amount 0.1 --token-id 5
```

## 📋 Full Command Reference

### Onboarding
| Command | Description |
|---------|-------------|
| `init --listing-id <ID> --days <N> [--fund <BNB>]` | Rent agent + authorize + fund vault |

### Trading & Asset Management
| Command | Description |
|---------|-------------|
| `swap --from <TOKEN> --to <TOKEN> --amount <N> -k <ID>` | Token swap via PancakeSwap V2 |
| `wrap --amount <BNB> -k <ID>` | BNB → WBNB |
| `unwrap --amount <BNB> -k <ID>` | WBNB → BNB |
| `transfer --token <SYM> --amount <N> --to <ADDR> -k <ID>` | Transfer from vault |
| `raw --target <ADDR> --data <HEX> -k <ID>` | Raw calldata execution |

### Market Data (read-only, no key needed)
| Command | Description |
|---------|-------------|
| `portfolio -k <ID>` | Vault holdings + USD values |
| `price --token <SYM>` | Real-time price from DexScreener |
| `search --query <TEXT>` | Find token by name on BSC |
| `tokens` | List known token addresses |

### Risk Management
| Command | Description |
|---------|-------------|
| `policies -k <ID>` | View active policies & current settings |
| `config -k <ID> --tx-limit <BNB> --daily-limit <BNB> --cooldown <SEC>` | Tighten risk parameters |

## 🔧 What Happens Internally

1. **Resolves tokens** — `BNB` → `0x0000...`, `USDC` → `0x8AC7...`
2. **Builds path** — Auto-bridges through WBNB if needed
3. **Gets quote** — On-chain `getAmountsOut()` for real-time pricing
4. **Auto-approve** — Checks allowance, adds approve to batch if needed
5. **Validates** — `PolicyClient.validate()` simulates against all policies
6. **Executes** — Sends through `AgentNFA.execute()` → PolicyGuard → vault

## 🛡️ Security

- **PolicyGuard enforced** — Every transaction goes through on-chain policy validation (spending limits, cooldown, DEX whitelist, receiver guard)
- **Vault isolation** — The operator key cannot directly access vault funds; all operations route through AgentNFA
- **Renter-only config** — Risk parameters can only be tightened, never loosened beyond template ceiling
- **⚠️ Use a dedicated wallet** for `RUNNER_PRIVATE_KEY` — this key pays gas for `init` and `config` transactions

## 📄 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RUNNER_PRIVATE_KEY` | ✅ | Operator/renter private key |
| `RPC_URL` | ❌ | BSC RPC (default: public endpoint) |
| `NFA_ADDRESS` | ❌ | AgentNFA contract override |
| `GUARD_ADDRESS` | ❌ | PolicyGuard contract override |
