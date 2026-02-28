#!/usr/bin/env node
/**
 * SHLL MCP Server — Model Context Protocol interface for DeFi operations
 *
 * Exposes SHLL DeFi tools (swap, lend, redeem, portfolio, etc.) as MCP tools.
 * AI agents connect via stdio transport and call tools natively.
 *
 * Usage:
 *   RUNNER_PRIVATE_KEY=0x... npx shll-skills --mcp
 *   or: RUNNER_PRIVATE_KEY=0x... shll-mcp
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PolicyClient } from "shll-policy-sdk";
import type { Action } from "shll-policy-sdk";
import {
    createPublicClient,
    createWalletClient,
    encodeFunctionData,
    http,
    parseEther,
    formatEther,
    type Address,
    type Hex,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { bsc } from "viem/chains";

// ═══════════════════════════════════════════════════════
//                   BSC Constants
// ═══════════════════════════════════════════════════════

const DEFAULT_NFA = "0xE98DCdbf370D7b52c9A2b88F79bEF514A5375a2b";
const DEFAULT_GUARD = "0x25d17eA0e3Bcb8CA08a2BFE917E817AFc05dbBB3";
const DEFAULT_RPC = "https://bsc-dataseed1.binance.org";
const DEFAULT_LISTING_MANAGER = "0x1f9CE85bD0FF75acc3D92eB79f1Eb472f0865071";
const DEFAULT_LISTING_ID = "0x733e9d959da5c1745fa507df6b47537f0945012eff3ceb4b684cd4482f2bc4d3";
const PANCAKE_V2_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const PANCAKE_V3_SMART_ROUTER = "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const V3_QUOTER = "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997" as Address;

// Venus Protocol
const VENUS_VTOKENS: Record<string, Address> = {
    BNB: "0xA07c5b74C9B40447a954e1466938b865b6BBea36" as Address,
    USDT: "0xfD5840Cd36d94D7229439859C0112a4185BC0255" as Address,
    USDC: "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8" as Address,
    BUSD: "0x95c78222B3D6e262426483D42CfA53685A67Ab9D" as Address,
};

// ═══════════════════════════════════════════════════════
//                   Token Registry
// ═══════════════════════════════════════════════════════

interface TokenInfo { symbol: string; address: Address; decimals: number; }
const TOKEN_LIST: Record<string, TokenInfo> = {
    BNB: { symbol: "BNB", address: "0x0000000000000000000000000000000000000000" as Address, decimals: 18 },
    WBNB: { symbol: "WBNB", address: WBNB as Address, decimals: 18 },
    USDT: { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955" as Address, decimals: 18 },
    USDC: { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" as Address, decimals: 18 },
    BUSD: { symbol: "BUSD", address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" as Address, decimals: 18 },
    CAKE: { symbol: "CAKE", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82" as Address, decimals: 18 },
    ETH: { symbol: "ETH", address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8" as Address, decimals: 18 },
    BTCB: { symbol: "BTCB", address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c" as Address, decimals: 18 },
    DAI: { symbol: "DAI", address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3" as Address, decimals: 18 },
};

function resolveToken(input: string): TokenInfo {
    const upper = input.toUpperCase();
    if (TOKEN_LIST[upper]) return TOKEN_LIST[upper];
    if (input.startsWith("0x") && input.length === 42) {
        return { symbol: input.slice(0, 8), address: input as Address, decimals: 18 };
    }
    throw new Error(`Unknown token: ${input}. Known: ${Object.keys(TOKEN_LIST).join(", ")}`);
}

function parseAmount(amount: string, decimals: number): bigint {
    const parts = amount.split(".");
    const whole = BigInt(parts[0] || "0");
    let frac = parts[1] || "";
    frac = frac.padEnd(decimals, "0").slice(0, decimals);
    return whole * 10n ** BigInt(decimals) + BigInt(frac);
}

// ═══════════════════════════════════════════════════════
//                   ABI Fragments
// ═══════════════════════════════════════════════════════

const ERC20_ABI = [
    { type: "function" as const, name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" as const },
    { type: "function" as const, name: "allowance", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" as const },
    { type: "function" as const, name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" as const },
    { type: "function" as const, name: "decimals", inputs: [], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" as const },
    { type: "function" as const, name: "symbol", inputs: [], outputs: [{ name: "", type: "string" }], stateMutability: "view" as const },
] as const;

const GET_AMOUNTS_OUT_ABI = [{
    type: "function" as const, name: "getAmountsOut",
    inputs: [{ name: "amountIn", type: "uint256" }, { name: "path", type: "address[]" }],
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "view" as const,
}] as const;

const SWAP_EXACT_ETH_ABI = [{ type: "function" as const, name: "swapExactETHForTokens", inputs: [{ name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [{ name: "", type: "uint256[]" }], stateMutability: "payable" as const }] as const;
const SWAP_EXACT_TOKENS_ABI = [{ type: "function" as const, name: "swapExactTokensForTokens", inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [{ name: "", type: "uint256[]" }], stateMutability: "nonpayable" as const }] as const;

const V3_EXACT_INPUT_SINGLE_ABI = [{
    type: "function" as const, name: "exactInputSingle",
    inputs: [{
        name: "params", type: "tuple", components: [
            { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
            { name: "fee", type: "uint24" }, { name: "recipient", type: "address" },
            { name: "amountIn", type: "uint256" }, { name: "amountOutMinimum", type: "uint256" },
            { name: "sqrtPriceLimitX96", type: "uint160" },
        ]
    }],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable" as const,
}] as const;

const V3_QUOTE_ABI = [{
    type: "function" as const, name: "quoteExactInputSingle",
    inputs: [{
        name: "params", type: "tuple", components: [
            { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
            { name: "amountIn", type: "uint256" }, { name: "fee", type: "uint24" },
            { name: "sqrtPriceLimitX96", type: "uint160" },
        ]
    }],
    outputs: [{ name: "amountOut", type: "uint256" }, { name: "sqrtPriceX96After", type: "uint160" }, { name: "initializedTicksCrossed", type: "uint32" }, { name: "gasEstimate", type: "uint256" }],
    stateMutability: "nonpayable" as const,
}] as const;

const VTOKEN_ABI = [
    { type: "function" as const, name: "mint", inputs: [{ name: "mintAmount", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "nonpayable" as const },
    { type: "function" as const, name: "redeemUnderlying", inputs: [{ name: "redeemAmount", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "nonpayable" as const },
] as const;

const VTOKEN_READ_ABI = [
    { type: "function" as const, name: "balanceOfUnderlying", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" as const },
    { type: "function" as const, name: "supplyRatePerBlock", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" as const },
] as const;

const VBNB_MINT_ABI = [{ type: "function" as const, name: "mint", inputs: [], outputs: [], stateMutability: "payable" as const }] as const;

const WBNB_ABI = [
    { type: "function" as const, name: "deposit", inputs: [], outputs: [], stateMutability: "payable" as const },
    { type: "function" as const, name: "withdraw", inputs: [{ name: "wad", type: "uint256" }], outputs: [], stateMutability: "nonpayable" as const },
] as const;

const SPENDING_LIMIT_ABI = [
    { type: "function" as const, name: "setLimits", inputs: [{ name: "instanceId", type: "uint256" }, { name: "maxPerTx", type: "uint256" }, { name: "maxPerDay", type: "uint256" }, { name: "maxSlippageBps", type: "uint256" }], outputs: [], stateMutability: "nonpayable" as const },
    { type: "function" as const, name: "instanceLimits", inputs: [{ name: "instanceId", type: "uint256" }], outputs: [{ name: "maxPerTx", type: "uint256" }, { name: "maxPerDay", type: "uint256" }, { name: "maxSlippageBps", type: "uint256" }], stateMutability: "view" as const },
] as const;

const COOLDOWN_ABI = [
    { type: "function" as const, name: "setCooldown", inputs: [{ name: "instanceId", type: "uint256" }, { name: "seconds_", type: "uint256" }], outputs: [], stateMutability: "nonpayable" as const },
    { type: "function" as const, name: "cooldownSeconds", inputs: [{ name: "instanceId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" as const },
] as const;

const LISTING_MANAGER_ABI = [
    { type: "function" as const, name: "listings", inputs: [{ name: "listingId", type: "bytes32" }], outputs: [{ name: "nfa", type: "address" }, { name: "templateId", type: "uint256" }, { name: "owner", type: "address" }, { name: "pricePerDay", type: "uint256" }, { name: "minDays", type: "uint32" }, { name: "active", type: "bool" }], stateMutability: "view" as const },
] as const;

// ═══════════════════════════════════════════════════════
//                  Shared Client Setup
// ═══════════════════════════════════════════════════════

function getConfig() {
    const privateKey = process.env.RUNNER_PRIVATE_KEY;
    if (!privateKey) throw new Error("RUNNER_PRIVATE_KEY environment variable is required");
    const rpc = process.env.SHLL_RPC || DEFAULT_RPC;
    // Security: NFA and Guard addresses are hardcoded — never allow env overrides
    // in MCP mode. This prevents pointing at fake contracts that always approve.
    return { privateKey, rpc, nfa: DEFAULT_NFA, guard: DEFAULT_GUARD };
}

function createClients() {
    const config = getConfig();
    const account = privateKeyToAccount(config.privateKey as Hex);
    const publicClient = createPublicClient({ chain: bsc, transport: http(config.rpc) });
    const policyClient = new PolicyClient({
        agentNfaAddress: config.nfa as Address,
        policyGuardAddress: config.guard as Address,
        operatorPrivateKey: config.privateKey as Hex,
        rpcUrl: config.rpc,
        chainId: 56,
    });
    return { account, publicClient, policyClient, config };
}

// ═══════════════════════════════════════════════════════
//                    MCP Server
// ═══════════════════════════════════════════════════════

const server = new McpServer({
    name: "shll-defi",
    version: "5.0.0",
});

// ── Tool: portfolio ─────────────────────────────────────
server.tool(
    "portfolio",
    "Get vault BNB balance and ERC20 token holdings with USD values",
    { token_id: z.string().describe("Agent NFA Token ID") },
    async ({ token_id }) => {
        const { publicClient, policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const vault = await policyClient.getVault(tokenId);

        // BNB balance
        const bnbBalance = await publicClient.getBalance({ address: vault });
        const bnbHuman = (Number(bnbBalance) / 1e18).toFixed(6);

        // Check common ERC20 balances
        const holdings: Array<{ symbol: string; balance: string; address: string }> = [
            { symbol: "BNB", balance: bnbHuman, address: "native" },
        ];

        for (const [sym, info] of Object.entries(TOKEN_LIST)) {
            if (sym === "BNB") continue;
            try {
                const bal = await publicClient.readContract({
                    address: info.address,
                    abi: ERC20_ABI,
                    functionName: "balanceOf",
                    args: [vault],
                });
                if (bal > 0n) {
                    holdings.push({
                        symbol: sym,
                        balance: (Number(bal) / Math.pow(10, info.decimals)).toFixed(6),
                        address: info.address,
                    });
                }
            } catch { /* skip */ }
        }

        return {
            content: [{ type: "text" as const, text: JSON.stringify({ vault, holdings }) }],
        };
    }
);

