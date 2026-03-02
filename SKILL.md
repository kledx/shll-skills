---
name: shll-run
description: Execute DeFi transactions on BSC via SHLL AgentNFA. The AI handles all commands and users only need to chat.
version: 5.5.1
author: SHLL Team
website: https://shll.run
twitter: https://twitter.com/shllrun
repository: https://github.com/kledx/shll-skills.git
install: npm install -g shll-skills --registry https://registry.npmjs.org
update: npm update -g shll-skills --registry https://registry.npmjs.org
---

# SHLL Skill Usage Guide

This file defines how an AI agent should use `shll-run` and `shll-mcp` safely.

## Scope

- Network: BSC mainnet
- Runtime:
- CLI: `shll-run` (alias: `shll-onchain-runner`)
- MCP: `shll-mcp`
- Security layer: SHLL PolicyGuard

The user should not be asked to run CLI commands directly. The AI runs commands and explains results.

## Mandatory Safety Rules

1. Token ID must come from the user. Never guess, scan, or enumerate IDs.
2. Use one token ID per conversation unless the user explicitly switches.
3. Confirm before each write operation.
4. Never ask for or handle the owner wallet private key.
5. Do not repeat private keys after initial `generate-wallet` output.
6. If multiple DeFi skills are available, use SHLL for vault operations when token ID context exists.
7. Treat raw calldata as high risk. Use strict recipient checks.
8. Do not bypass security controls for convenience.

## Security Model

SHLL uses dual wallets:

- Owner wallet (user): controls high-risk operations such as ownership and vault-level admin actions.
- Operator wallet (`RUNNER_PRIVATE_KEY`): used by AI to execute allowed trades only.

On-chain guardrails:

- PolicyGuard validates each action (`validate`) before execution (`execute` / `executeBatch`).
- Spending limits, cooldowns, whitelist rules, and protocol rules are enforced on-chain.
- Raw calldata path is guarded by recipient safety checks before on-chain execution.

## Current Critical Constraints (v5.5.1)

1. `init` command is disabled. Do not use it.
2. CLI `raw` requires `--i-understand-the-risk`.
3. MCP `execute_calldata` and `execute_calldata_batch` do not support `allow_undecoded`.
4. If calldata recipient cannot be decoded, execution is blocked.
5. Core contract addresses are pinned in code, not user-overridable at runtime.

## Prerequisites

1. Install:
```bash
npm install -g shll-skills --registry https://registry.npmjs.org
```

2. Set operator private key:
```bash
export RUNNER_PRIVATE_KEY="0x..."
```

3. Optional custom RPC:
```bash
export SHLL_RPC="https://bsc-dataseed1.binance.org"
```

4. Ensure operator wallet has small BNB balance for gas.

## Onboarding Flow (AI-driven)

1. Check or create operator wallet:
- Use `shll-run generate-wallet` only if user has no operator wallet.
- Immediately instruct user to store the key securely.

2. Verify gas:
- Run `shll-run balance`.

3. If user has no token ID:
- Run `shll-run listings`.
- Ask user to choose template and rental days.
- Run `shll-run setup-guide --listing-id <id> --days <days>`.
- Send `setupUrl` to user for browser completion.

4. User returns with token ID:
- Run `shll-run portfolio -k <tokenId>`.
- Confirm readiness and proceed with requested operation.

## Write Confirmation Policy

Before any write command, present:

- token ID
- action type
- token/amount/target
- risk note

Then wait for explicit user approval.

Write commands include:

- `swap`
- `wrap`
- `unwrap`
- `transfer`
- `raw`
- `lend`
- `redeem`
- `config`
- `four-buy`
- `four-sell`

Read-only commands do not require confirmation.

## CLI Commands

### Setup and account

- `shll-run generate-wallet`
- `shll-run balance`
- `shll-run doctor`
- `shll-run listings`
- `shll-run setup-guide [-l <listingId>] [-d <days>]`
- `shll-run init` (disabled)

