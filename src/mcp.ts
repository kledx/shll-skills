#!/usr/bin/env node
/**
 * SHLL MCP Server 鈥?Model Context Protocol interface for DeFi operations
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
    decodeFunctionData,
    encodeFunctionData,
    http,
    parseEther,
    formatEther,
    type Address,
    type Hex,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { bsc } from "viem/chains";

// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
//                   BSC Constants
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?

const DEFAULT_NFA = "0x71cE46099E4b2a2434111C009A7E9CFd69747c8E"; // V4.1 mainnet
const DEFAULT_GUARD = "0x25d17eA0e3Bcb8CA08a2BFE917E817AFc05dbBB3";
const DEFAULT_RPC = "https://bsc-dataseed1.binance.org";
const DEFAULT_LISTING_MANAGER = "0x1f9CE85bD0FF75acc3D92eB79f1Eb472f0865071";
const DEFAULT_LISTING_ID = "0x64083b44e38db02749e6e16bf84ce6c19146cc42a108e53324e11f250b15a0b7";
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

// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
//                   Token Registry
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?

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

// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
//                   ABI Fragments
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?

const ERC20_ABI = [
    { type: "function" as const, name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" as const },
    { type: "function" as const, name: "allowance", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" as const },
    { type: "function" as const, name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" as const },
    { type: "function" as const, name: "decimals", inputs: [], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" as const },
    { type: "function" as const, name: "symbol", inputs: [], outputs: [{ name: "", type: "string" }], stateMutability: "view" as const },
] as const;
const ERC20_TRANSFER_ABI = [{
    type: "function" as const,
    name: "transfer",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable" as const,
}] as const;

const GET_AMOUNTS_OUT_ABI = [{
    type: "function" as const, name: "getAmountsOut",
    inputs: [{ name: "amountIn", type: "uint256" }, { name: "path", type: "address[]" }],
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "view" as const,
}] as const;

const SWAP_EXACT_ETH_ABI = [{ type: "function" as const, name: "swapExactETHForTokens", inputs: [{ name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [{ name: "", type: "uint256[]" }], stateMutability: "payable" as const }] as const;
const SWAP_EXACT_TOKENS_ABI = [{ type: "function" as const, name: "swapExactTokensForTokens", inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [{ name: "", type: "uint256[]" }], stateMutability: "nonpayable" as const }] as const;
const SWAP_EXACT_TOKENS_FOR_ETH_ABI = [{ type: "function" as const, name: "swapExactTokensForETH", inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [{ name: "", type: "uint256[]" }], stateMutability: "nonpayable" as const }] as const;
const SWAP_EXACT_ETH_FOR_TOKENS_FEE_ABI = [{ type: "function" as const, name: "swapExactETHForTokensSupportingFeeOnTransferTokens", inputs: [{ name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [], stateMutability: "payable" as const }] as const;
const SWAP_EXACT_TOKENS_FOR_TOKENS_FEE_ABI = [{ type: "function" as const, name: "swapExactTokensForTokensSupportingFeeOnTransferTokens", inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [], stateMutability: "nonpayable" as const }] as const;
const SWAP_EXACT_TOKENS_FOR_ETH_FEE_ABI = [{ type: "function" as const, name: "swapExactTokensForETHSupportingFeeOnTransferTokens", inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [], stateMutability: "nonpayable" as const }] as const;

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
const V3_EXACT_INPUT_ABI = [{
    type: "function" as const, name: "exactInput",
    inputs: [{
        name: "params", type: "tuple", components: [
            { name: "path", type: "bytes" },
            { name: "recipient", type: "address" },
            { name: "amountIn", type: "uint256" },
            { name: "amountOutMinimum", type: "uint256" },
            { name: "deadline", type: "uint256" },
        ],
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
    { type: "function" as const, name: "tokenRestrictionEnabled", inputs: [{ name: "instanceId", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" as const },
    { type: "function" as const, name: "getTokenList", inputs: [{ name: "instanceId", type: "uint256" }], outputs: [{ name: "", type: "address[]" }], stateMutability: "view" as const },
    { type: "function" as const, name: "addToken", inputs: [{ name: "instanceId", type: "uint256" }, { name: "token", type: "address" }], outputs: [], stateMutability: "nonpayable" as const },
    { type: "function" as const, name: "removeToken", inputs: [{ name: "instanceId", type: "uint256" }, { name: "token", type: "address" }], outputs: [], stateMutability: "nonpayable" as const },
    { type: "function" as const, name: "setTokenRestriction", inputs: [{ name: "instanceId", type: "uint256" }, { name: "enabled", type: "bool" }], outputs: [], stateMutability: "nonpayable" as const },
] as const;

const COOLDOWN_ABI = [
    { type: "function" as const, name: "setCooldown", inputs: [{ name: "instanceId", type: "uint256" }, { name: "seconds_", type: "uint256" }], outputs: [], stateMutability: "nonpayable" as const },
    { type: "function" as const, name: "cooldownSeconds", inputs: [{ name: "instanceId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" as const },
] as const;

const LISTING_MANAGER_ABI = [
    { type: "function" as const, name: "listings", inputs: [{ name: "listingId", type: "bytes32" }], outputs: [{ name: "nfa", type: "address" }, { name: "templateId", type: "uint256" }, { name: "owner", type: "address" }, { name: "pricePerDay", type: "uint256" }, { name: "minDays", type: "uint32" }, { name: "active", type: "bool" }], stateMutability: "view" as const },
] as const;

// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
//                  Shared Client Setup
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?

function getConfig() {
    const privateKey = process.env.RUNNER_PRIVATE_KEY;
    if (!privateKey) throw new Error("RUNNER_PRIVATE_KEY environment variable is required");
    const rpc = process.env.SHLL_RPC || DEFAULT_RPC;
    // Security: NFA and Guard addresses are hardcoded 鈥?never allow env overrides
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

// Pre-check: prevents write operations on expired/unauthorized agents with clear errors
const AGENT_NFA_CHECK_ABI = [
    { name: "operatorExpiresOf", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
    { name: "userExpires", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
    { name: "operatorOf", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
    { name: "userOf", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
    { name: "ownerOf", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
] as const;

async function checkAgentExpiry(tokenId: bigint) {
    const config = getConfig();
    const account = privateKeyToAccount(config.privateKey as Hex);
    const pc = createPublicClient({ chain: bsc, transport: http(config.rpc) });
    const [operatorExpires, userExpires, operator, renter, owner] = await Promise.all([
        pc.readContract({ address: config.nfa as Address, abi: AGENT_NFA_CHECK_ABI, functionName: "operatorExpiresOf", args: [tokenId] }) as Promise<bigint>,
        pc.readContract({ address: config.nfa as Address, abi: AGENT_NFA_CHECK_ABI, functionName: "userExpires", args: [tokenId] }) as Promise<bigint>,
        pc.readContract({ address: config.nfa as Address, abi: AGENT_NFA_CHECK_ABI, functionName: "operatorOf", args: [tokenId] }) as Promise<Address>,
        pc.readContract({ address: config.nfa as Address, abi: AGENT_NFA_CHECK_ABI, functionName: "userOf", args: [tokenId] }) as Promise<Address>,
        pc.readContract({ address: config.nfa as Address, abi: AGENT_NFA_CHECK_ABI, functionName: "ownerOf", args: [tokenId] }) as Promise<Address>,
    ]);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now > userExpires) {
        return {
            blocked: true,
            content: [{
                type: "text" as const, text: JSON.stringify({
                    status: "error",
                    message: `Agent token-id ${tokenId} rental has EXPIRED (expired at ${new Date(Number(userExpires) * 1000).toISOString()}). Please renew at https://shll.run/me or use a different token-id.`,
                    expiredAt: new Date(Number(userExpires) * 1000).toISOString(),
                    action: "renew",
                    next_step: "Renew subscription at https://shll.run/me, then retry this tool call.",
                })
            }],
        };
    }
    if (now > operatorExpires) {
        return {
            blocked: true,
            content: [{
                type: "text" as const, text: JSON.stringify({
                    status: "error",
                    message: `Agent token-id ${tokenId} operator authorization has EXPIRED (expired at ${new Date(Number(operatorExpires) * 1000).toISOString()}). Please renew at https://shll.run/me or use a different token-id.`,
                    expiredAt: new Date(Number(operatorExpires) * 1000).toISOString(),
                    action: "renew",
                    next_step: `Open ${agentConsoleUrl(tokenId)} and re-authorize your operator wallet, then retry.`,
                })
            }],
        };
    }
    // Operator identity check: verify RUNNER_PRIVATE_KEY wallet can execute
    const runnerAddr = account.address.toLowerCase();
    const isOperator = operator.toLowerCase() === runnerAddr;
    const isRenter = renter.toLowerCase() === runnerAddr;
    const isOwner = owner.toLowerCase() === runnerAddr;
    if (!isOperator && !isRenter && !isOwner) {
        return {
            blocked: true,
            content: [{
                type: "text" as const, text: JSON.stringify({
                    status: "error",
                    message: `RUNNER_PRIVATE_KEY wallet (${account.address}) is NOT authorized for token-id ${tokenId}. On-chain operator is ${operator}. Your wallet must be the operator, renter, or owner to execute transactions.`,
                    yourWallet: account.address,
                    onChainOperator: operator,
                    onChainRenter: renter,
                    onChainOwner: owner,
                    next_step: `Authorize ${account.address} via ${agentConsoleUrl(tokenId)} or switch RUNNER_PRIVATE_KEY to the correct operator wallet.`,
                    howToFix: [
                        `Option 1: Use the 'setup_guide' tool 鈥?it generates an EIP-712 OperatorPermit that lets the renter (${renter}) authorize your current wallet (${account.address}) as operator. The renter signs the permit in their browser wallet, then the runner submits it on-chain.`,
                        `Option 2: The renter (${renter}) can call setOperator(${tokenId}, ${account.address}, <expiry_timestamp>) on AgentNFA contract at ${config.nfa} to directly authorize this wallet.`,
                        `Option 3: Go to ${agentConsoleUrl(tokenId)} and set ${account.address} as the operator.`,
                        `Option 4: If you have access to the correct operator wallet (${operator}), set RUNNER_PRIVATE_KEY to that wallet's private key instead.`,
                    ],
                })
            }],
        };
    }
    return { blocked: false };
}

function agentConsoleUrl(tokenId: string | bigint) {
    return `https://shll.run/agent/${DEFAULT_NFA}/${tokenId.toString()}/console/safety`;
}

// Policy rejection 鈫?actionable user guidance
function policyRejectionHelp(reason: string | undefined, tokenId: string): Record<string, string> {
    const consoleUrl = agentConsoleUrl(tokenId);
    const r = reason ?? "";
    if (r.includes("Approve spender not allowed"))
        return { explanation: "The DEX router address is not in the approved spender whitelist. This is a platform-level security setting.", action: "Contact the Agent owner to approve this router, or use a different DEX.", consoleUrl };
    if (r.includes("Target not allowed"))
        return { explanation: "The contract address is not in the DeFi target whitelist.", action: "Enable the corresponding DeFi Pack in Console > Safety, or contact the Agent owner.", consoleUrl };
    if (r.includes("Token not in whitelist"))
        return { explanation: "Token restriction is ON and this token is not whitelisted.", action: `Add the token to the whitelist or disable token restriction at: ${consoleUrl}`, consoleUrl };
    if (r.includes("Exceeds per-tx limit"))
        return { explanation: "Transaction value exceeds the per-transaction spending limit.", action: `Reduce the amount, or increase the limit at: ${consoleUrl}`, consoleUrl };
    if (r.includes("Daily limit"))
        return { explanation: "Daily spending limit would be exceeded.", action: `Wait until tomorrow, or increase the daily limit at: ${consoleUrl}`, consoleUrl };
    if (r.includes("Approve exceeds limit"))
        return { explanation: "The approve amount exceeds the configured approve limit.", action: `Reduce the amount, or increase the approve limit at: ${consoleUrl}`, consoleUrl };
    if (r.includes("Cooldown"))
        return { explanation: "Cooldown period has not elapsed since the last transaction.", action: "Wait for the cooldown to expire before retrying.", consoleUrl };
    return { explanation: "Transaction was rejected by an on-chain security policy.", action: `Review your security settings at: ${consoleUrl}`, consoleUrl };
}

type RecipientCheckResult =
    | { ok: true; checkedRecipient?: Address; mode: "direct" | "decoded" | "no-recipient" }
    | { ok: false; reason: string };

function tryDecodeCalldata(abi: readonly unknown[], data: Hex) {
    try {
        return decodeFunctionData({ abi: abi as never, data });
    } catch {
        return null;
    }
}

function checkActionRecipientSafety(action: Action, vault: Address): RecipientCheckResult {
    const vaultLower = vault.toLowerCase();
    const targetLower = action.target.toLowerCase();
    const data = action.data as Hex;

    // Native transfer: recipient is the target itself.
    if (data === "0x") {
        if (targetLower !== vaultLower) {
            return {
                ok: false,
                reason: `Native transfer target ${action.target} does not match vault ${vault}.`,
            };
        }
        return { ok: true, checkedRecipient: action.target, mode: "direct" };
    }

    const swapEth = tryDecodeCalldata(SWAP_EXACT_ETH_ABI, data);
    if (swapEth?.functionName === "swapExactETHForTokens") {
        const recipient = swapEth.args?.[2] as Address | undefined;
        if (!recipient) return { ok: false, reason: "Decoded swapExactETHForTokens calldata but recipient was missing." };
        return recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: recipient, mode: "decoded" }
            : { ok: false, reason: `swapExactETHForTokens recipient ${recipient} does not match vault ${vault}.` };
    }

    const swapTokens = tryDecodeCalldata(SWAP_EXACT_TOKENS_ABI, data);
    if (swapTokens?.functionName === "swapExactTokensForTokens") {
        const recipient = swapTokens.args?.[3] as Address | undefined;
        if (!recipient) return { ok: false, reason: "Decoded swapExactTokensForTokens calldata but recipient was missing." };
        return recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: recipient, mode: "decoded" }
            : { ok: false, reason: `swapExactTokensForTokens recipient ${recipient} does not match vault ${vault}.` };
    }

    const swapTokensForEth = tryDecodeCalldata(SWAP_EXACT_TOKENS_FOR_ETH_ABI, data);
    if (swapTokensForEth?.functionName === "swapExactTokensForETH") {
        const recipient = swapTokensForEth.args?.[3] as Address | undefined;
        if (!recipient) return { ok: false, reason: "Decoded swapExactTokensForETH calldata but recipient was missing." };
        return recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: recipient, mode: "decoded" }
            : { ok: false, reason: `swapExactTokensForETH recipient ${recipient} does not match vault ${vault}.` };
    }

    const swapEthFee = tryDecodeCalldata(SWAP_EXACT_ETH_FOR_TOKENS_FEE_ABI, data);
    if (swapEthFee?.functionName === "swapExactETHForTokensSupportingFeeOnTransferTokens") {
        const recipient = swapEthFee.args?.[2] as Address | undefined;
        if (!recipient) return { ok: false, reason: "Decoded swapExactETHForTokensSupportingFeeOnTransferTokens calldata but recipient was missing." };
        return recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: recipient, mode: "decoded" }
            : { ok: false, reason: `swapExactETHForTokensSupportingFeeOnTransferTokens recipient ${recipient} does not match vault ${vault}.` };
    }

    const swapTokensFee = tryDecodeCalldata(SWAP_EXACT_TOKENS_FOR_TOKENS_FEE_ABI, data);
    if (swapTokensFee?.functionName === "swapExactTokensForTokensSupportingFeeOnTransferTokens") {
        const recipient = swapTokensFee.args?.[3] as Address | undefined;
        if (!recipient) return { ok: false, reason: "Decoded swapExactTokensForTokensSupportingFeeOnTransferTokens calldata but recipient was missing." };
        return recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: recipient, mode: "decoded" }
            : { ok: false, reason: `swapExactTokensForTokensSupportingFeeOnTransferTokens recipient ${recipient} does not match vault ${vault}.` };
    }

    const swapTokensForEthFee = tryDecodeCalldata(SWAP_EXACT_TOKENS_FOR_ETH_FEE_ABI, data);
    if (swapTokensForEthFee?.functionName === "swapExactTokensForETHSupportingFeeOnTransferTokens") {
        const recipient = swapTokensForEthFee.args?.[3] as Address | undefined;
        if (!recipient) return { ok: false, reason: "Decoded swapExactTokensForETHSupportingFeeOnTransferTokens calldata but recipient was missing." };
        return recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: recipient, mode: "decoded" }
            : { ok: false, reason: `swapExactTokensForETHSupportingFeeOnTransferTokens recipient ${recipient} does not match vault ${vault}.` };
    }

    const v3Single = tryDecodeCalldata(V3_EXACT_INPUT_SINGLE_ABI, data);
    if (v3Single?.functionName === "exactInputSingle") {
        const params = v3Single.args?.[0] as { recipient?: Address } | undefined;
        if (!params?.recipient) return { ok: false, reason: "Decoded exactInputSingle calldata but recipient was missing." };
        const recipient = params.recipient;
        return recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: recipient, mode: "decoded" }
            : { ok: false, reason: `exactInputSingle recipient ${recipient} does not match vault ${vault}.` };
    }

    const v3ExactInput = tryDecodeCalldata(V3_EXACT_INPUT_ABI, data);
    if (v3ExactInput?.functionName === "exactInput") {
        const params = v3ExactInput.args?.[0] as { recipient?: Address } | undefined;
        if (!params?.recipient) return { ok: false, reason: "Decoded exactInput calldata but recipient was missing." };
        const recipient = params.recipient;
        return recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: recipient, mode: "decoded" }
            : { ok: false, reason: `exactInput recipient ${recipient} does not match vault ${vault}.` };
    }

    const transfer = tryDecodeCalldata(ERC20_TRANSFER_ABI, data);
    if (transfer?.functionName === "transfer") {
        const recipient = transfer.args?.[0] as Address | undefined;
        if (!recipient) return { ok: false, reason: "Decoded ERC20 transfer calldata but recipient was missing." };
        return recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: recipient, mode: "decoded" }
            : { ok: false, reason: `ERC20 transfer recipient ${recipient} does not match vault ${vault}.` };
    }

    // Known safe no-recipient calls (approve/deposit/withdraw/redeem/supply).
    if (tryDecodeCalldata(ERC20_ABI, data)?.functionName === "approve") return { ok: true, mode: "no-recipient" };
    if (tryDecodeCalldata(WBNB_ABI, data)) return { ok: true, mode: "no-recipient" };
    if (tryDecodeCalldata(VTOKEN_ABI, data)) return { ok: true, mode: "no-recipient" };
    if (tryDecodeCalldata(VBNB_MINT_ABI, data)) return { ok: true, mode: "no-recipient" };

    return {
        ok: false,
        reason: "Unable to decode recipient from calldata. Blocked by default to prevent recipient redirection risk.",
    };
}

// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
//                    MCP Server
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?

const server = new McpServer({
    name: "shll-defi",
    version: "5.5.3",
});

// 鈹€鈹€ Tool: portfolio 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€ Tool: balance 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€ Tool: price 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€ Tool: swap 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
        const expiryCheck = await checkAgentExpiry(tokenId); if (expiryCheck.blocked) return { content: expiryCheck.content! };
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

        // Validate + execute (with V3鈫扸2 fallback on approve rejection)
        for (const action of actions) {
            const sim = await policyClient.validate(tokenId, action);
            if (!sim.ok) {
                // If V3 approve was rejected, try V2 fallback
                if (useV3 && sim.reason?.includes("Approve spender not allowed") && v2Available) {
                    const v2Actions: Action[] = [];
                    const v2Router = PANCAKE_V2_ROUTER as Address;
                    const v2MinOut = (v2Quote * BigInt(100 - slippage)) / 100n;
                    if (!isNativeIn) {
                        const allow = await publicClient.readContract({ address: fromToken.address, abi: ERC20_ABI, functionName: "allowance", args: [vault, v2Router] }).catch(() => 0n);
                        if (allow < amountIn) {
                            v2Actions.push({ target: fromToken.address, value: 0n, data: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [v2Router, amountIn] }) });
                        }
                    }
                    const v2Path: Address[] = tokenInAddr.toLowerCase() !== WBNB.toLowerCase() && tokenOutAddr.toLowerCase() !== WBNB.toLowerCase()
                        ? [tokenInAddr, WBNB as Address, tokenOutAddr] : [tokenInAddr, tokenOutAddr];
                    if (isNativeIn) {
                        v2Actions.push({ target: v2Router, value: amountIn, data: encodeFunctionData({ abi: SWAP_EXACT_ETH_ABI, functionName: "swapExactETHForTokens", args: [v2MinOut, v2Path, vault, deadline] }) });
                    } else {
                        v2Actions.push({ target: v2Router, value: 0n, data: encodeFunctionData({ abi: SWAP_EXACT_TOKENS_ABI, functionName: "swapExactTokensForTokens", args: [amountIn, v2MinOut, v2Path, vault, deadline] }) });
                    }
                    // Validate V2 fallback
                    for (const v2a of v2Actions) {
                        const v2Sim = await policyClient.validate(tokenId, v2a);
                        if (!v2Sim.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: v2Sim.reason, ...policyRejectionHelp(v2Sim.reason, token_id) }) }] };
                    }
                    const v2Result = v2Actions.length === 1
                        ? await policyClient.execute(tokenId, v2Actions[0], true)
                        : await policyClient.executeBatch(tokenId, v2Actions, true);
                    return {
                        content: [{
                            type: "text" as const, text: JSON.stringify({
                                status: "success", hash: v2Result.hash, dex: "v2",
                                quote: v2Quote.toString(), minOut: v2MinOut.toString(),
                                note: "V3 was rejected by policy (Approve spender not allowed). Auto-switched to V2.",
                            })
                        }]
                    };
                }
                return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: sim.reason, ...policyRejectionHelp(sim.reason, token_id) }) }] };
            }
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

// 鈹€鈹€ Tool: lend 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
        const expiryCheck = await checkAgentExpiry(tokenId); if (expiryCheck.blocked) return { content: expiryCheck.content! };
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
            if (!sim.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: sim.reason, ...policyRejectionHelp(sim.reason, token_id) }) }] };
        }

        const result = actions.length === 1
            ? await policyClient.execute(tokenId, actions[0], true)
            : await policyClient.executeBatch(tokenId, actions, true);

        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "success", hash: result.hash, protocol: "venus", action: "supply", token: symbol, amount }) }] };
    }
);

// 鈹€鈹€ Tool: redeem 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
        const expiryCheck = await checkAgentExpiry(tokenId); if (expiryCheck.blocked) return { content: expiryCheck.content! };
        const symbol = token.toUpperCase();
        const vTokenAddr = VENUS_VTOKENS[symbol];
        if (!vTokenAddr) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Unsupported: ${symbol}` }) }] };

        const tokenInfo = resolveToken(symbol);
        const amt = parseAmount(amount, tokenInfo.decimals);
        const data = encodeFunctionData({ abi: VTOKEN_ABI, functionName: "redeemUnderlying", args: [amt] });
        const action: Action = { target: vTokenAddr, value: 0n, data };

        const sim = await policyClient.validate(tokenId, action);
        if (!sim.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: sim.reason, ...policyRejectionHelp(sim.reason, token_id) }) }] };

        const result = await policyClient.execute(tokenId, action, true);
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "success", hash: result.hash, protocol: "venus", action: "redeem", token: symbol, amount }) }] };
    }
);

// 鈹€鈹€ Tool: lending_info 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€ Tool: transfer 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
        const expiryCheck = await checkAgentExpiry(tokenId); if (expiryCheck.blocked) return { content: expiryCheck.content! };
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
        if (!sim.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: sim.reason, ...policyRejectionHelp(sim.reason, token_id) }) }] };

        const result = await policyClient.execute(tokenId, action, true);
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "success", hash: result.hash, token, amount, to: recipient }) }] };
    }
);

// 鈹€鈹€ Tool: my_agents 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
const MY_AGENTS_ABI = [
    { type: "function" as const, name: "operatorOf", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }], stateMutability: "view" as const },
    { type: "function" as const, name: "operatorExpiresOf", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" as const },
] as const;

const DEFAULT_INDEXER = "https://indexer-mainnet.shll.run";

type IndexerListing = {
    id: string;
    agentName: string;
    agentType: string;
    pricePerDay: string;
    minDays: number;
    active: boolean;
    nfa: string;
};

const LISTING_ID_REGEX = /^0x[0-9a-fA-F]{64}$/;

function isValidListingId(value: string): boolean {
    return LISTING_ID_REGEX.test(value);
}

function toSafeInt(value: unknown, fallback: number): number {
    if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    return fallback;
}

function normalizeIndexerListing(raw: unknown): IndexerListing | null {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const nfa = typeof item.nfa === "string" ? item.nfa : "";
    if (!isValidListingId(id)) return null;

    const pricePerDayRaw = item.pricePerDay;
    const pricePerDay = typeof pricePerDayRaw === "string"
        || typeof pricePerDayRaw === "number"
        || typeof pricePerDayRaw === "bigint"
        ? String(pricePerDayRaw)
        : "0";

    return {
        id,
        agentName: typeof item.agentName === "string" ? item.agentName : "",
        agentType: typeof item.agentType === "string" ? item.agentType : "",
        pricePerDay,
        minDays: Math.max(0, toSafeInt(item.minDays, 0)),
        active: item.active === true,
        nfa,
    };
}

async function fetchActiveListings(): Promise<IndexerListing[]> {
    const res = await fetch(`${DEFAULT_INDEXER}/api/listings`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Indexer returned ${res.status}`);
    const data = await res.json() as { items?: unknown };
    const items = Array.isArray(data.items) ? data.items : [];
    return items
        .map((raw) => normalizeIndexerListing(raw))
        .filter((l): l is IndexerListing => l !== null && l.active);
}

function pickPreferredListing(listings: IndexerListing[]): IndexerListing | null {
    if (listings.length === 0) return null;
    const nfaLower = DEFAULT_NFA.toLowerCase();
    const sameNfa = listings.filter((l) => (l.nfa || "").toLowerCase() === nfaLower);
    const pool = sameNfa.length > 0 ? sameNfa : listings;
    return pool.find((l) => l.id.toLowerCase() === DEFAULT_LISTING_ID.toLowerCase()) || pool[0] || null;
}

async function resolveSetupListing(listingId?: string) {
    if (listingId) {
        return {
            listingId,
            source: "manual" as const,
            listing: null as IndexerListing | null,
            warning: null as string | null,
        };
    }

    try {
        const active = await fetchActiveListings();
        const selected = pickPreferredListing(active);
        if (selected) {
            return {
                listingId: selected.id,
                source: "indexer-auto" as const,
                listing: selected,
                warning: null as string | null,
            };
        }
        return {
            listingId: DEFAULT_LISTING_ID,
            source: "default-fallback" as const,
            listing: null as IndexerListing | null,
            warning: "No active listings returned by indexer; fell back to default listing_id.",
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown indexer error";
        return {
            listingId: DEFAULT_LISTING_ID,
            source: "default-fallback" as const,
            listing: null as IndexerListing | null,
            warning: `Failed to fetch listings from indexer (${message}); fell back to default listing_id.`,
        };
    }
}

server.tool(
    "my_agents",
    "List all agents where the current operator key is or was authorized. Returns active agents and expired agents that need renewal.",
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

        // 2. Check operatorOf AND operatorExpiresOf for all agents
        const checks = await Promise.all(
            agents.map(async (a) => {
                const tokenId = BigInt(a.tokenId!);
                try {
                    const [op, opExpires] = await Promise.all([
                        publicClient.readContract({ address: nfaAddr, abi: MY_AGENTS_ABI, functionName: "operatorOf", args: [tokenId] }) as Promise<string>,
                        publicClient.readContract({ address: nfaAddr, abi: MY_AGENTS_ABI, functionName: "operatorExpiresOf", args: [tokenId] }) as Promise<bigint>,
                    ]);
                    const isActive = op.toLowerCase() === operator;
                    const now = BigInt(Math.floor(Date.now() / 1000));
                    const isExpired = !isActive && Number(opExpires) > 0 && now > opExpires;

                    if (isActive) {
                        return {
                            tokenId: tokenId.toString(), vault: a.account || "", owner: a.owner || "",
                            agentType: a.agentType || "unknown", status: "active" as const,
                            operatorExpires: new Date(Number(opExpires) * 1000).toISOString(),
                        };
                    } else if (isExpired) {
                        return {
                            tokenId: tokenId.toString(), vault: a.account || "", owner: a.owner || "",
                            agentType: a.agentType || "unknown", status: "expired" as const,
                            operatorExpires: new Date(Number(opExpires) * 1000).toISOString(),
                            note: "Operator authorization expired. Renew at https://shll.run/me",
                        };
                    }
                    return null;
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

// 鈹€鈹€ Tool: wrap 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
        const expiryCheck = await checkAgentExpiry(tokenId); if (expiryCheck.blocked) return { content: expiryCheck.content! };
        const amt = parseEther(amount);
        const data = encodeFunctionData({ abi: WBNB_ABI, functionName: "deposit" });
        const action: Action = { target: WBNB as Address, value: amt, data };

        const sim = await policyClient.validate(tokenId, action);
        if (!sim.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: sim.reason, ...policyRejectionHelp(sim.reason, token_id) }) }] };

        const result = await policyClient.execute(tokenId, action, true);
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "success", hash: result.hash, message: `Wrapped ${amount} BNB 鈫?WBNB` }) }] };
    }
);

// 鈹€鈹€ Tool: unwrap 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
        const expiryCheck = await checkAgentExpiry(tokenId); if (expiryCheck.blocked) return { content: expiryCheck.content! };
        const amt = parseEther(amount);
        const data = encodeFunctionData({ abi: WBNB_ABI, functionName: "withdraw", args: [amt] });
        const action: Action = { target: WBNB as Address, value: 0n, data };

        const sim = await policyClient.validate(tokenId, action);
        if (!sim.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: sim.reason, ...policyRejectionHelp(sim.reason, token_id) }) }] };

        const result = await policyClient.execute(tokenId, action, true);
        return { content: [{ type: "text" as const, text: JSON.stringify({ status: "success", hash: result.hash, message: `Unwrapped ${amount} WBNB 鈫?BNB` }) }] };
    }
);

// 鈹€鈹€ Tool: search 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€ Tool: tokens 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€ Tool: policies 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
                    // Also read token restriction status
                    let tokenRestriction: Record<string, unknown> = {};
                    try {
                        const enabled = await publicClient.readContract({ address: p.address, abi: SPENDING_LIMIT_ABI, functionName: "tokenRestrictionEnabled", args: [tokenId] }) as boolean;
                        const tokenList = await publicClient.readContract({ address: p.address, abi: SPENDING_LIMIT_ABI, functionName: "getTokenList", args: [tokenId] }) as string[];
                        tokenRestriction = { tokenRestrictionEnabled: enabled, whitelistedTokens: tokenList, whitelistedTokenCount: tokenList.length };
                        summaryParts.push(enabled ? `Token whitelist ON (${tokenList.length} tokens)` : "Token whitelist OFF (any token allowed)");
                    } catch { /* token restriction not available on this version */ }
                    entry.currentConfig = { maxPerTx: maxPerTx.toString(), maxPerTxBnb: txBnb, maxPerDay: maxPerDay.toString(), maxPerDayBnb: dayBnb, maxSlippageBps: maxSlippageBps.toString(), ...tokenRestriction };
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