// ── Tool: balance ───────────────────────────────────────
server.tool(
    "balance",
    "Check operator wallet BNB balance (gas wallet)",
    {},
    async () => {
        const { account, publicClient } = createClients();
        const bal = await publicClient.getBalance({ address: account.address });
        return {
            content: [{
                type: "text" as const, text: JSON.stringify({
                    address: account.address,
                    bnb: (Number(bal) / 1e18).toFixed(6),
                    gasOk: Number(bal) > 1e15,
                })
            }],
        };
    }
);

// ── Tool: price ─────────────────────────────────────────
server.tool(
    "price",
    "Get real-time token price from DexScreener",
    { token: z.string().describe("Token symbol or 0x address") },
    async ({ token }) => {
        const info = resolveToken(token);
        const addr = info.address === "0x0000000000000000000000000000000000000000" ? WBNB : info.address;
        const resp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`);
        const data = await resp.json();
        const pair = data.pairs?.[0];
        if (!pair) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No pair found" }) }] };
        return {
            content: [{
                type: "text" as const, text: JSON.stringify({
                    token: info.symbol,
                    priceUsd: pair.priceUsd,
                    priceChange24h: pair.priceChange?.h24,
                    volume24h: pair.volume?.h24,
                    liquidity: pair.liquidity?.usd,
                    dex: pair.dexId,
                })
            }],
        };
    }
);

// ── Tool: swap ──────────────────────────────────────────
server.tool(
    "swap",
    "Swap tokens on PancakeSwap (auto-routes V2/V3 for best price)",
    {
        token_id: z.string().describe("Agent NFA Token ID"),
        from: z.string().describe("Input token symbol (e.g. BNB, USDT)"),
        to: z.string().describe("Output token symbol"),
        amount: z.string().describe("Amount to swap (human-readable, e.g. 0.1)"),
        dex: z.enum(["auto", "v2", "v3"]).default("auto").describe("DEX routing mode"),
        slippage: z.number().default(5).describe("Slippage tolerance percent"),
    },
    async ({ token_id, from, to, amount, dex, slippage }) => {
        const { publicClient, policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const vault = await policyClient.getVault(tokenId);

        const fromToken = resolveToken(from);
        const toToken = resolveToken(to);
        const isNativeIn = fromToken.address === "0x0000000000000000000000000000000000000000";
        const amountIn = parseAmount(amount, fromToken.decimals);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

        const tokenInAddr = isNativeIn ? (WBNB as Address) : fromToken.address;
        const tokenOutAddr = toToken.address === "0x0000000000000000000000000000000000000000" ? (WBNB as Address) : toToken.address;

        // V3 quote
        let v3Quote = 0n, v3Available = false;
        if (dex === "auto" || dex === "v3") {
            try {
                const v3Result = await publicClient.simulateContract({
                    address: V3_QUOTER, abi: V3_QUOTE_ABI, functionName: "quoteExactInputSingle",
                    args: [{ tokenIn: tokenInAddr, tokenOut: tokenOutAddr, amountIn, fee: 2500, sqrtPriceLimitX96: 0n }],
                });
                v3Quote = v3Result.result[0];
                v3Available = v3Quote > 0n;
            } catch { /* no V3 pool */ }
        }

        // V2 quote
        let v2Quote = 0n, v2Available = false;
        if (dex === "auto" || dex === "v2") {
            try {
                const path: Address[] = tokenInAddr.toLowerCase() !== WBNB.toLowerCase() && tokenOutAddr.toLowerCase() !== WBNB.toLowerCase()
                    ? [tokenInAddr, WBNB as Address, tokenOutAddr] : [tokenInAddr, tokenOutAddr];
                const amounts = await publicClient.readContract({
                    address: PANCAKE_V2_ROUTER as Address, abi: GET_AMOUNTS_OUT_ABI, functionName: "getAmountsOut", args: [amountIn, path],
                });
                v2Quote = amounts[amounts.length - 1];
                v2Available = v2Quote > 0n;
            } catch { /* no V2 pair */ }
        }

        // Pick best
        if (!v3Available && !v2Available) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No liquidity found" }) }] };
        const useV3 = dex === "v3" ? true : dex === "v2" ? false : (v3Available && (!v2Available || v3Quote >= v2Quote));
        const selectedQuote = useV3 ? v3Quote : v2Quote;
        const minOut = (selectedQuote * BigInt(100 - slippage)) / 100n;

        // Build actions
        const actions: Action[] = [];
        const router = useV3 ? (PANCAKE_V3_SMART_ROUTER as Address) : (PANCAKE_V2_ROUTER as Address);

        if (!isNativeIn) {
            const allowance = await publicClient.readContract({ address: fromToken.address, abi: ERC20_ABI, functionName: "allowance", args: [vault, router] }).catch(() => 0n);
            if (allowance < amountIn) {
                actions.push({ target: fromToken.address, value: 0n, data: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [router, amountIn] }) });
            }
        }

        if (useV3) {
            actions.push({
                target: PANCAKE_V3_SMART_ROUTER as Address,
                value: isNativeIn ? amountIn : 0n,
                data: encodeFunctionData({ abi: V3_EXACT_INPUT_SINGLE_ABI, functionName: "exactInputSingle", args: [{ tokenIn: tokenInAddr, tokenOut: tokenOutAddr, fee: 2500, recipient: vault, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }] }),
            });
        } else {
            const path: Address[] = tokenInAddr.toLowerCase() !== WBNB.toLowerCase() && tokenOutAddr.toLowerCase() !== WBNB.toLowerCase()
                ? [tokenInAddr, WBNB as Address, tokenOutAddr] : [tokenInAddr, tokenOutAddr];
            if (isNativeIn) {
                actions.push({ target: router, value: amountIn, data: encodeFunctionData({ abi: SWAP_EXACT_ETH_ABI, functionName: "swapExactETHForTokens", args: [minOut, path, vault, deadline] }) });
            } else {
                actions.push({ target: router, value: 0n, data: encodeFunctionData({ abi: SWAP_EXACT_TOKENS_ABI, functionName: "swapExactTokensForTokens", args: [amountIn, minOut, path, vault, deadline] }) });
            }
        }

        // Validate + execute
        for (const action of actions) {
            const sim = await policyClient.validate(tokenId, action);
            if (!sim.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: sim.reason }) }] };
        }

        const result = actions.length === 1
            ? await policyClient.execute(tokenId, actions[0], true)
            : await policyClient.executeBatch(tokenId, actions, true);

        return {
            content: [{
                type: "text" as const, text: JSON.stringify({
                    status: "success", hash: result.hash, dex: useV3 ? "v3" : "v2",
                    quote: selectedQuote.toString(), minOut: minOut.toString(),
                })
            }],
        };
    }
);

// ── Tool: lend ──────────────────────────────────────────
server.tool(
    "lend",
    "Supply tokens to Venus Protocol to earn yield",
    {
        token_id: z.string().describe("Agent NFA Token ID"),
        token: z.string().describe("Token to supply (BNB, USDT, USDC, BUSD)"),
        amount: z.string().describe("Amount to supply (human-readable)"),
    },
    async ({ token_id, token, amount }) => {
        const { publicClient, policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const symbol = token.toUpperCase();
        const vTokenAddr = VENUS_VTOKENS[symbol];
        if (!vTokenAddr) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Unsupported: ${symbol}. Use: ${Object.keys(VENUS_VTOKENS).join(", ")}` }) }] };

        const isBNB = symbol === "BNB";
        const tokenInfo = resolveToken(symbol);
        const amt = parseAmount(amount, tokenInfo.decimals);
        const vault = await policyClient.getVault(tokenId);
        const actions: Action[] = [];

        if (isBNB) {
            actions.push({ target: vTokenAddr, value: amt, data: encodeFunctionData({ abi: VBNB_MINT_ABI, functionName: "mint" }) });
        } else {
            const allowance = await publicClient.readContract({ address: tokenInfo.address, abi: ERC20_ABI, functionName: "allowance", args: [vault, vTokenAddr] }).catch(() => 0n);
            if (allowance < amt) {
                actions.push({ target: tokenInfo.address, value: 0n, data: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [vTokenAddr, amt] }) });
            }
            actions.push({ target: vTokenAddr, value: 0n, data: encodeFunctionData({ abi: VTOKEN_ABI, functionName: "mint", args: [amt] }) });
        }

        for (const action of actions) {
            const sim = await policyClient.validate(tokenId, action);
            if (!sim.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: sim.reason }) }] };
        }

        const result = actions.length === 1
            ? await policyClient.execute(tokenId, actions[0], true)
            : await policyClient.executeBatch(tokenId, actions, true);

        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "success", hash: result.hash, protocol: "venus", action: "supply", token: symbol, amount }) }] };
    }
);

