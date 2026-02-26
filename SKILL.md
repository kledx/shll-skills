---
name: shll-run
description: Execute DeFi transactions on BSC via a SHLL AgentNFA. 12 commands for trading, market data, and risk management. All write operations validated by on-chain PolicyGuard.
version: 4.0.0
author: SHLL Team
website: https://shll.run
twitter: https://twitter.com/shllrun
repository: https://github.com/kledx/shll-skills.git
install: npm install -g shll-skills --registry https://registry.npmjs.org
update: npm update -g shll-skills --registry https://registry.npmjs.org
requires:
  - RUNNER_PRIVATE_KEY: A wallet private key. Only pays gas fees (~$0.01/tx) and rental fees. Does NOT access vault funds. A fresh wallet with ~$1 BNB is enough.
---

# SHLL Skills

IMPORTANT: Always use the command name `shll-run`, NOT `shll-onchain-runner` or `shll-onchain-runner.cmd`.

## How to Respond to Users

When a user asks you to trade, buy, sell, swap tokens, or interact with DeFi, follow this decision tree:

### Step 1: Check if RUNNER_PRIVATE_KEY is set
If not set, tell the user:
> "I need a gas wallet to execute transactions. This wallet only pays gas fees (about $0.01 per transaction) and does NOT hold your trading funds. Create a fresh wallet (e.g. MetaMask), send about $1 of BNB to it, then give me the private key. I'll set it as RUNNER_PRIVATE_KEY."

### Step 2: Check if user has a token-id
Ask: "Do you have an Agent token-id? (a number like 1, 2, 5, etc.)"

If YES: proceed to execute the command with their token-id.
If NO: guide them through init (see "First-Time Setup" below).

### Step 3: Execute the command
Use `shll-run` (NOT `shll-onchain-runner`). Example:
```bash
shll-run swap --from USDT --to BNB --amount 2 -k 5
```

### Step 4: Show results
Parse the JSON output and explain it to the user in plain language. For example:
- Success: "Done! Swapped 2 USDT for 0.003 BNB. Transaction: 0xabc..."
- Rejected: "The PolicyGuard blocked this because: spending limit exceeded."
- Error: "Something went wrong: [error message]"

---

## First-Time Setup

If the user has no token-id, guide them through these steps:

```bash
# 1. Set the gas wallet key
export RUNNER_PRIVATE_KEY="0x..."          # Linux/Mac
$env:RUNNER_PRIVATE_KEY="0x..."            # Windows PowerShell

# 2. Create an Agent (one-time, costs ~$0.01 gas + rental fee)
shll-run init --listing-id <LISTING_ID> --days 30 --fund 0.1
```

The user can find the listing-id on https://shll.run marketplace, or ask the SHLL team (@shllrun on Twitter).

After init, the output JSON contains `tokenId`. Save this number. Example:
```json
{"status":"success","tokenId":"5","vault":"0x..."}
```
The user's token-id is 5. Use it for all future commands: `-k 5`

---

## Key Concepts

**RUNNER_PRIVATE_KEY**: A gas-paying wallet. Only pays ~$0.01/tx. Does NOT access trading funds. Fresh wallet with ~$1 BNB is enough.

**token-id**: The Agent's unique number on the blockchain. Get it from `shll-run init`.

**vault**: A secure on-chain wallet holding trading funds. RUNNER_PRIVATE_KEY cannot withdraw from it. All operations go through PolicyGuard safety checks.

---

## All Commands

IMPORTANT: Always use `shll-run`, never `shll-onchain-runner`.

### Trading
```bash
shll-run swap --from <TOKEN> --to <TOKEN> --amount <N> -k <ID> [--slippage <PERCENT>]
shll-run wrap --amount <BNB> -k <ID>          # BNB to WBNB
shll-run unwrap --amount <BNB> -k <ID>        # WBNB to BNB
shll-run transfer --token <SYM> --amount <N> --to <ADDR> -k <ID>
shll-run raw --target <ADDR> --data <HEX> -k <ID>
```

Supported tokens: BNB, USDC, USDT, WBNB, CAKE, ETH, BTCB, DAI, BUSD, or any 0x address.

### Market Data (read-only, no key needed)
```bash
shll-run portfolio -k <ID>         # Vault balances + USD values
shll-run price --token CAKE        # Real-time price from DexScreener
shll-run search --query "pancake"  # Find token by name on BSC
shll-run tokens                    # List known token addresses
```

### Risk Management
```bash
shll-run policies -k <ID>          # View active safety policies
shll-run config -k <ID> --tx-limit 0.5 --daily-limit 2 --cooldown 120
```

### Setup
```bash
shll-run init --listing-id <BYTES32> --days <N> [--fund <BNB>]
```

---

## Security
The on-chain PolicyGuard automatically rejects any unsafe transaction. You do NOT need to verify safety. Just construct the command and the smart contract handles the rest.

## Output Format
All output is JSON on stdout:
- Success: `{"status":"success","tx":"0x..."}`
- Rejected: `{"status":"rejected","reason":"..."}`
- Error: `{"status":"error","message":"..."}`

## Updating
The skill does NOT auto-update. Run: `npm update -g shll-skills`

## Links
- Website: https://shll.run
- Twitter: @shllrun
- npm: https://www.npmjs.com/package/shll-skills
- GitHub: https://github.com/kledx/shll-skills