// 鈹€鈹€ Tool: token_restriction 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
server.tool(
    "token_restriction",
    "Check token whitelist restriction status. Shows whether token trading is restricted and which tokens are whitelisted.",
    { token_id: z.string().describe("Agent NFA Token ID") },
    async ({ token_id }) => {
        const { publicClient, policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const policies = await policyClient.getPolicies(tokenId);
        const spendingPolicy = policies.find(p => p.policyTypeName === "spending_limit");
        if (!spendingPolicy) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ tokenId: token_id, error: "No spending_limit policy found 鈥?token restriction is not available for this agent." }) }] };
        }
        try {
            const [enabled, tokenList] = await Promise.all([
                publicClient.readContract({ address: spendingPolicy.address, abi: SPENDING_LIMIT_ABI, functionName: "tokenRestrictionEnabled", args: [tokenId] }) as Promise<boolean>,
                publicClient.readContract({ address: spendingPolicy.address, abi: SPENDING_LIMIT_ABI, functionName: "getTokenList", args: [tokenId] }) as Promise<string[]>,
            ]);
            const result = {
                tokenId: token_id,
                tokenRestrictionEnabled: enabled,
                status: enabled ? "ON 鈥?only whitelisted tokens can be traded" : "OFF 鈥?any token can be traded",
                whitelistedTokens: tokenList,
                whitelistedTokenCount: tokenList.length,
                manageUrl: agentConsoleUrl(token_id),
                note: enabled
                    ? "To add/remove tokens or disable restriction, visit the management URL above (requires connected wallet as renter/owner)."
                    : "Token restriction is disabled. The agent can trade any token. To enable, visit the management URL.",
            };
            return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
        } catch {
            return { content: [{ type: "text" as const, text: JSON.stringify({ tokenId: token_id, error: "Failed to read token restriction 鈥?the SpendingLimitPolicy may not support this feature." }) }] };
        }
    }
);