// ── Tool: redeem ────────────────────────────────────────
server.tool(
    "redeem",
    "Withdraw supplied tokens from Venus Protocol",
    {
        token_id: z.string().describe("Agent NFA Token ID"),
        token: z.string().describe("Token to redeem (BNB, USDT, USDC, BUSD)"),
        amount: z.string().describe("Amount to redeem (human-readable)"),
    },
    async ({ token_id, token, amount }) => {
        const { policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const symbol = token.toUpperCase();
        const vTokenAddr = VENUS_VTOKENS[symbol];
        if (!vTokenAddr) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Unsupported: ${symbol}` }) }] };

        const tokenInfo = resolveToken(symbol);
        const amt = parseAmount(amount, tokenInfo.decimals);
        const data = encodeFunctionData({ abi: VTOKEN_ABI, functionName: "redeemUnderlying", args: [amt] });
        const action: Action = { target: vTokenAddr, value: 0n, data };

        const sim = await policyClient.validate(tokenId, action);
        if (!sim.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: sim.reason }) }] };

        const result = await policyClient.execute(tokenId, action, true);
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "success", hash: result.hash, protocol: "venus", action: "redeem", token: symbol, amount }) }] };
    }
);

// ── Tool: lending_info ──────────────────────────────────
server.tool(
    "lending_info",
    "Show Venus Protocol supply balances and APY for agent vault",
    { token_id: z.string().describe("Agent NFA Token ID") },
    async ({ token_id }) => {
        const { publicClient, policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const vault = await policyClient.getVault(tokenId);
        const BLOCKS_PER_YEAR = 10512000n;

        const positions: Array<Record<string, unknown>> = [];
        for (const [symbol, vTokenAddr] of Object.entries(VENUS_VTOKENS)) {
            try {
                const supplied = await publicClient.readContract({ address: vTokenAddr, abi: VTOKEN_READ_ABI, functionName: "balanceOfUnderlying", args: [vault] });
                const ratePerBlock = await publicClient.readContract({ address: vTokenAddr, abi: VTOKEN_READ_ABI, functionName: "supplyRatePerBlock" });
                const rateFloat = Number(ratePerBlock) / 1e18;
                const apy = (Math.pow(1 + rateFloat, Number(BLOCKS_PER_YEAR)) - 1) * 100;
                const tokenInfo = resolveToken(symbol);
                positions.push({
                    token: symbol, vToken: vTokenAddr,
                    supplied: (Number(supplied) / Math.pow(10, tokenInfo.decimals)).toFixed(6),
                    apyPercent: apy.toFixed(2),
                    hasPosition: supplied > 0n,
                });
            } catch {
                positions.push({ token: symbol, error: "Failed to query" });
            }
        }

        return { content: [{ type: "text" as const, text: JSON.stringify({ vault, protocol: "venus", positions }) }] };
    }
);

// ── Tool: transfer ──────────────────────────────────────
server.tool(
    "transfer",
    "Transfer ERC20 tokens or BNB from vault to a recipient address",
    {
        token_id: z.string().describe("Agent NFA Token ID"),
        token: z.string().describe("Token symbol (e.g. BNB, USDT)"),
        amount: z.string().describe("Amount to transfer (human-readable)"),
        to: z.string().describe("Recipient address (0x...)"),
    },
    async ({ token_id, token, amount, to }) => {
        const { policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const tokenInfo = resolveToken(token);
        const amt = parseAmount(amount, tokenInfo.decimals);
        const recipient = to as Address;

        let action: Action;
        if (tokenInfo.address === "0x0000000000000000000000000000000000000000") {
            // Native BNB transfer
            action = { target: recipient, value: amt, data: "0x" as Hex };
        } else {
            // ERC20 transfer
            const data = encodeFunctionData({
                abi: [{ type: "function" as const, name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" as const }] as const,
                functionName: "transfer",
                args: [recipient, amt],
            });
            action = { target: tokenInfo.address, value: 0n, data };
        }

        const sim = await policyClient.validate(tokenId, action);
        if (!sim.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: sim.reason }) }] };

        const result = await policyClient.execute(tokenId, action, true);
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "success", hash: result.hash, token, amount, to: recipient }) }] };
    }
);

// ── Tool: my_agents ─────────────────────────────────────
const OPERATOR_OF_ABI = [{
    type: "function" as const, name: "operatorOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view" as const,
}] as const;

const DEFAULT_INDEXER = "https://indexer-mainnet.shll.run";

server.tool(
    "my_agents",
    "List all agents where the current operator key is authorized. Returns token IDs, vault addresses, and agent types. Call this first if the user does not specify a token ID.",
    {},
    async () => {
        const { account, publicClient, config } = createClients();
        const operator = account.address.toLowerCase();
        const nfaAddr = config.nfa as Address;

        // 1. Fetch all agents from indexer
        const res = await fetch(`${DEFAULT_INDEXER}/api/agents`);
        if (!res.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Indexer error: ${res.status}` }) }] };
        const json = await res.json() as { items?: Array<{ tokenId?: string | number; owner?: string; account?: string; isTemplate?: boolean; agentType?: string }> };
        const agents = (json.items || []).filter(a => !a.isTemplate && a.tokenId !== undefined);

        if (agents.length === 0) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ operator, agents: [], count: 0 }) }] };
        }

        // 2. Batch check operatorOf for all agents
        const checks = await Promise.all(
            agents.map(async (a) => {
                const tokenId = BigInt(a.tokenId!);
                try {
                    const op = await publicClient.readContract({
                        address: nfaAddr,
                        abi: OPERATOR_OF_ABI,
                        functionName: "operatorOf",
                        args: [tokenId],
                    });
                    return (op as string).toLowerCase() === operator ? {
                        tokenId: tokenId.toString(),
                        vault: a.account || "",
                        owner: a.owner || "",
                        agentType: a.agentType || "unknown",
                    } : null;
                } catch { return null; }
            })
        );

        const myAgents = checks.filter(c => c !== null);
        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify({ operator, agents: myAgents, count: myAgents.length }),
            }],
        };
    }
);

