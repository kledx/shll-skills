# SHLL Skills — AI Agent DeFi Toolkit on BSC

[![Website](https://img.shields.io/badge/Website-shll.run-blue)](https://shll.run) [![Twitter](https://img.shields.io/badge/Twitter-@shllrun-1DA1F2)](https://twitter.com/shllrun) [![npm](https://img.shields.io/npm/v/shll-skills)](https://www.npmjs.com/package/shll-skills)

A **CLI + MCP Server** toolkit that gives any AI agent the ability to execute DeFi operations on BSC Mainnet securely. Supports PancakeSwap V2/V3 swap routing, Venus Protocol lending, and more. All transactions are validated by the on-chain PolicyGuard — even if the AI hallucinates, the contract rejects unsafe operations.

## Install

```bash
npm install -g shll-skills
```

This installs two binaries:
- `shll-run` — CLI mode (for OpenClaw, shell scripts, etc.)
- `shll-mcp` — MCP Server mode (for Claude, Cursor, Gemini, etc.)

---

## 🔌 MCP Server Setup (Recommended for AI Agents)

The [Model Context Protocol](https://modelcontextprotocol.io/) lets AI agents discover and call SHLL tools natively — no CLI parsing needed.

### Claude Desktop

Edit `~/AppData/Roaming/Claude/claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "shll-defi": {
      "command": "shll-mcp",
      "env": {
        "RUNNER_PRIVATE_KEY": "0x_YOUR_OPERATOR_PRIVATE_KEY"
      }
    }
  }
}
```

Restart Claude Desktop. You'll see SHLL tools appear in the 🔧 menu.

### Cursor

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "shll-defi": {
      "command": "npx",
      "args": ["-y", "shll-skills", "--mcp"],
      "env": {
        "RUNNER_PRIVATE_KEY": "0x_YOUR_OPERATOR_PRIVATE_KEY"
      }
    }
  }
}
```

### Custom Agent (programmatic)

```bash
RUNNER_PRIVATE_KEY=0x... shll-mcp
```

The server communicates via **stdio** using JSON-RPC 2.0. Send `tools/list` to discover all available tools.

### Available MCP Tools (22 total)

| Tool | Type | Description |
|------|------|-------------|
| `portfolio` | Read | Vault holdings + token balances |
| `balance` | Read | Operator wallet gas balance |
| `price` | Read | Real-time token price (DexScreener) |
| `search` | Read | Search token by name/symbol on BSC |
| `tokens` | Read | List known token symbols + addresses |
| `lending_info` | Read | Venus Protocol supply balances + APY |
| `policies` | Read | View active on-chain policies + config |
| `status` | Read | One-shot security overview (vault, operator, policies, activity) |
| `history` | Read | Recent transactions + policy rejections |
| `my_agents` | Read | List agents where current operator is authorized |
| `listings` | Read | Available agent templates for rent |
| `swap` | Write | PancakeSwap V2/V3 auto-routing swap |
| `wrap` | Write | BNB → WBNB in vault |
| `unwrap` | Write | WBNB → BNB in vault |
| `lend` | Write | Supply tokens to Venus for yield |
| `redeem` | Write | Withdraw from Venus |
| `transfer` | Write | Send BNB or ERC20 from vault |
| `config` | Write | Configure risk parameters (spending limits, cooldown) |
| `setup_guide` | Info | Generate dual-wallet onboarding URL + steps |
| `generate_wallet` | Info | Create new operator wallet (address + key) |
| `execute_calldata` | Write | Execute raw calldata from any source through PolicyGuard |
| `execute_calldata_batch` | Write | Execute multiple calldata actions atomically through PolicyGuard |

---

## 📟 CLI Mode

For OpenClaw, shell scripts, or manual use.

### Quick Start

```bash
# 1. Generate an operator wallet (hot wallet for AI)
shll-run generate-wallet
export RUNNER_PRIVATE_KEY="0x..."

# 2. Get setup link (user completes on shll.run with their OWN wallet)
shll-run setup-guide --listing-id 0xABC...DEF --days 30

# 3. Trade
shll-run swap --from BNB --to USDC --amount 0.1 -k 5
```

### Commands

#### Trading
```bash
shll-run swap -f <FROM> -t <TO> -a <AMT> -k <ID>            # Auto V2/V3 routing
shll-run swap -f BNB -t USDT -a 0.1 -k 5 --dex v3 --fee 500 # Force V3, 0.05% fee
shll-run wrap -a <BNB> -k <ID>                                # BNB -> WBNB
shll-run unwrap -a <BNB> -k <ID>                              # WBNB -> BNB
shll-run transfer --token <SYM> -a <AMT> --to <ADDR> -k <ID>
```

#### Lending (Venus Protocol)
```bash
shll-run lend -t USDT -a 100 -k <ID>      # Supply to Venus
shll-run redeem -t USDT -a 50 -k <ID>     # Withdraw from Venus
shll-run lending-info -k <ID>              # Show APY + positions
```

#### Market Data (read-only)
```bash
shll-run portfolio -k <ID>        # Vault holdings + USD values
shll-run price --token <SYM>      # Real-time price (DexScreener)
shll-run search --query <TEXT>     # Find token by name
shll-run tokens                   # List known tokens
```

#### Risk Management
```bash
shll-run policies -k <ID>         # View active on-chain policies
shll-run config -k <ID> --tx-limit <BNB> --daily-limit <BNB> --cooldown <SEC>
```

---

## How It Works

```
AI Agent -> CLI/MCP -> PolicyClient.validate() -> PolicyGuard (on-chain) -> vault
```

1. AI constructs a tool call (MCP) or CLI command
2. `PolicyClient.validate()` simulates against all on-chain policies
3. If approved, `AgentNFA.execute()` routes through PolicyGuard → vault
4. PolicyGuard enforces: spending limits, cooldowns, DEX whitelist, DeFi guard

## Security: Dual-Wallet Architecture

| | Owner Wallet | Operator Wallet (RUNNER_PRIVATE_KEY) |
|---|---|---|
| **Who holds it** | User (MetaMask/hardware) | AI agent |
| **Can trade** | — | ✅ Within PolicyGuard limits |
| **Can withdraw vault** | ✅ | ❌ |
| **Can transfer NFT** | ✅ | ❌ |
| **Risk if leaked** | 🚨 Full vault access | ⚠️ Limited to policy-allowed trades |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RUNNER_PRIVATE_KEY` | Yes | Operator wallet key (~$1 BNB for gas) |
| `SHLL_RPC` | No | BSC RPC URL override |
| `SHLL_NFA` | No | AgentNFA contract override |
| `SHLL_GUARD` | No | PolicyGuard contract override |

## Links

- Website: [shll.run](https://shll.run)
- Twitter: [@shllrun](https://twitter.com/shllrun)
- npm: [shll-skills](https://www.npmjs.com/package/shll-skills)
- GitHub: [kledx/shll-skills](https://github.com/kledx/shll-skills)

## 🧩 Multi-Skill Compatibility

SHLL can coexist with other DeFi skills (OKX DEX API, Bitget Wallet, etc.). Key architectural differences:

| | **SHLL** | **OKX DEX API** | **Bitget Wallet** |
|---|---|---|---|
| **Wallet** | Smart contract vault (AgentNFA) | User EOA | Bitget custody |
| **Execution** | On-chain via PolicyGuard | Calldata only (user signs) | HMAC API |
| **Safety** | On-chain policy enforcement | User approval | API key perms |
| **AI autonomy** | Execute within policy limits | Cannot execute | Full API access |
| **Risk if key leaked** | Policy-limited trades only | N/A | Full API access |

**SHLL is the only skill with on-chain policy enforcement.** Even if the AI hallucinates, the smart contract rejects unsafe operations.

## License

MIT