// 鈹€鈹€ Tool: status 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€ Tool: history 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€ Tool: config 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
        const expiryCheck = await checkAgentExpiry(tokenId); if (expiryCheck.blocked) return { content: expiryCheck.content! };
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

// 鈹€鈹€ Tool: listings 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
server.tool(
    "listings",
    "List all available agent templates for rent",
    {},
    async () => {
        try {
            const available = await fetchActiveListings();
            const listings = available.map((l) => ({
                listingId: l.id,
                name: l.agentName || "Unnamed Agent",
                type: l.agentType || "unknown",
                pricePerDayBNB: (Number(l.pricePerDay) / 1e18).toFixed(6),
                minDays: l.minDays,
                nfa: l.nfa,
            }));
            return {
                content: [{
                    type: "text" as const, text: JSON.stringify({
                        count: listings.length,
                        listings,
                        hint: "setup_guide can auto-select an active listing when listing_id is omitted.",
                    })
                }]
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return { content: [{ type: "text" as const, text: JSON.stringify({ status: "error", message }) }] };
        }
    }
);

// 鈹€鈹€ Tool: setup_guide 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
server.tool(
    "setup_guide",
    "Generate step-by-step dual-wallet onboarding instructions and shll.run/setup URL. If listing_id is omitted, an active listing is auto-selected from indexer.",
    {
        listing_id: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "listing_id must be bytes32 hex (0x + 64 hex chars)").optional().describe("Template listing ID (bytes32 hex). Optional: auto-select when omitted."),
        days: z.number().int().min(7).max(3650).default(7).describe("Number of days to rent (integer, minimum 7)"),
    },
    async ({ listing_id, days }) => {
        const { account, publicClient } = createClients();
        const operatorAddress = account.address;
        const resolvedListing = await resolveSetupListing(listing_id);
        const listingId = resolvedListing.listingId;
        const daysToRent = days;
        if (!Number.isInteger(daysToRent) || daysToRent < 7) {
            return {
                content: [{
                    type: "text" as const, text: JSON.stringify({
                        status: "error",
                        error: "Invalid days value",
                        next_step: "Use an integer day count >= 7 (e.g. 7).",
                    })
                }],
            };
        }

        // Query listing to calculate rent cost
        let rentCost = "unknown";
        try {
            const listing = await publicClient.readContract({ address: DEFAULT_LISTING_MANAGER as Address, abi: LISTING_MANAGER_ABI, functionName: "listings", args: [listingId as Hex] });
            const [, , , pricePerDay, minDays, active] = listing;
            if (!active) return {
                content: [{
                    type: "text" as const, text: JSON.stringify({
                        status: "error",
                        error: "Listing is not active",
                        listing_id: listingId,
                        listingSource: resolvedListing.source,
                        next_step: "Call listings tool and retry setup_guide with an active listing_id.",
                    })
                }]
            };
            if (daysToRent < minDays) return {
                content: [{
                    type: "text" as const, text: JSON.stringify({
                        status: "error",
                        error: `Minimum rental is ${minDays} days, you requested ${daysToRent}`,
                        listing_id: listingId,
                        listingSource: resolvedListing.source,
                        next_step: `Increase days to at least ${minDays} and retry setup_guide.`,
                    })
                }]
            };
            const totalRent = BigInt(pricePerDay) * BigInt(daysToRent);
            rentCost = `${(Number(totalRent) / 1e18).toFixed(6)} BNB`;
                } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return {
                content: [{
                    type: "text" as const, text: JSON.stringify({
                        status: "error",
                        error: "Failed to query listing on-chain",
                        listing_id: listingId,
                        listingSource: resolvedListing.source,
                        reason: message,
                        next_step: "Check listing_id and RPC connectivity, then retry setup_guide.",
                    })
                }],
            };
        }

        const setupUrl = `https://shll.run/setup?operator=${operatorAddress}&listing=${encodeURIComponent(listingId)}&days=${daysToRent}`;

        return {
            content: [{
                type: "text" as const, text: JSON.stringify({
                    status: "guide",
                    securityModel: "DUAL-WALLET: Your wallet (owner) stays offline. AI only uses the operator wallet, which CANNOT withdraw vault funds.",
                    operatorAddress,
                    setupUrl,
                    listingSelection: {
                        source: resolvedListing.source,
                        listingId,
                        listingName: resolvedListing.listing?.agentName || undefined,
                        listingType: resolvedListing.listing?.agentType || undefined,
                    },
                    warning: resolvedListing.warning || undefined,
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

// 鈹€鈹€ Tool: execute_calldata 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
        const expiryCheck = await checkAgentExpiry(tokenId); if (expiryCheck.blocked) return { content: expiryCheck.content! };
        const vault = await policyClient.getVault(tokenId);
        const action: Action = {
            target: target as Address,
            value: BigInt(value),
            data: data as Hex,
        };

        const recipientCheck = checkActionRecipientSafety(action, vault);
        if (!recipientCheck.ok) {
            return {
                content: [{
                    type: "text" as const, text: JSON.stringify({
                        status: "error",
                        reason: recipientCheck.reason,
                        vault,
                        note: "Blocked before on-chain execution to prevent recipient redirection risk.",
                        next_step: "Use built-in swap/lend/redeem tools, or provide calldata with recipient explicitly set to this vault.",
                    })
                }],
            };
        }

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

// 鈹€鈹€ Tool: execute_calldata_batch 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
        const expiryCheck = await checkAgentExpiry(tokenId); if (expiryCheck.blocked) return { content: expiryCheck.content! };
        const vault = await policyClient.getVault(tokenId);
        const actions: Action[] = rawActions.map(a => ({
            target: a.target as Address,
            value: BigInt(a.value || "0"),
            data: a.data as Hex,
        }));

        for (let i = 0; i < actions.length; i++) {
            const recipientCheck = checkActionRecipientSafety(actions[i], vault);
            if (!recipientCheck.ok) {
                return {
                    content: [{
                        type: "text" as const, text: JSON.stringify({
                        status: "error",
                        failedActionIndex: i,
                        reason: recipientCheck.reason,
                        vault,
                        note: "Blocked before on-chain execution to prevent recipient redirection risk.",
                        next_step: "Fix calldata recipient for the failed action, then retry batch execution.",
                    })
                }],
            };
            }
        }

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

// 鈹€鈹€ Four.meme Launchpad Constants 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
const FOUR_MEME_HELPER_V3 = "0xF251F83e40a78868FcfA3FA4599Dad6494E46034" as Address;

const FOUR_MEME_HELPER_ABI = [
    {
        type: "function" as const, name: "getTokenInfo",
        inputs: [{ name: "token", type: "address" }],
        outputs: [
            { name: "version", type: "uint256" }, { name: "tokenManager", type: "address" },
            { name: "quote", type: "address" }, { name: "lastPrice", type: "uint256" },
            { name: "tradingFeeRate", type: "uint256" }, { name: "minTradingFee", type: "uint256" },
            { name: "launchTime", type: "uint256" }, { name: "offers", type: "uint256" },
            { name: "maxOffers", type: "uint256" }, { name: "funds", type: "uint256" },
            { name: "maxFunds", type: "uint256" }, { name: "liquidityAdded", type: "bool" },
        ],
        stateMutability: "view" as const,
    },
    {
        type: "function" as const, name: "tryBuy",
        inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }, { name: "funds", type: "uint256" }],
        outputs: [
            { name: "tokenManager", type: "address" }, { name: "quote", type: "address" },
            { name: "estimatedAmount", type: "uint256" }, { name: "estimatedCost", type: "uint256" },
            { name: "estimatedFee", type: "uint256" }, { name: "amountMsgValue", type: "uint256" },
            { name: "amountApproval", type: "uint256" }, { name: "amountFunds", type: "uint256" },
        ],
        stateMutability: "view" as const,
    },
    {
        type: "function" as const, name: "trySell",
        inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }],
        outputs: [
            { name: "tokenManager", type: "address" }, { name: "quote", type: "address" },
            { name: "funds", type: "uint256" }, { name: "fee", type: "uint256" },
        ],
        stateMutability: "view" as const,
    },
] as const;

const FOUR_MEME_V1_ABI = [
    { type: "function" as const, name: "purchaseTokenAMAP", inputs: [{ name: "token", type: "address" }, { name: "funds", type: "uint256" }, { name: "minAmount", type: "uint256" }], outputs: [], stateMutability: "payable" as const },
    { type: "function" as const, name: "saleToken", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" as const },
] as const;

const FOUR_MEME_V2_ABI = [
    { type: "function" as const, name: "buyTokenAMAP", inputs: [{ name: "token", type: "address" }, { name: "funds", type: "uint256" }, { name: "minAmount", type: "uint256" }], outputs: [], stateMutability: "payable" as const },
    { type: "function" as const, name: "sellToken", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" as const },
] as const;

// 鈹€鈹€ Tool: four_info 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
server.tool(
    "four_info",
    "Query Four.meme bonding curve token info 鈥?price, progress, trading phase, and whether it has migrated to DEX",
    { token: z.string().describe("Token contract address on Four.meme (0x...)") },
    async ({ token }) => {
        const { publicClient } = createClients();
        const tokenAddr = token as Address;

        const info = await publicClient.readContract({
            address: FOUR_MEME_HELPER_V3,
            abi: FOUR_MEME_HELPER_ABI,
            functionName: "getTokenInfo",
            args: [tokenAddr],
        });

        const [version, tokenManager, quote, lastPrice, tradingFeeRate, minTradingFee,
            launchTime, offers, maxOffers, funds, maxFunds, liquidityAdded] = info;

        const progressPct = maxFunds > 0n ? Number((funds * 10000n) / maxFunds) / 100 : 0;
        const offersPct = maxOffers > 0n ? Number(((maxOffers - offers) * 10000n) / maxOffers) / 100 : 0;

        return {
            content: [{
                type: "text" as const, text: JSON.stringify({
                    token: tokenAddr,
                    version: Number(version),
                    tokenManager,
                    quoteToken: quote === "0x0000000000000000000000000000000000000000" ? "BNB" : quote,
                    lastPrice: lastPrice.toString(),
                    lastPriceHuman: (Number(lastPrice) / 1e18).toExponential(4),
                    tradingFeeRate: `${Number(tradingFeeRate) / 100}%`,
                    launchTime: new Date(Number(launchTime) * 1000).toISOString(),
                    tokensSoldPct: `${offersPct.toFixed(2)}%`,
                    fundsRaisedBNB: (Number(funds) / 1e18).toFixed(4),
                    maxFundsBNB: (Number(maxFunds) / 1e18).toFixed(4),
                    bondingCurveProgress: `${progressPct.toFixed(2)}%`,
                    liquidityAdded,
                    tradingPhase: liquidityAdded ? "DEX (PancakeSwap)" : "Internal (Bonding Curve)",
                })
            }],
        };
    }
);

// 鈹€鈹€ Tool: four_buy 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
server.tool(
    "four_buy",
    "Buy tokens on Four.meme internal bonding curve using BNB. Only works for tokens still in bonding curve phase (not yet migrated to DEX).",
    {
        token_id: z.string().describe("Agent NFA Token ID"),
        token: z.string().describe("Token contract address on Four.meme (0x...)"),
        amount: z.string().describe("BNB amount to spend (human-readable, e.g. 0.01)"),
        slippage: z.number().default(10).describe("Slippage tolerance percent (default: 10, meme tokens are volatile)"),
    },
    async ({ token_id, token, amount, slippage }) => {
        const { publicClient, policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const expiryCheck = await checkAgentExpiry(tokenId);
        if (expiryCheck.blocked) return { content: expiryCheck.content! };

        const tokenAddr = token as Address;
        const bnbAmount = parseAmount(amount, 18);
        if (bnbAmount <= 0n) {
            return {
                content: [{
                    type: "text" as const, text: JSON.stringify({
                        status: "error",
                        message: "Invalid amount. four_buy amount must be a positive BNB value.",
                    })
                }],
            };
        }
        const vault = await policyClient.getVault(tokenId);

        // 1. Get token info
        const info = await publicClient.readContract({
            address: FOUR_MEME_HELPER_V3,
            abi: FOUR_MEME_HELPER_ABI,
            functionName: "getTokenInfo",
            args: [tokenAddr],
        });
        const [version, tokenManager, quote, , , minTradingFee, , , , , , liquidityAdded] = info;

        if (liquidityAdded) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ status: "error", message: "Token has already migrated to DEX. Use the 'swap' tool instead." }) }] };
        }
        if (quote !== "0x0000000000000000000000000000000000000000") {
            return { content: [{ type: "text" as const, text: JSON.stringify({ status: "error", message: `Token uses BEP20 quote (${quote}), not BNB. BEP20 pairs not yet supported.` }) }] };
        }
        if (bnbAmount < minTradingFee) {
            return {
                content: [{
                    type: "text" as const, text: JSON.stringify({
                        status: "error",
                        message: "Input amount is below Four.meme minimum trading fee threshold.",
                        next_step: "Increase amount and retry.",
                        token: tokenAddr,
                        inputWei: bnbAmount.toString(),
                        minTradingFeeWei: minTradingFee.toString(),
                        minTradingFeeBnb: (Number(minTradingFee) / 1e18).toFixed(6),
                    })
                }],
            };
        }

        // 2. Pre-calculate
        const tryBuyResult = await publicClient.readContract({
            address: FOUR_MEME_HELPER_V3,
            abi: FOUR_MEME_HELPER_ABI,
            functionName: "tryBuy",
            args: [tokenAddr, 0n, bnbAmount],
        });
        const [, , estimatedAmount, , estimatedFee, amountMsgValue] = tryBuyResult;
        if (amountMsgValue < minTradingFee) {
            return {
                content: [{
                    type: "text" as const, text: JSON.stringify({
                        status: "error",
                        message: "Computed payable amount is below Four.meme minimum trading fee threshold.",
                        next_step: "Increase amount and retry.",
                        token: tokenAddr,
                        payableWei: amountMsgValue.toString(),
                        minTradingFeeWei: minTradingFee.toString(),
                        minTradingFeeBnb: (Number(minTradingFee) / 1e18).toFixed(6),
                    })
                }],
            };
        }
        if (estimatedAmount <= 0n || amountMsgValue <= 0n) {
            return {
                content: [{
                    type: "text" as const, text: JSON.stringify({
                        status: "error",
                        message: "four_buy quote returned zero output. Requested amount is likely too small for this market.",
                        next_step: "Increase amount and retry.",
                        token: tokenAddr,
                    })
                }],
            };
        }
        const vaultBnbBalance = await publicClient.getBalance({ address: vault });
        if (amountMsgValue > vaultBnbBalance) {
            return {
                content: [{
                    type: "text" as const, text: JSON.stringify({
                        status: "error",
                        message: "Vault BNB balance is insufficient for four_buy.",
                        next_step: "Deposit more BNB to vault or reduce amount, then retry.",
                        vault,
                        requiredBnb: (Number(amountMsgValue) / 1e18).toFixed(6),
                        availableBnb: (Number(vaultBnbBalance) / 1e18).toFixed(6),
                        requiredWei: amountMsgValue.toString(),
                        availableWei: vaultBnbBalance.toString(),
                    })
                }],
            };
        }

        // Align to GWEI precision (Four.meme requirement)
        const minAmount = (estimatedAmount * BigInt(100 - slippage)) / 100n;
        const alignedMinAmount = (minAmount / 1000000000n) * 1000000000n;

        // 3. Build action
        let data: Hex;
        if (Number(version) === 1) {
            data = encodeFunctionData({ abi: FOUR_MEME_V1_ABI, functionName: "purchaseTokenAMAP", args: [tokenAddr, bnbAmount, alignedMinAmount] });
        } else {
            data = encodeFunctionData({ abi: FOUR_MEME_V2_ABI, functionName: "buyTokenAMAP", args: [tokenAddr, bnbAmount, alignedMinAmount] });
        }
        const action: Action = { target: tokenManager as Address, value: amountMsgValue, data };

        // 4. Validate + execute
        const sim = await policyClient.validate(tokenId, action);
        if (!sim.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: sim.reason, ...policyRejectionHelp(sim.reason, token_id) }) }] };

        let result: { hash: Hex };
        try {
            result = await policyClient.execute(tokenId, action, true);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown execution revert";
            return {
                content: [{
                    type: "text" as const, text: JSON.stringify({
                        status: "error",
                        message: "four_buy execution reverted on-chain",
                        reason: message,
                        hint: "This is usually market-side failure (amount too small, temporary pool state change, or token-side constraint), not a PolicyGuard rejection.",
                    })
                }],
            };
        }
        return {
            content: [{
                type: "text" as const, text: JSON.stringify({
                    status: "success", hash: result.hash, protocol: "four.meme", action: "buy",
                    bnbSpent: amount,
                    estimatedTokens: (Number(estimatedAmount) / 1e18).toFixed(4),
                    fee: (Number(estimatedFee) / 1e18).toFixed(6),
                })
            }],
        };
    }
);