// ── Tool: wrap ──────────────────────────────────────────
server.tool(
    "wrap",
    "Wrap BNB to WBNB in agent vault",
    {
        token_id: z.string().describe("Agent NFA Token ID"),
        amount: z.string().describe("BNB amount to wrap (human-readable, e.g. 0.1)"),
    },
    async ({ token_id, amount }) => {
        const { policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const amt = parseEther(amount);
        const data = encodeFunctionData({ abi: WBNB_ABI, functionName: "deposit" });
        const action: Action = { target: WBNB as Address, value: amt, data };

        const sim = await policyClient.validate(tokenId, action);
        if (!sim.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: sim.reason }) }] };

        const result = await policyClient.execute(tokenId, action, true);
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "success", hash: result.hash, message: `Wrapped ${amount} BNB → WBNB` }) }] };
    }
);

// ── Tool: unwrap ────────────────────────────────────────
server.tool(
    "unwrap",
    "Unwrap WBNB to BNB in agent vault",
    {
        token_id: z.string().describe("Agent NFA Token ID"),
        amount: z.string().describe("WBNB amount to unwrap (human-readable, e.g. 0.1)"),
    },
    async ({ token_id, amount }) => {
        const { policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const amt = parseEther(amount);
        const data = encodeFunctionData({ abi: WBNB_ABI, functionName: "withdraw", args: [amt] });
        const action: Action = { target: WBNB as Address, value: 0n, data };

        const sim = await policyClient.validate(tokenId, action);
        if (!sim.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: sim.reason }) }] };

        const result = await policyClient.execute(tokenId, action, true);
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "success", hash: result.hash, message: `Unwrapped ${amount} WBNB → BNB` }) }] };
    }
);

