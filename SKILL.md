---
name: shll-run
description: Execute DeFi transactions on BSC via a SHLL AgentNFA. 12 commands for trading, market data, and risk management. All write operations validated by on-chain PolicyGuard.
version: 3.1.0
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

A tool that lets any AI agent (OpenClaw, Claude, Codex, ChatGPT, etc.) trade on BSC Mainnet safely. Every transaction goes through an on-chain PolicyGuard — even if you construct a bad command, the smart contract will reject it.

## ⚠️ Key Concepts — Read Before Using

### RUNNER_PRIVATE_KEY — What is it?
A **gas-paying wallet key**. It is NOT the trading wallet. It only pays:
- **Gas fees**: ~$0.01 per transaction (very cheap on BSC)
- **Rental fee**: small one-time BNB payment when creating an agent

**It does NOT hold or access trading funds.** Trading funds live in a secure on-chain vault protected by PolicyGuard. Even if this key is compromised, the attacker cannot steal vault funds.

**Tell the user:** *"Create a fresh wallet (e.g. in MetaMask), send it ~$1 of BNB, export the private key, and set it as RUNNER_PRIVATE_KEY. That's all you need."*

### token-id — What is it?
The Agent's unique ID on the blockchain (a number like 1, 2, 5, etc.). Users get it by running `shll-run init`. If the user doesn't have one, help them run init first.

### vault — What is it?
A secure smart contract wallet that holds the user's trading funds. The RUNNER_PRIVATE_KEY cannot directly withdraw from it. All operations go through on-chain PolicyGuard safety checks (spending limits, cooldown, whitelisted DEXs, etc.).

### listing-id — Where to find it?
The listing-id is the template's unique identifier. Users can find it on the SHLL marketplace at https://shll.run or from the SHLL team.

---

## 🚀 First-Time User Setup (Step by Step)

### Step 1: Install
```bash
npm install -g shll-skills
```

### Step 2: Create a Gas Wallet
The user needs a wallet to pay gas fees (~$0.01 per transaction). Guide them:
1. Create a new wallet in MetaMask (or any wallet)
2. Send ~$1 of BNB to it (for gas + rental)
3. Export the private key

### Step 3: Set the Key
```bash
# Linux/Mac
export RUNNER_PRIVATE_KEY="0x..."

# Windows PowerShell
$env:RUNNER_PRIVATE_KEY="0x..."
```

### Step 4: Create an Agent
```bash
shll-run init --listing-id <LISTING_ID_FROM_SHLL_MARKETPLACE> --days 30 --fund 0.1
```
This will:
1. Rent an Agent from the SHLL marketplace (costs a small BNB rental fee)
2. Authorize the gas wallet as the operator
3. Fund the vault with 0.1 BNB for trading

**Output:** `{ "status": "success", "tokenId": "5", "vault": "0x..." }`
→ The user's token-id is `5`. Save this number for all future commands.

### Step 5: Start Trading
```bash
shll-run swap --from BNB --to USDC --amount 0.05 -k 5
shll-run portfolio -k 5    # Check what's in the vault
```

---

## � All Commands

### Trading & Asset Management
```bash
shll-run swap --from <TOKEN> --to <TOKEN> --amount <N> -k <ID> [--slippage <PERCENT>]
shll-run wrap --amount <BNB> -k <ID>          # BNB → WBNB
shll-run unwrap --amount <BNB> -k <ID>        # WBNB → BNB
shll-run transfer --token <SYM> --amount <N> --to <ADDR> -k <ID>
shll-run raw --target <ADDR> --data <HEX> -k <ID>
```

**Supported tokens:** BNB, USDC, USDT, WBNB, CAKE, ETH, BTCB, DAI, BUSD — or any 0x address.

### Market Data (read-only, no private key needed)
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

## 🔄 Updating
```bash
npm update -g shll-skills
```
The skill does NOT auto-update. Run the above command to get the latest version.

## 🔐 Security
The on-chain PolicyGuard automatically rejects any transaction that violates the agent's safety policies. You do NOT need to verify safety — just construct the command and the smart contract handles the rest.

## 📤 Output Format
All output is JSON on stdout:
- Success: `{ "status": "success", "tx": "0x..." }`
- Rejected: `{ "status": "rejected", "reason": "Exceeds per-tx limit" }`
- Error: `{ "status": "error", "message": "..." }`

## 🔗 Links
- 🌐 Website: https://shll.run
- 🐦 Twitter: @shllrun
- 📦 npm: https://www.npmjs.com/package/shll-skills
- 💻 GitHub: https://github.com/kledx/shll-skills