// 鈹€鈹€ Tool: four_sell 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
server.tool(
    "four_sell",
    "Sell tokens on Four.meme internal bonding curve for BNB. Requires approve + sell (handled automatically). Only works for tokens still in bonding curve phase.",
    {
        token_id: z.string().describe("Agent NFA Token ID"),
        token: z.string().describe("Token contract address on Four.meme (0x...)"),
        amount: z.string().describe("Amount of tokens to sell (human-readable, e.g. 1000)"),
        slippage: z.number().default(10).describe("Slippage tolerance percent (default: 10)"),
    },
    async ({ token_id, token, amount, slippage }) => {
        const { publicClient, policyClient } = createClients();
        const tokenId = BigInt(token_id);
        const expiryCheck = await checkAgentExpiry(tokenId);
        if (expiryCheck.blocked) return { content: expiryCheck.content! };

        const tokenAddr = token as Address;
        const sellAmount = parseAmount(amount, 18);
        const alignedAmount = (sellAmount / 1000000000n) * 1000000000n;

        // 1. Get token info
        const info = await publicClient.readContract({
            address: FOUR_MEME_HELPER_V3,
            abi: FOUR_MEME_HELPER_ABI,
            functionName: "getTokenInfo",
            args: [tokenAddr],
        });
        const [version, tokenManager, , , , , , , , , , liquidityAdded] = info;

        if (liquidityAdded) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ status: "error", message: "Token has already migrated to DEX. Use the 'swap' tool instead." }) }] };
        }

        // 2. Pre-calculate sell
        const trySellResult = await publicClient.readContract({
            address: FOUR_MEME_HELPER_V3,
            abi: FOUR_MEME_HELPER_ABI,
            functionName: "trySell",
            args: [tokenAddr, alignedAmount],
        });
        const [, , estimatedFunds, estimatedFee] = trySellResult;

        // 3. Build actions: approve + sell
        const actions: Action[] = [];

        // Approve TokenManager
        actions.push({
            target: tokenAddr,
            value: 0n,
            data: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [tokenManager as Address, alignedAmount] }),
        });

        // Sell
        let sellData: Hex;
        if (Number(version) === 1) {
            sellData = encodeFunctionData({ abi: FOUR_MEME_V1_ABI, functionName: "saleToken", args: [tokenAddr, alignedAmount] });
        } else {
            sellData = encodeFunctionData({ abi: FOUR_MEME_V2_ABI, functionName: "sellToken", args: [tokenAddr, alignedAmount] });
        }
        actions.push({ target: tokenManager as Address, value: 0n, data: sellData });

        // 4. Validate + execute batch
        for (const a of actions) {
            const sim = await policyClient.validate(tokenId, a);
            if (!sim.ok) return { content: [{ type: "text" as const, text: JSON.stringify({ status: "rejected", reason: sim.reason, ...policyRejectionHelp(sim.reason, token_id) }) }] };
        }

        const result = await policyClient.executeBatch(tokenId, actions, true);
        return {
            content: [{
                type: "text" as const, text: JSON.stringify({
                    status: "success", hash: result.hash, protocol: "four.meme", action: "sell",
                    tokensSold: amount,
                    estimatedBNB: (Number(estimatedFunds) / 1e18).toFixed(6),
                    fee: (Number(estimatedFee) / 1e18).toFixed(6),
                })
            }],
        };
    }
);

// 鈹€鈹€ Tool: generate_wallet 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
                    note: "SAVE THIS PRIVATE KEY SECURELY. This is the OPERATOR wallet 鈥?it can only trade within PolicyGuard limits. It CANNOT withdraw vault funds. Send ~$1 of BNB here for gas fees, then set RUNNER_PRIVATE_KEY.",
                    securityReminder: "Use a SEPARATE wallet as the owner to rent the agent and fund the vault. Use setup_guide tool for step-by-step instructions.",
                })
            }],
        };
    }
);

//                    Start Server
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((err) => {
    process.stderr.write(`SHLL MCP Server error: ${err.message}\n`);
    process.exit(1);
});