// ── Tool: search ────────────────────────────────────────
server.tool(
    "search",
    "Search for a token by name or symbol on BSC via DexScreener",
    { query: z.string().describe("Token name or symbol to search") },
    async ({ query }) => {
        const encoded = encodeURIComponent(query);
        const resp = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encoded}`, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "DexScreener API error" }) }] };
        const data = await resp.json() as { pairs?: Array<{ chainId: string; baseToken: { symbol: string; name: string; address: string }; priceUsd: string; liquidity: { usd: number }; volume: { h24: number } }> };
        const results = (data.pairs || []).filter((p) => p.chainId === "bsc").slice(0, 10).map((p) => ({
            symbol: p.baseToken.symbol,
            name: p.baseToken.name,
            address: p.baseToken.address,
            priceUsd: p.priceUsd,
            liquidity: p.liquidity?.usd || 0,
            volume24h: p.volume?.h24 || 0,
        }));
        return { content: [{ type: "text" as const, text: JSON.stringify({ results, count: results.length }) }] };
    }
);

// ── Tool: tokens ────────────────────────────────────────
server.tool(
    "tokens",
    "List all known token symbols and their BSC addresses",
    {},
    async () => {
        const tokens = Object.entries(TOKEN_LIST).map(([sym, info]) => ({
            symbol: sym,
            address: info.address,
            decimals: info.decimals,
        }));
        return { content: [{ type: "text" as const, text: JSON.stringify({ tokens, count: tokens.length }) }] };
    }
);

// ── Tool: policies ──────────────────────────────────────
server.tool(
    "policies",
    "View all active policies and current risk settings for an agent",
    { token_id: z.string().describe("Agent NFA Token ID") },
    async ({ token_id }) => {
        const { publicClient, policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const policies = await policyClient.getPolicies(tokenId);

        const enriched: Array<Record<string, unknown>> = [];
        const summaryParts: string[] = [];

        for (const p of policies) {
            const entry: Record<string, unknown> = { name: p.policyTypeName, address: p.address, renterConfigurable: p.renterConfigurable };

            if (p.policyTypeName === "spending_limit") {
                try {
                    const limits = await publicClient.readContract({ address: p.address, abi: SPENDING_LIMIT_ABI, functionName: "instanceLimits", args: [tokenId] });
                    const [maxPerTx, maxPerDay, maxSlippageBps] = limits;
                    const txBnb = (Number(maxPerTx) / 1e18).toFixed(4);
                    const dayBnb = (Number(maxPerDay) / 1e18).toFixed(4);
                    entry.currentConfig = { maxPerTx: maxPerTx.toString(), maxPerTxBnb: txBnb, maxPerDay: maxPerDay.toString(), maxPerDayBnb: dayBnb, maxSlippageBps: maxSlippageBps.toString() };
                    summaryParts.push(`Max ${txBnb} BNB/tx, ${dayBnb} BNB/day, slippage ${maxSlippageBps}bps`);
                } catch { /* policy read failed */ }
            }
            if (p.policyTypeName === "cooldown") {
                try {
                    const cd = await publicClient.readContract({ address: p.address, abi: COOLDOWN_ABI, functionName: "cooldownSeconds", args: [tokenId] });
                    const secs = Number(cd);
                    entry.currentConfig = { cooldownSeconds: secs.toString() };
                    summaryParts.push(`Cooldown ${secs}s between transactions`);
                } catch { /* policy read failed */ }
            }
            if (p.policyTypeName === "receiver_guard") summaryParts.push("Outbound transfers restricted (ReceiverGuard)");
            if (p.policyTypeName === "dex_whitelist") summaryParts.push("Only whitelisted DEXs allowed");
            if (p.policyTypeName === "token_whitelist") summaryParts.push("Only whitelisted tokens allowed");
            if (p.policyTypeName === "defi_guard") summaryParts.push("DeFi interactions validated by DeFiGuard");

            enriched.push(entry);
        }

        const humanSummary = summaryParts.length > 0 ? summaryParts.join(" | ") : "No configurable policies found";
        return { content: [{ type: "text" as const, text: JSON.stringify({ tokenId: token_id, humanSummary, securityNote: "Operator wallet CANNOT withdraw vault funds or transfer Agent NFT.", policies: enriched }) }] };
    }
);

// ── Tool: status ────────────────────────────────────────
server.tool(
    "status",
    "One-shot security overview: vault balance, operator status, policies, and recent activity",
    { token_id: z.string().describe("Agent NFA Token ID") },
    async ({ token_id }) => {
        const { account, publicClient, policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const vault = await policyClient.getVault(tokenId);

        // 1. Vault BNB balance
        const bnbBalance = await publicClient.getBalance({ address: vault });
        const bnbHuman = (Number(bnbBalance) / 1e18).toFixed(6);

        // 2. Operator wallet info
        const opBalance = await publicClient.getBalance({ address: account.address });
        const opBnb = (Number(opBalance) / 1e18).toFixed(6);
        const operatorInfo = { address: account.address, gasBnb: opBnb, gasOk: Number(opBalance) > 1e15 };

        // 3. Policies summary
        const policies = await policyClient.getPolicies(tokenId);
        const summaryParts: string[] = [];
        for (const p of policies) {
            if (p.policyTypeName === "spending_limit") {
                try {
                    const limits = await publicClient.readContract({ address: p.address, abi: SPENDING_LIMIT_ABI, functionName: "instanceLimits", args: [tokenId] });
                    const [maxPerTx, maxPerDay] = limits;
                    summaryParts.push(`Max ${(Number(maxPerTx) / 1e18).toFixed(4)} BNB/tx, ${(Number(maxPerDay) / 1e18).toFixed(4)} BNB/day`);
                } catch { /* skip */ }
            }
            if (p.policyTypeName === "cooldown") {
                try {
                    const cd = await publicClient.readContract({ address: p.address, abi: COOLDOWN_ABI, functionName: "cooldownSeconds", args: [tokenId] });
                    summaryParts.push(`Cooldown ${Number(cd)}s`);
                } catch { /* skip */ }
            }
            if (p.policyTypeName === "receiver_guard") summaryParts.push("ReceiverGuard active");
            if (p.policyTypeName === "dex_whitelist") summaryParts.push("DEX whitelist active");
            if (p.policyTypeName === "token_whitelist") summaryParts.push("Token whitelist active");
            if (p.policyTypeName === "defi_guard") summaryParts.push("DeFiGuard active");
        }

        // 4. Recent activity from indexer (non-critical)
        let activityStats: Record<string, unknown> = { available: false };
        try {
            const summaryRes = await fetch(`${DEFAULT_INDEXER}/api/agents/${token_id}/summary`, { signal: AbortSignal.timeout(8000) });
            if (summaryRes.ok) {
                const summaryData = await summaryRes.json() as { totalExecutions: number; successCount: number; failCount: number; lastExecution: string | null };
                activityStats = {
                    available: true,
                    totalExecutions: summaryData.totalExecutions,
                    successRate: summaryData.totalExecutions > 0 ? `${((summaryData.successCount / summaryData.totalExecutions) * 100).toFixed(1)}%` : "N/A",
                    lastExecution: summaryData.lastExecution ? new Date(Number(summaryData.lastExecution) * 1000).toISOString() : null,
                };
            }
        } catch { /* non-critical */ }

        return {
            content: [{
                type: "text" as const, text: JSON.stringify({
                    tokenId: token_id,
                    vault: { address: vault, bnbBalance: bnbHuman },
                    operator: operatorInfo,
                    securitySummary: summaryParts.length > 0 ? summaryParts.join(" | ") : "No policies found",
                    policyCount: policies.length,
                    activity: activityStats,
                    securityNote: "Operator wallet CANNOT withdraw vault funds or transfer Agent NFT.",
                    dashboardUrl: `https://shll.run/dashboard?tokenId=${token_id}`,
                })
            }],
        };
    }
);