If `-l/--listing-id` is omitted, `setup-guide` auto-selects an active listing from indexer.

### Trading and vault ops

- `shll-run swap -f <from> -t <to> -a <amount> -k <tokenId>`
- `shll-run wrap -a <bnb> -k <tokenId>`
- `shll-run unwrap -a <bnb> -k <tokenId>`
- `shll-run transfer --token <symbolOrAddress> -a <amount> --to <address> -k <tokenId>`
- `shll-run raw --target <address> --data <hex> -k <tokenId> --i-understand-the-risk`

### Lending (Venus)

- `shll-run lend -t <token> -a <amount> -k <tokenId>`
- `shll-run redeem -t <token> -a <amount> -k <tokenId>`
- `shll-run lending-info -k <tokenId>`

### Four.meme

- `shll-run four-info --token <address>`
- `shll-run four-buy --token <address> -a <bnb> -k <tokenId>`
- `shll-run four-sell --token <address> -a <tokenAmount> -k <tokenId>`

### Read-only and audit

- `shll-run portfolio -k <tokenId>`
- `shll-run price --token <symbolOrAddress>`
- `shll-run search --query <text>`
- `shll-run tokens`
- `shll-run policies -k <tokenId>`
- `shll-run status -k <tokenId>`
- `shll-run history -k <tokenId> [--limit N]`
- `shll-run my-agents`

## MCP Tools: Cross-skill Execution

For external aggregator calldata (OKX, 1inch, etc.):

1. Get quote/calldata from external source.
2. Execute through SHLL MCP:
- `execute_calldata`
- `execute_calldata_batch`
3. Let PolicyGuard enforce on-chain policy checks.

For onboarding via MCP, `setup_guide` can auto-select an active listing when `listing_id` is omitted.

Security requirements:

1. Recipient must resolve to the vault address.
2. Undecodable recipient calldata is blocked.
3. Do not ask for "unsafe bypass" parameters.

## Smart Routing Rule

When user provides a token address:

1. Run `four-info --token <addr>`.
2. If `tradingPhase` is bonding curve, use `four-buy` / `four-sell`.
3. If `tradingPhase` is DEX (or unsupported), use `swap`.

## Common Errors and Fixes

1. `RUNNER_PRIVATE_KEY environment variable is missing`
- Set `RUNNER_PRIVATE_KEY` and retry.
- Or run `shll-run doctor` to get guided next steps.

2. `NOT authorized for token-id`
- Operator wallet is not authorized; use setup guide or set operator in console.

3. `rental has EXPIRED` or `operator authorization has EXPIRED`
- Renew subscription/authorization first.

4. `status: rejected`
- PolicyGuard rejected action; inspect `reason` and adjust limits/whitelists/cooldown.

5. `Unable to decode recipient from calldata`
- Use built-in command flow or provide calldata with decodable vault recipient.

6. `init command is disabled`
- Use `setup-guide` flow instead.

7. Unsure what is broken
- Run `shll-run doctor` for one-shot environment, wallet, RPC, and optional token-id checks.

## Redeploy Checklist (When Contracts Change)

If AgentNFA / PolicyGuard / ListingManagerV2 / default listing changes:

1. Update constants in:
- `src/index.ts`
- `src/mcp.ts`

2. Validate ABIs if function signatures changed.

3. Rebuild:
```bash
npx tsc --noEmit
npm run build
```

4. Smoke test:
- `shll-run init` returns disabled error
- `shll-run raw` blocks without risk flag
- basic read commands still work

## Expected Output Format

All runtime responses should stay machine-friendly JSON:

- Success: `{"status":"success", ...}`
- Rejected: `{"status":"rejected","reason":"..."}`
- Error: `{"status":"error","message":"..."}`

## Links

- Website: https://shll.run
- npm: https://www.npmjs.com/package/shll-skills
- Repo: https://github.com/kledx/shll-skills
