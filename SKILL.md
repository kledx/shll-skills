---
name: shll-onchain-runner
description: Execute DeFi transactions on BSC via a SHLL AgentNFA. 12 commands covering onboarding (init), trading (swap, wrap, unwrap, transfer), market data (portfolio, price, search, tokens), risk management (policies, config), and raw execution. All write operations validated by on-chain PolicyGuard.
version: 3.0.0
author: SHLL Team
repository: https://github.com/kledx/shll-skills.git
install: npm install -g shll-skills --registry https://registry.npmjs.org
requires:
  - RUNNER_PRIVATE_KEY: Operator private key (required for write commands)
---

# SHLL On-Chain Runner

A skill that allows OpenClaw to safely interact with DeFi protocols on BSC Mainnet using a SHLL Agent NFA.

## 🎯 Purpose
Use this skill when the user asks you to:
- "Swap 0.5 BNB for USDC"
- "Buy some CAKE using my SHLL agent"
- "Swap 50 USDT for WBNB"

## 🛠 Commands

### Token Swap (recommended)
```bash
shll-onchain-runner swap --from <TOKEN> --to <TOKEN> --amount <AMOUNT> --token-id <NFA_ID>
```

**Parameters:**
- `--from` / `-f`: Input token. Use a symbol (BNB, USDC, USDT, WBNB, CAKE, ETH, BTCB, DAI, BUSD) or a 0x address.
- `--to` / `-t`: Output token (same format).
- `--amount` / `-a`: Amount in human-readable format (e.g. `0.5`, `100`).
- `--token-id` / `-k`: The user's Agent NFA Token ID.
- `--slippage` / `-s`: Optional slippage % (default: 5).

**Example:**
```bash
shll-onchain-runner swap --from BNB --to USDC --amount 0.1 --token-id 1
shll-onchain-runner swap --from USDT --to CAKE --amount 50 --token-id 1
```

The script handles everything internally:
1. Resolves token symbols to BSC addresses.
2. Builds the optimal routing path (auto-bridges through WBNB).
3. Queries PancakeSwap for a real-time price quote.
4. Checks ERC20 allowance and auto-approves if needed (via atomic batch).
5. Validates against PolicyGuard.
6. Executes on-chain.

### List Known Tokens
```bash
shll-onchain-runner tokens
```

### Wrap BNB → WBNB
```bash
shll-onchain-runner wrap --token-id <NFA_ID> --amount 0.5
```

### Unwrap WBNB → BNB
```bash
shll-onchain-runner unwrap --token-id <NFA_ID> --amount 0.5
```

### Transfer Tokens from Vault
```bash
shll-onchain-runner transfer --token-id <NFA_ID> --token USDC --amount 10 --to 0xRecipient
```
Note: ReceiverGuardPolicy may restrict which addresses can receive transfers.

### Raw Transaction (advanced)
```bash
shll-onchain-runner raw --target <ADDRESS> --data <CALLDATA> --token-id <NFA_ID>
```

### One-Click Setup (first-time users)
```bash
shll-onchain-runner init --listing-id <LISTING_BYTES32> --days 30 --fund 0.5
```
This will:
1. Rent an Agent from the template listing (pays rent in BNB)
2. Authorize your key as the operator
3. Fund the vault with BNB

After init completes, it outputs the Token ID you need for `swap` commands.

### Query Portfolio
```bash
shll-onchain-runner portfolio --token-id <NFA_ID>
```
Returns vault BNB balance + all ERC20 holdings with USD values.

### Check Token Price
```bash
shll-onchain-runner price --token CAKE
shll-onchain-runner price --token 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82
```
Returns real-time price, 24h volume, liquidity, and price change from DexScreener.

### Search for a Token
```bash
shll-onchain-runner search --query "pancake"
```
Finds BSC tokens by name or symbol. Returns addresses and market data.

### View Active Policies
```bash
shll-onchain-runner policies --token-id <NFA_ID>
```
Returns all active policies, whether they're configurable, and current settings (limits, cooldown).

### Configure Risk Parameters
```bash
shll-onchain-runner config --token-id <NFA_ID> --tx-limit 0.5 --daily-limit 2 --cooldown 120
```
Adjusts SpendingLimitPolicy and CooldownPolicy. You can only tighten limits (not exceed template ceiling).

## 🔐 Security
The SHLL PolicyGuard smart contract will automatically reject any transaction that violates the agent's policies (spending limits, cooldown, blacklisted targets, etc.). You do NOT need to verify safety — just construct the intent and the on-chain guard handles the rest.

## 📤 Output Format
All output is JSON on stdout:
- Success: `{ "status": "success", "hash": "0x..." }`
- Rejected by policy: `{ "status": "rejected", "reason": "Exceeds per-tx limit" }`
- Error: `{ "status": "error", "message": "..." }`
- Quote info: `{ "status": "info", "message": "Quote: ..." }`