// ── Tool: history ───────────────────────────────────────
server.tool(
    "history",
    "Show recent transactions executed through the agent vault",
    {
        token_id: z.string().describe("Agent NFA Token ID"),
        limit: z.number().default(10).describe("Number of transactions to show"),
    },
    async ({ token_id, limit }) => {
        const activityRes = await fetch(`${DEFAULT_INDEXER}/api/activity/${token_id}?limit=${limit}`, { signal: AbortSignal.timeout(10000) });
        if (!activityRes.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Indexer returned ${activityRes.status}` }) }] };

        const data = await activityRes.json() as { items: Array<{ txHash: string; target: string; success: boolean; timestamp: string; blockNumber: string }>; count: number };

        // Policy rejections (non-critical)
        let failures: Array<{ txHash: string; reason: string; timestamp: string }> = [];
        try {
            const failRes = await fetch(`${DEFAULT_INDEXER}/api/agents/${token_id}/commit-failures?limit=5`, { signal: AbortSignal.timeout(8000) });
            if (failRes.ok) {
                const failData = await failRes.json() as { items: typeof failures };
                failures = failData.items || [];
            }
        } catch { /* non-critical */ }

        const transactions = (data.items || []).map((tx) => ({
            time: new Date(Number(tx.timestamp) * 1000).toISOString(),
            txHash: tx.txHash,
            target: tx.target,
            success: tx.success,
            bscscanUrl: `https://bscscan.com/tx/${tx.txHash}`,
        }));

        return { content: [{ type: "text" as const, text: JSON.stringify({ tokenId: token_id, transactions, totalShown: transactions.length, recentPolicyRejections: failures.length, policyRejections: failures.length > 0 ? failures : undefined }) }] };
    }
);

// ── Tool: config ────────────────────────────────────────
server.tool(
    "config",
    "Configure risk parameters (spending limits, cooldown) for an agent. Only tightening is allowed.",
    {
        token_id: z.string().describe("Agent NFA Token ID"),
        tx_limit: z.string().optional().describe("Max BNB per transaction (human-readable, e.g. 0.5)"),
        daily_limit: z.string().optional().describe("Max BNB per day (human-readable, e.g. 2.0)"),
        cooldown: z.string().optional().describe("Minimum seconds between transactions (e.g. 60)"),
    },
    async ({ token_id, tx_limit, daily_limit, cooldown }) => {
        if (!tx_limit && !daily_limit && !cooldown) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Specify at least one: tx_limit, daily_limit, or cooldown" }) }] };
        }

        const { account, publicClient, policyClient, config } = createClients();
        const tokenId = BigInt(token_id);
        const walletClient = createWalletClient({ account, chain: bsc, transport: http(config.rpc) });
        const policies = await policyClient.getPolicies(tokenId);
        const results: string[] = [];

        // Configure SpendingLimit
        if (tx_limit || daily_limit) {
            const spendingPolicy = policies.find(p => p.policyTypeName === "spending_limit");
            if (!spendingPolicy) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No SpendingLimitPolicy found" }) }] };

            const current = await publicClient.readContract({ address: spendingPolicy.address, abi: SPENDING_LIMIT_ABI, functionName: "instanceLimits", args: [tokenId] });
            const [curMaxPerTx, curMaxPerDay, curSlippage] = current;
            const newMaxPerTx = tx_limit ? parseEther(tx_limit) : curMaxPerTx;
            const newMaxPerDay = daily_limit ? parseEther(daily_limit) : curMaxPerDay;

            const hash = await walletClient.writeContract({ address: spendingPolicy.address, abi: SPENDING_LIMIT_ABI, functionName: "setLimits", args: [tokenId, newMaxPerTx, newMaxPerDay, curSlippage] });
            await publicClient.waitForTransactionReceipt({ hash });
            results.push(`SpendingLimit updated: ${hash}`);
        }

        // Configure Cooldown
        if (cooldown) {
            const cooldownPolicy = policies.find(p => p.policyTypeName === "cooldown");
            if (!cooldownPolicy) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No CooldownPolicy found" }) }] };

            const seconds = BigInt(cooldown);
            const hash = await walletClient.writeContract({ address: cooldownPolicy.address, abi: COOLDOWN_ABI, functionName: "setCooldown", args: [tokenId, seconds] });
            await publicClient.waitForTransactionReceipt({ hash });
            results.push(`Cooldown updated: ${hash}`);
        }

        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "success", message: "Risk parameters updated", details: results }) }] };
    }
);

// ── Tool: listings ──────────────────────────────────────
server.tool(
    "listings",
    "List all available agent templates for rent",
    {},
    async () => {
        const res = await fetch(`${DEFAULT_INDEXER}/api/listings`);
        if (!res.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Indexer returned ${res.status}` }) }] };
        const data = await res.json() as { items: Array<{ id: string; agentName: string; agentType: string; pricePerDay: string; minDays: number; active: boolean; nfa: string }>; count: number };

        const available = data.items.filter((l) => l.active);
        const listings = available.map((l) => ({
            listingId: l.id,
            name: l.agentName || "Unnamed Agent",
            type: l.agentType || "unknown",
            pricePerDayBNB: (Number(l.pricePerDay) / 1e18).toFixed(6),
            minDays: l.minDays,
            nfa: l.nfa,
        }));

        return { content: [{ type: "text" as const, text: JSON.stringify({ count: listings.length, listings, hint: "Use the listingId with setup_guide tool" }) }] };
    }
);

// ── Tool: setup_guide ───────────────────────────────────
server.tool(
    "setup_guide",
    "Generate step-by-step dual-wallet onboarding instructions and shll.run/setup URL",
    {
        listing_id: z.string().default(DEFAULT_LISTING_ID).describe("Template listing ID (bytes32 hex)"),
        days: z.number().default(1).describe("Number of days to rent"),
    },
    async ({ listing_id, days }) => {
        const { account, publicClient } = createClients();
        const operatorAddress = account.address;
        const listingId = listing_id;
        const daysToRent = days;

        // Query listing to calculate rent cost
        let rentCost = "unknown";
        try {
            const listing = await publicClient.readContract({ address: DEFAULT_LISTING_MANAGER as Address, abi: LISTING_MANAGER_ABI, functionName: "listings", args: [listingId as Hex] });
            const [, , , pricePerDay, minDays, active] = listing;
            if (!active) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Listing is not active" }) }] };
            if (daysToRent < minDays) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Minimum rental is ${minDays} days, you requested ${daysToRent}` }) }] };
            const totalRent = BigInt(pricePerDay) * BigInt(daysToRent);
            rentCost = `${(Number(totalRent) / 1e18).toFixed(6)} BNB`;
        } catch { rentCost = "unable to query — check listing_id"; }

        const setupUrl = `https://shll.run/setup?operator=${operatorAddress}&listing=${encodeURIComponent(listingId)}&days=${daysToRent}`;

        return {
            content: [{
                type: "text" as const, text: JSON.stringify({
                    status: "guide",
                    securityModel: "DUAL-WALLET: Your wallet (owner) stays offline. AI only uses the operator wallet, which CANNOT withdraw vault funds.",
                    operatorAddress,
                    setupUrl,
                    rentCost,
                    steps: [
                        { step: 1, title: "Open SHLL Setup Page", action: `Open ${setupUrl} in your browser`, note: "Connect YOUR wallet (MetaMask). This is your owner wallet." },
                        { step: 2, title: "Rent Agent", action: "Click 'Rent Agent' and confirm the transaction" },
                        { step: 3, title: "Authorize Operator", action: "Click 'Authorize Operator'", note: `Operator address: ${operatorAddress}` },
                        { step: 4, title: "Fund Vault (optional)", action: "Deposit BNB into the vault for trading" },
                        { step: 5, title: "Tell AI your token-id", action: "Come back and tell the AI your token-id number." },
                    ],
                })
            }],
        };
    }
);

// ── Tool: execute_calldata ──────────────────────────────
// Universal safety execution layer: accepts calldata from ANY source
// (OKX DEX API, Bitget, 1inch, etc.) and routes through PolicyGuard
server.tool(
    "execute_calldata",
    "Execute raw calldata through PolicyGuard safety layer. Use this to execute transactions from other DeFi skills (OKX DEX API, Bitget, 1inch, etc.) with SHLL on-chain policy enforcement. IMPORTANT: Before calling, verify that any 'recipient' or 'to' address embedded in the calldata matches the agent's vault address (use the 'portfolio' tool to check). This prevents funds from being routed to an unintended address.",
    {
        token_id: z.string().describe("Agent NFA Token ID"),
        target: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid Ethereum address").describe("Target contract address (0x...)"),
        data: z.string().regex(/^0x[0-9a-fA-F]*$/, "Must be a valid hex string starting with 0x").describe("Transaction calldata hex string"),
        value: z.string().default("0").describe("Native BNB value in wei (default: 0)"),
    },
    async ({ token_id, target, data, value }) => {
        const { policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const action: Action = {
            target: target as Address,
            value: BigInt(value),
            data: data as Hex,
        };

        // Validate through PolicyGuard (spending limits, cooldowns, whitelists)
        const sim = await policyClient.validate(tokenId, action);
        if (!sim.ok) {
            return {
                content: [{
                    type: "text" as const, text: JSON.stringify({
                        status: "rejected",
                        reason: sim.reason,
                        note: "PolicyGuard rejected this calldata. The target contract or operation may not be whitelisted, or it exceeds spending/cooldown limits.",
                    })
                }]
            };
        }

        const result = await policyClient.execute(tokenId, action, true);
        return {
            content: [{
                type: "text" as const, text: JSON.stringify({
                    status: "success",
                    hash: result.hash,
                    note: "Calldata executed through PolicyGuard. Transaction validated against all on-chain policies.",
                })
            }]
        };
    }
);

// ── Tool: execute_calldata_batch ─────────────────────────
server.tool(
    "execute_calldata_batch",
    "Execute multiple raw calldata actions atomically through PolicyGuard. Useful for approve+swap patterns from external DEX aggregators.",
    {
        token_id: z.string().describe("Agent NFA Token ID"),
        actions: z.array(z.object({
            target: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid Ethereum address").describe("Target contract address"),
            data: z.string().regex(/^0x[0-9a-fA-F]*$/, "Must be valid hex").describe("Calldata hex"),
            value: z.string().default("0").describe("BNB value in wei"),
        })).describe("Array of actions to execute atomically"),
    },
    async ({ token_id, actions: rawActions }) => {
        const { policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const actions: Action[] = rawActions.map(a => ({
            target: a.target as Address,
            value: BigInt(a.value || "0"),
            data: a.data as Hex,
        }));

        // Validate all actions
        for (let i = 0; i < actions.length; i++) {
            const sim = await policyClient.validate(tokenId, actions[i]);
            if (!sim.ok) {
                return {
                    content: [{
                        type: "text" as const, text: JSON.stringify({
                            status: "rejected",
                            failedActionIndex: i,
                            reason: sim.reason,
                        })
                    }]
                };
            }
        }

        const result = actions.length === 1
            ? await policyClient.execute(tokenId, actions[0], true)
            : await policyClient.executeBatch(tokenId, actions, true);

        return {
            content: [{
                type: "text" as const, text: JSON.stringify({
                    status: "success",
                    hash: result.hash,
                    actionsExecuted: actions.length,
                })
            }]
        };
    }
);

// ── Tool: generate_wallet ───────────────────────────────
server.tool(
    "generate_wallet",
    "Generate a new operator wallet (address + private key) for AI to use. This is a HOT wallet for trading only.",
    {},
    async () => {
        const pk = generatePrivateKey();
        const account = privateKeyToAccount(pk);
        return {
            content: [{
                type: "text" as const, text: JSON.stringify({
                    status: "success",
                    address: account.address,
                    privateKey: pk,
                    note: "SAVE THIS PRIVATE KEY SECURELY. This is the OPERATOR wallet — it can only trade within PolicyGuard limits. It CANNOT withdraw vault funds. Send ~$1 of BNB here for gas fees, then set RUNNER_PRIVATE_KEY.",
                    securityReminder: "Use a SEPARATE wallet as the owner to rent the agent and fund the vault. Use setup_guide tool for step-by-step instructions.",
                })
            }],
        };
    }
);

//                    Start Server
// ═══════════════════════════════════════════════════════

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((err) => {
    process.stderr.write(`SHLL MCP Server error: ${err.message}\n`);
    process.exit(1);
});
