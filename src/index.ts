#!/usr/bin/env node
import { Command } from "commander";
import { PolicyClient } from "shll-policy-sdk";
import type { Action } from "shll-policy-sdk";
import {
    createPublicClient,
    createWalletClient,
    decodeFunctionData,
    encodeFunctionData,
    http,
    parseEther,
    type Address,
    type Hex,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { bsc } from "viem/chains";

// === BSC Mainnet defaults ===
const DEFAULT_NFA = "0x71cE46099E4b2a2434111C009A7E9CFd69747c8E"; // V4.1 mainnet
const DEFAULT_GUARD = "0x25d17eA0e3Bcb8CA08a2BFE917E817AFc05dbBB3";
const DEFAULT_RPC = "https://bsc-dataseed1.binance.org";
const DEFAULT_LISTING_MANAGER = "0x1f9CE85bD0FF75acc3D92eB79f1Eb472f0865071";
const DEFAULT_LISTING_ID = "0x64083b44e38db02749e6e16bf84ce6c19146cc42a108e53324e11f250b15a0b7";
const SKILL_VERSION = "5.5.3";
const BINDINGS_UPDATED_AT = "2026-03-02";
const PANCAKE_V2_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const PANCAKE_V3_SMART_ROUTER = "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Venus Protocol (BSC Mainnet) 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕
const VENUS_VTOKENS: Record<string, Address> = {
    BNB: "0xA07c5b74C9B40447a954e1466938b865b6BBea36" as Address, // vBNB
    USDT: "0xfD5840Cd36d94D7229439859C0112a4185BC0255" as Address, // vUSDT
    USDC: "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8" as Address, // vUSDC
    BUSD: "0x95c78222B3D6e262426483D42CfA53685A67Ab9D" as Address, // vBUSD
};

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Token Symbol Registry (BSC Mainnet) 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑?
const TOKEN_REGISTRY: Record<string, { address: Address; decimals: number }> = {
    BNB: { address: "0x0000000000000000000000000000000000000000" as Address, decimals: 18 },
    WBNB: { address: WBNB as Address, decimals: 18 },
    USDT: { address: "0x55d398326f99059fF775485246999027B3197955" as Address, decimals: 18 },
    USDC: { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" as Address, decimals: 18 },
    BUSD: { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" as Address, decimals: 18 },
    CAKE: { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82" as Address, decimals: 18 },
    ETH: { address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8" as Address, decimals: 18 },
    BTCB: { address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c" as Address, decimals: 18 },
    DAI: { address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3" as Address, decimals: 18 },
};

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?ABI Fragments 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸?
const ERC20_ABI = [
    {
        type: "function" as const, name: "approve",
        inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable" as const,
    },
    {
        type: "function" as const, name: "allowance",
        inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view" as const,
    },
    {
        type: "function" as const, name: "decimals",
        inputs: [],
        outputs: [{ name: "", type: "uint8" }],
        stateMutability: "view" as const,
    },
] as const;

const SWAP_EXACT_TOKENS_ABI = [{
    type: "function" as const, name: "swapExactTokensForTokens",
    inputs: [
        { name: "amountIn", type: "uint256" },
        { name: "amountOutMin", type: "uint256" },
        { name: "path", type: "address[]" },
        { name: "to", type: "address" },
        { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable" as const,
}] as const;

const SWAP_EXACT_ETH_ABI = [{
    type: "function" as const, name: "swapExactETHForTokens",
    inputs: [
        { name: "amountOutMin", type: "uint256" },
        { name: "path", type: "address[]" },
        { name: "to", type: "address" },
        { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "payable" as const,
}] as const;

const SWAP_EXACT_TOKENS_FOR_ETH_ABI = [{
    type: "function" as const, name: "swapExactTokensForETH",
    inputs: [
        { name: "amountIn", type: "uint256" },
        { name: "amountOutMin", type: "uint256" },
        { name: "path", type: "address[]" },
        { name: "to", type: "address" },
        { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable" as const,
}] as const;

const SWAP_EXACT_ETH_FOR_TOKENS_FEE_ABI = [{
    type: "function" as const, name: "swapExactETHForTokensSupportingFeeOnTransferTokens",
    inputs: [
        { name: "amountOutMin", type: "uint256" },
        { name: "path", type: "address[]" },
        { name: "to", type: "address" },
        { name: "deadline", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable" as const,
}] as const;

const SWAP_EXACT_TOKENS_FOR_TOKENS_FEE_ABI = [{
    type: "function" as const, name: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
    inputs: [
        { name: "amountIn", type: "uint256" },
        { name: "amountOutMin", type: "uint256" },
        { name: "path", type: "address[]" },
        { name: "to", type: "address" },
        { name: "deadline", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable" as const,
}] as const;

const SWAP_EXACT_TOKENS_FOR_ETH_FEE_ABI = [{
    type: "function" as const, name: "swapExactTokensForETHSupportingFeeOnTransferTokens",
    inputs: [
        { name: "amountIn", type: "uint256" },
        { name: "amountOutMin", type: "uint256" },
        { name: "path", type: "address[]" },
        { name: "to", type: "address" },
        { name: "deadline", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable" as const,
}] as const;

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?ListingManagerV2 ABI (rental) 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕
const LISTING_MANAGER_ABI = [
    {
        type: "function" as const, name: "rentToMintWithParams",
        inputs: [
            { name: "listingId", type: "bytes32" },
            { name: "daysToRent", type: "uint32" },
            { name: "", type: "uint32" },
            { name: "", type: "uint16" },
            { name: "paramsPacked", type: "bytes" },
        ],
        outputs: [{ name: "instanceId", type: "uint256" }],
        stateMutability: "payable" as const,
    },
    {
        type: "function" as const, name: "listings",
        inputs: [{ name: "listingId", type: "bytes32" }],
        outputs: [
            { name: "nfa", type: "address" },
            { name: "tokenId", type: "uint256" },
            { name: "owner", type: "address" },
            { name: "pricePerDay", type: "uint96" },
            { name: "minDays", type: "uint32" },
            { name: "active", type: "bool" },
        ],
        stateMutability: "view" as const,
    },
    {
        type: "event" as const, name: "InstanceRented",
        inputs: [
            { name: "listingId", type: "bytes32", indexed: true },
            { name: "renter", type: "address", indexed: true },
            { name: "instanceTokenId", type: "uint256", indexed: true },
            { name: "instanceAccount", type: "address", indexed: false },
            { name: "expires", type: "uint64", indexed: false },
            { name: "totalPaid", type: "uint256", indexed: false },
        ],
    },
] as const;

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?AgentNFA ABI (operator + fund) 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜?
const AGENT_NFA_ABI = [
    {
        type: "function" as const, name: "setOperator",
        inputs: [
            { name: "tokenId", type: "uint256" },
            { name: "operator", type: "address" },
            { name: "opExpires", type: "uint64" },
        ],
        outputs: [],
        stateMutability: "nonpayable" as const,
    },
    {
        type: "function" as const, name: "fundAgent",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [],
        stateMutability: "payable" as const,
    },
    {
        type: "function" as const, name: "accountOf",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view" as const,
    },
] as const;

const GET_AMOUNTS_OUT_ABI = [{
    type: "function" as const, name: "getAmountsOut",
    inputs: [
        { name: "amountIn", type: "uint256" },
        { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "view" as const,
}] as const;

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?PancakeSwap V3 SmartRouter ABI 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜?
const V3_EXACT_INPUT_SINGLE_ABI = [{
    type: "function" as const, name: "exactInputSingle",
    inputs: [{
        name: "params", type: "tuple",
        components: [
            { name: "tokenIn", type: "address" },
            { name: "tokenOut", type: "address" },
            { name: "fee", type: "uint24" },
            { name: "recipient", type: "address" },
            { name: "amountIn", type: "uint256" },
            { name: "amountOutMinimum", type: "uint256" },
            { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
    }],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable" as const,
}] as const;

const V3_EXACT_INPUT_ABI = [{
    type: "function" as const, name: "exactInput",
    inputs: [{
        name: "params", type: "tuple",
        components: [
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
        name: "params", type: "tuple",
        components: [
            { name: "tokenIn", type: "address" },
            { name: "tokenOut", type: "address" },
            { name: "amountIn", type: "uint256" },
            { name: "fee", type: "uint24" },
            { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
    }],
    outputs: [
        { name: "amountOut", type: "uint256" },
        { name: "sqrtPriceX96After", type: "uint160" },
        { name: "initializedTicksCrossed", type: "uint32" },
        { name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable" as const,
}] as const;

const V3_QUOTER = "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997" as Address;

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Venus Protocol ABI 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜?
// Write operations (for encodeFunctionData)
const VTOKEN_ABI = [
    // mint(uint256) 闂?supply ERC20 tokens to Venus
    {
        type: "function" as const, name: "mint",
        inputs: [{ name: "mintAmount", type: "uint256" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "nonpayable" as const,
    },
    // redeemUnderlying(uint256) 闂?redeem by underlying amount
    {
        type: "function" as const, name: "redeemUnderlying",
        inputs: [{ name: "redeemAmount", type: "uint256" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "nonpayable" as const,
    },
] as const;

// Read operations (for readContract 闂?must be view/pure)
const VTOKEN_READ_ABI = [
    {
        type: "function" as const, name: "balanceOfUnderlying",
        inputs: [{ name: "owner", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view" as const,
    },
    {
        type: "function" as const, name: "supplyRatePerBlock",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view" as const,
    },
    {
        type: "function" as const, name: "underlying",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view" as const,
    },
] as const;

// vBNB uses payable mint() with no args
const VBNB_MINT_ABI = [{
    type: "function" as const, name: "mint",
    inputs: [],
    outputs: [],
    stateMutability: "payable" as const,
}] as const;

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Helpers 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑?
function toHex(s: string): Hex {
    return (s.startsWith("0x") ? s : `0x${s}`) as Hex;
}

function output(data: Record<string, unknown>) {
    console.log(JSON.stringify(data));
}

function outputError(message: string, nextStep?: string, extra: Record<string, unknown> = {}) {
    output({
        status: "error",
        message,
        ...(nextStep ? { next_step: nextStep } : {}),
        ...extra,
    });
}

function agentConsoleUrl(tokenId: string | bigint): string {
    return `https://shll.run/agent/${DEFAULT_NFA}/${tokenId.toString()}/console/safety`;
}

function createPolicyClient(opts: Record<string, string>): PolicyClient {
    const pk = process.env.RUNNER_PRIVATE_KEY;
    return new PolicyClient({
        operatorPrivateKey: pk ? toHex(pk) : undefined,
        rpcUrl: opts.rpc || DEFAULT_RPC,
        // Security hardening: never allow runtime override for core contracts.
        policyGuardAddress: toHex(DEFAULT_GUARD) as Address,
        agentNfaAddress: toHex(DEFAULT_NFA) as Address,
    });
}

function resolveToken(symbolOrAddress: string): { address: Address; decimals: number } {
    const upper = symbolOrAddress.toUpperCase();
    if (TOKEN_REGISTRY[upper]) return TOKEN_REGISTRY[upper];
    // Assume it's a raw address
    if (symbolOrAddress.startsWith("0x")) {
        return { address: symbolOrAddress as Address, decimals: 18 }; // default 18 decimals
    }
    throw new Error(`Unknown token: ${symbolOrAddress}. Use a known symbol (${Object.keys(TOKEN_REGISTRY).join(", ")}) or a 0x address.`);
}

function parseAmount(amountStr: string, decimals: number): bigint {
    // Support both "0.5" (human-readable) and "500000000000000000" (wei)
    if (amountStr.includes(".")) {
        const [whole, frac = ""] = amountStr.split(".");
        const paddedFrac = frac.padEnd(decimals, "0").slice(0, decimals);
        return BigInt(whole || "0") * (10n ** BigInt(decimals)) + BigInt(paddedFrac);
    }
    // If it looks like wei already (very large number), use as-is
    if (amountStr.length > 10) return BigInt(amountStr);
    // Otherwise treat as whole units
    return BigInt(amountStr) * (10n ** BigInt(decimals));
}

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Shared Options 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜?
function addSharedOptions(cmd: Command): Command {
    return cmd
        .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
        .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC);
}

function createClient(options: Record<string, string>): PolicyClient {
    const privateKey = toHex(process.env.RUNNER_PRIVATE_KEY || "");
    if (!process.env.RUNNER_PRIVATE_KEY) {
        outputError(
            "RUNNER_PRIVATE_KEY environment variable is missing",
            "Run 'shll-run generate-wallet', fund it with a small BNB amount, export RUNNER_PRIVATE_KEY, then retry.",
        );
        process.exit(1);
    }
    return new PolicyClient({
        rpcUrl: options.rpc || DEFAULT_RPC,
        // Security hardening: lock to audited mainnet addresses.
        agentNfaAddress: toHex(DEFAULT_NFA) as Address,
        policyGuardAddress: toHex(DEFAULT_GUARD) as Address,
        operatorPrivateKey: privateKey,
        chainId: 56,
    });
}
// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Program 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑?

// Pre-check: prevents write operations on expired/unauthorized agents with clear error
const AGENT_NFA_ACCESS_ABI = [
    { name: "operatorExpiresOf", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
    { name: "userExpires", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
    { name: "operatorOf", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
    { name: "userOf", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
    { name: "ownerOf", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
] as const;

async function checkAccess(opts: Record<string, string>, tokenId: bigint) {
    const rpcUrl = opts.rpc || DEFAULT_RPC;
    const nfa = DEFAULT_NFA as Address;
    const pk = toHex(process.env.RUNNER_PRIVATE_KEY || "");
    const account = privateKeyToAccount(pk);
    const pc = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
    const [operatorExpires, userExpires, operator, renter, owner] = await Promise.all([
        pc.readContract({ address: nfa, abi: AGENT_NFA_ACCESS_ABI, functionName: "operatorExpiresOf", args: [tokenId] }) as Promise<bigint>,
        pc.readContract({ address: nfa, abi: AGENT_NFA_ACCESS_ABI, functionName: "userExpires", args: [tokenId] }) as Promise<bigint>,
        pc.readContract({ address: nfa, abi: AGENT_NFA_ACCESS_ABI, functionName: "operatorOf", args: [tokenId] }) as Promise<Address>,
        pc.readContract({ address: nfa, abi: AGENT_NFA_ACCESS_ABI, functionName: "userOf", args: [tokenId] }) as Promise<Address>,
        pc.readContract({ address: nfa, abi: AGENT_NFA_ACCESS_ABI, functionName: "ownerOf", args: [tokenId] }) as Promise<Address>,
    ]);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now > userExpires) {
        outputError(
            `Agent token-id ${tokenId} rental has EXPIRED (expired at ${new Date(Number(userExpires) * 1000).toISOString()}).`,
            "Renew the subscription at https://shll.run/me, then retry.",
        );
        process.exit(1);
    }
    if (now > operatorExpires) {
        outputError(
            `Agent token-id ${tokenId} operator authorization has EXPIRED (expired at ${new Date(Number(operatorExpires) * 1000).toISOString()}).`,
            "Run 'shll-run setup-guide --days 7' and complete operator authorization in browser, then retry.",
        );
        process.exit(1);
    }
    const runnerAddr = account.address.toLowerCase();
    const isOperator = operator.toLowerCase() === runnerAddr;
    const isRenter = renter.toLowerCase() === runnerAddr;
    const isOwner = owner.toLowerCase() === runnerAddr;
    if (!isOperator && !isRenter && !isOwner) {
        output({
            status: "error",
            message: `RUNNER_PRIVATE_KEY wallet (${account.address}) is NOT authorized for token-id ${tokenId}. On-chain operator is ${operator}.`,
            next_step: `Authorize ${account.address} as operator via ${agentConsoleUrl(tokenId)} or use the correct RUNNER_PRIVATE_KEY.`,
            yourWallet: account.address,
            onChainOperator: operator,
            onChainRenter: renter,
            onChainOwner: owner,
            howToFix: [
                `1. Use 'setup_guide' command to generate an OperatorPermit for this wallet`,
                `2. Renter (${renter}) can call setOperator(${tokenId}, ${account.address}, <expiry>) on AgentNFA`,
                `3. Go to ${agentConsoleUrl(tokenId)} to set operator`,
                `4. Use the correct RUNNER_PRIVATE_KEY for operator ${operator}`,
            ],
        });
        process.exit(1);
    }
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

    if (tryDecodeCalldata(ERC20_ABI, data)?.functionName === "approve") return { ok: true, mode: "no-recipient" };
    if (tryDecodeCalldata(WBNB_ABI, data)) return { ok: true, mode: "no-recipient" };
    if (tryDecodeCalldata(VTOKEN_ABI, data)) return { ok: true, mode: "no-recipient" };
    if (tryDecodeCalldata(VBNB_MINT_ABI, data)) return { ok: true, mode: "no-recipient" };

    return {
        ok: false,
        reason: "Unable to decode recipient from calldata. Blocked by default to prevent recipient redirection risk.",
    };
}

const program = new Command();
program.name("shll-onchain-runner").description("Execute DeFi actions securely via SHLL AgentNFA");

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: swap 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕
const swapCmd = new Command("swap")
    .description("Swap tokens on PancakeSwap (auto-routes V2/V3)")
    .requiredOption("-f, --from <token>", "Input token (symbol or 0x address, e.g. USDC, BNB)")
    .requiredOption("-t, --to <token>", "Output token (symbol or 0x address)")
    .requiredOption("-a, --amount <number>", "Amount to swap (human-readable, e.g. 0.5)")
    .option("-s, --slippage <percent>", "Slippage tolerance in percent (default: 5)", "5")
    .option("--dex <mode>", "DEX routing: auto, v2, v3 (default: auto)", "auto")
    .option("--fee <tier>", "V3 fee tier in bps (default: 2500 = 0.25%)", "2500")
    .option("--router <address>", "DEX router address (override)");
addSharedOptions(swapCmd);

swapCmd.action(async (opts) => {
    try {
        const client = createClient(opts);
        const tokenId = BigInt(opts.tokenId);
        await checkAccess(opts, tokenId);
        const rpcUrl = opts.rpc || DEFAULT_RPC;

        const fromToken = resolveToken(opts.from);
        const toToken = resolveToken(opts.to);
        const isNativeIn = fromToken.address === "0x0000000000000000000000000000000000000000";
        const amountIn = parseAmount(opts.amount, fromToken.decimals);
        const slippage = Number(opts.slippage);
        const dexMode = opts.dex || "auto";
        const feeTier = Number(opts.fee || "2500");
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

        // Get vault address for the agent
        const vault = await client.getVault(tokenId);
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });

        // Token addresses for routing (convert BNB 闂?WBNB for path)
        const tokenInAddr = isNativeIn ? (WBNB as Address) : fromToken.address;
        const tokenOutAddr = toToken.address === "0x0000000000000000000000000000000000000000"
            ? (WBNB as Address) : toToken.address;

        // 闂佸啿鍘滈崑鎾绘煃閸忓浜?Try V3 quote 闂佸啿鍘滈崑鎾绘煃閸忓浜?
        let v3Quote = 0n;
        let v3Available = false;
        if (dexMode === "auto" || dexMode === "v3") {
            try {
                const v3Result = await publicClient.simulateContract({
                    address: V3_QUOTER,
                    abi: V3_QUOTE_ABI,
                    functionName: "quoteExactInputSingle",
                    args: [{
                        tokenIn: tokenInAddr,
                        tokenOut: tokenOutAddr,
                        amountIn,
                        fee: feeTier,
                        sqrtPriceLimitX96: 0n,
                    }],
                });
                v3Quote = v3Result.result[0];
                v3Available = v3Quote > 0n;
            } catch {
                // V3 pool may not exist for this pair/fee
            }
        }

        // 闂佸啿鍘滈崑鎾绘煃閸忓浜?Try V2 quote 闂佸啿鍘滈崑鎾绘煃閸忓浜?
        let v2Quote = 0n;
        let v2Available = false;
        const v2Router = (opts.router || PANCAKE_V2_ROUTER) as Address;
        if (dexMode === "auto" || dexMode === "v2") {
            try {
                let path: Address[];
                if (tokenInAddr.toLowerCase() !== WBNB.toLowerCase() && tokenOutAddr.toLowerCase() !== WBNB.toLowerCase()) {
                    path = [tokenInAddr, WBNB as Address, tokenOutAddr];
                } else {
                    path = [tokenInAddr, tokenOutAddr];
                }
                const amounts = await publicClient.readContract({
                    address: v2Router,
                    abi: GET_AMOUNTS_OUT_ABI,
                    functionName: "getAmountsOut",
                    args: [amountIn, path],
                });
                v2Quote = amounts[amounts.length - 1];
                v2Available = v2Quote > 0n;
            } catch {
                // V2 pair may not exist
            }
        }

        // 闂佸啿鍘滈崑鎾绘煃閸忓浜?Pick best route 闂佸啿鍘滈崑鎾绘煃閸忓浜?
        let useV3 = false;
        if (dexMode === "v3") {
            if (!v3Available) {
                output({ status: "error", message: "V3 pool not available for this pair/fee tier" });
                process.exit(1);
            }
            useV3 = true;
        } else if (dexMode === "v2") {
            if (!v2Available) {
                output({ status: "error", message: "V2 pair not available for this token pair" });
                process.exit(1);
            }
            useV3 = false;
        } else {
            // auto: pick best quote
            if (!v3Available && !v2Available) {
                output({ status: "error", message: "No liquidity found on V2 or V3 for this pair" });
                process.exit(1);
            }
            useV3 = v3Available && (!v2Available || v3Quote >= v2Quote);
        }

        const selectedQuote = useV3 ? v3Quote : v2Quote;
        const minOut = (selectedQuote * BigInt(100 - slippage)) / 100n;

        output({
            status: "info",
            message: `Route: ${useV3 ? "V3" : "V2"} | Quote: ${amountIn.toString()} ${opts.from} 闂?~${selectedQuote.toString()} ${opts.to}` +
                (v3Available && v2Available ? ` (V3: ${v3Quote.toString()}, V2: ${v2Quote.toString()})` : "") +
                ` | minOut: ${minOut.toString()} (${slippage}% slippage)`,
        });

        // 闂佸啿鍘滈崑鎾绘煃閸忓浜?Build actions 闂佸啿鍘滈崑鎾绘煃閸忓浜?
        const actions: Action[] = [];

        // Auto-approve if ERC20 input
        if (!isNativeIn) {
            const router = useV3 ? (PANCAKE_V3_SMART_ROUTER as Address) : v2Router;
            try {
                const currentAllowance = await publicClient.readContract({
                    address: fromToken.address,
                    abi: ERC20_ABI,
                    functionName: "allowance",
                    args: [vault, router],
                });
                if (currentAllowance < amountIn) {
                    const approveData = encodeFunctionData({
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [router, amountIn],
                    });
                    actions.push({ target: fromToken.address, value: 0n, data: approveData });
                }
            } catch {
                const approveData = encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: "approve",
                    args: [useV3 ? (PANCAKE_V3_SMART_ROUTER as Address) : v2Router, amountIn],
                });
                actions.push({ target: fromToken.address, value: 0n, data: approveData });
            }
        }

        // Swap calldata
        if (useV3) {
            // V3: exactInputSingle
            const data = encodeFunctionData({
                abi: V3_EXACT_INPUT_SINGLE_ABI,
                functionName: "exactInputSingle",
                args: [{
                    tokenIn: tokenInAddr,
                    tokenOut: tokenOutAddr,
                    fee: feeTier,
                    recipient: vault,
                    amountIn,
                    amountOutMinimum: minOut,
                    sqrtPriceLimitX96: 0n,
                }],
            });
            actions.push({
                target: PANCAKE_V3_SMART_ROUTER as Address,
                value: isNativeIn ? amountIn : 0n,
                data,
            });
        } else {
            // V2: existing logic
            let path: Address[];
            if (tokenInAddr.toLowerCase() !== WBNB.toLowerCase() && tokenOutAddr.toLowerCase() !== WBNB.toLowerCase()) {
                path = [tokenInAddr, WBNB as Address, tokenOutAddr];
            } else {
                path = [tokenInAddr, tokenOutAddr];
            }

            if (isNativeIn) {
                const data = encodeFunctionData({
                    abi: SWAP_EXACT_ETH_ABI,
                    functionName: "swapExactETHForTokens",
                    args: [minOut, path, vault, deadline],
                });
                actions.push({ target: v2Router, value: amountIn, data });
            } else {
                const data = encodeFunctionData({
                    abi: SWAP_EXACT_TOKENS_ABI,
                    functionName: "swapExactTokensForTokens",
                    args: [amountIn, minOut, path, vault, deadline],
                });
                actions.push({ target: v2Router, value: 0n, data });
            }
        }

        // Validate all actions
        for (const action of actions) {
            const simResult = await client.validate(tokenId, action);
            if (!simResult.ok) {
                output({ status: "rejected", reason: simResult.reason });
                process.exit(0);
            }
        }

        // Execute
        let hash: Hex;
        if (actions.length === 1) {
            const result = await client.execute(tokenId, actions[0], true);
            hash = result.hash;
        } else {
            const result = await client.executeBatch(tokenId, actions, true);
            hash = result.hash;
        }

        output({ status: "success", hash, dex: useV3 ? "v3" : "v2" });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: raw (original low-level mode) 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸?
const rawCmd = new Command("raw")
    .description("Execute raw calldata (advanced, high risk; prefer built-in commands)")
    .requiredOption("-t, --target <address>", "Target contract address")
    .requiredOption("-d, --data <hex>", "Calldata hex")
    .option("-v, --value <number>", "Native BNB value in wei", "0")
    .option("-b, --batch", "Batch mode: read actions from --actions JSON array")
    .option("-a, --actions <json>", "JSON array of actions for batch mode")
    .option("--i-understand-the-risk", "Acknowledge that raw calldata can bypass intent-level safeguards");
addSharedOptions(rawCmd);

rawCmd.action(async (opts) => {
    try {
        if (!opts.iUnderstandTheRisk) {
            outputError(
                "Raw mode is dangerous and can execute arbitrary calldata.",
                "Re-run with --i-understand-the-risk only if you fully trust the calldata source.",
            );
            process.exit(1);
        }
        const client = createClient(opts);
        const tokenId = BigInt(opts.tokenId);
        await checkAccess(opts, tokenId);

        let actions: Action[];

        if (opts.batch) {
            if (!opts.actions) {
                outputError("--actions JSON is required in batch mode", "Provide --actions '[{\"target\":\"0x...\",\"value\":\"0\",\"data\":\"0x...\"}]'.");
                process.exit(1);
            }
            const parsed = JSON.parse(opts.actions) as Array<{ target: string; value: string; data: string }>;
            actions = parsed.map((a) => ({
                target: toHex(a.target) as Address,
                value: BigInt(a.value || "0"),
                data: toHex(a.data),
            }));
        } else {
            actions = [{
                target: toHex(opts.target) as Address,
                value: BigInt(opts.value),
                data: toHex(opts.data),
            }];
        }

        const vault = await client.getVault(tokenId);
        for (let i = 0; i < actions.length; i++) {
            const recipientCheck = checkActionRecipientSafety(actions[i], vault);
            if (!recipientCheck.ok) {
                output({
                    status: "error",
                    failedActionIndex: i,
                    reason: recipientCheck.reason,
                    vault,
                    message: "Blocked before on-chain execution to prevent recipient redirection risk.",
                });
                process.exit(1);
            }
        }

        for (const action of actions) {
            const simResult = await client.validate(tokenId, action);
            if (!simResult.ok) {
                output({ status: "rejected", reason: simResult.reason });
                process.exit(0);
            }
        }

        let hash: Hex;
        if (actions.length === 1) {
            const result = await client.execute(tokenId, actions[0], true);
            hash = result.hash;
        } else {
            const result = await client.executeBatch(tokenId, actions, true);
            hash = result.hash;
        }

        output({ status: "success", hash });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: tokens 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜?
const tokensCmd = new Command("tokens")
    .description("List all known token symbols and their BSC addresses");
tokensCmd.action(() => {
    const tokens = Object.entries(TOKEN_REGISTRY).map(([symbol, info]) => ({
        symbol,
        address: info.address,
        decimals: info.decimals,
    }));
    output({ status: "success", tokens });
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: init (DEPRECATED 闂?uses same key for owner+operator) 闂佸啿鍘滈崑鎾绘煃閸忓浜?
const initCmd = new Command("init")
    .description("[DISABLED] Unsafe legacy one-key setup has been removed. Use setup-guide instead.");

initCmd.action(() => {
    outputError(
        "The 'init' command is disabled for security.",
        "Use 'shll-run setup-guide --days 7' to complete the safe dual-wallet setup.",
    );
    process.exit(1);
});
const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex";

interface DexScreenerPair {
    baseToken: { address: string; symbol: string; name: string };
    priceUsd: string;
    volume: { h24: number };
    liquidity: { usd: number };
    priceChange: { h24: number };
    fdv: number;
}

async function fetchTokenPrice(tokenAddress: string): Promise<DexScreenerPair | null> {
    try {
        const resp = await fetch(`${DEXSCREENER_API}/tokens/${tokenAddress}`, {
            signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) return null;
        const data = await resp.json() as { pairs?: DexScreenerPair[] };
        if (!data.pairs || data.pairs.length === 0) return null;
        // Return the pair with the highest liquidity
        return data.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    } catch {
        return null;
    }
}

async function searchToken(query: string): Promise<DexScreenerPair[]> {
    try {
        const encoded = encodeURIComponent(query);
        const resp = await fetch(`${DEXSCREENER_API}/search?q=${encoded}`, {
            signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) return [];
        const data = await resp.json() as { pairs?: DexScreenerPair[] };
        // Filter to BSC only
        return (data.pairs || [])
            .filter((p: any) => p.chainId === "bsc")
            .slice(0, 10);
    } catch {
        return [];
    }
}

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?ERC20 balanceOf ABI 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑?
const ERC20_BALANCE_ABI = [{
    type: "function" as const, name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view" as const,
}] as const;

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: portfolio 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸?
const portfolioCmd = new Command("portfolio")
    .description("Query vault BNB balance, ERC20 holdings, and USD values")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC);

portfolioCmd.action(async (opts) => {
    try {
        const rpcUrl = opts.rpc || DEFAULT_RPC;
        const nfaAddr = toHex(DEFAULT_NFA) as Address;
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
        const tokenId = BigInt(opts.tokenId);

        // Get vault address
        const vault = await publicClient.readContract({
            address: nfaAddr,
            abi: AGENT_NFA_ABI,
            functionName: "accountOf",
            args: [tokenId],
        }) as Address;

        // Query BNB balance
        const bnbBalance = await publicClient.getBalance({ address: vault });

        // Query all known ERC20 balances in parallel
        const erc20Entries = Object.entries(TOKEN_REGISTRY).filter(
            ([sym]) => sym !== "BNB"
        );
        const balancePromises = erc20Entries.map(([, info]) =>
            publicClient.readContract({
                address: info.address,
                abi: ERC20_BALANCE_ABI,
                functionName: "balanceOf",
                args: [vault],
            }).catch(() => 0n)
        );
        const balances = await Promise.all(balancePromises);

        // Build holdings list (only non-zero)
        const holdings: Array<{
            symbol: string;
            address: string;
            balance: string;
            humanBalance: string;
            usdValue?: string;
        }> = [];

        // BNB
        if (bnbBalance > 0n) {
            const bnbPair = await fetchTokenPrice(WBNB);
            const humanBnb = Number(bnbBalance) / 1e18;
            holdings.push({
                symbol: "BNB",
                address: "native",
                balance: bnbBalance.toString(),
                humanBalance: humanBnb.toFixed(6),
                usdValue: bnbPair ? (humanBnb * Number(bnbPair.priceUsd)).toFixed(2) : undefined,
            });
        }

        // ERC20s
        for (let i = 0; i < erc20Entries.length; i++) {
            const [symbol, info] = erc20Entries[i];
            const bal = balances[i] as bigint;
            if (bal > 0n) {
                const human = Number(bal) / Math.pow(10, info.decimals);
                let usdValue: string | undefined;
                if (symbol !== "WBNB") { // avoid duplicate WBNB lookup
                    const pair = await fetchTokenPrice(info.address);
                    if (pair) usdValue = (human * Number(pair.priceUsd)).toFixed(2);
                }
                holdings.push({
                    symbol,
                    address: info.address,
                    balance: bal.toString(),
                    humanBalance: human.toFixed(6),
                    usdValue,
                });
            }
        }

        output({
            status: "success",
            tokenId: tokenId.toString(),
            vault,
            holdings,
            totalPositions: holdings.length,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: price 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸?
const priceCmd = new Command("price")
    .description("Get real-time token price, volume, and liquidity from DexScreener")
    .requiredOption("-t, --token <symbolOrAddress>", "Token symbol (e.g. CAKE) or 0x address");

priceCmd.action(async (opts) => {
    try {
        const input = opts.token as string;
        // Resolve symbol to address if needed
        let address: string;
        const upper = input.toUpperCase();
        if (TOKEN_REGISTRY[upper]) {
            const addr = TOKEN_REGISTRY[upper].address;
            // For BNB, use WBNB address for price lookup
            address = addr === "0x0000000000000000000000000000000000000000" ? WBNB : addr;
        } else if (input.startsWith("0x")) {
            address = input;
        } else {
            // Try DexScreener search
            const results = await searchToken(input);
            if (results.length > 0) {
                address = results[0].baseToken.address;
            } else {
                output({ status: "error", message: `Token not found: ${input}` });
                process.exit(1);
                return; // unreachable, for TS
            }
        }

        const pair = await fetchTokenPrice(address);
        if (!pair) {
            output({ status: "error", message: `No price data found for ${address}` });
            process.exit(1);
        }

        output({
            status: "success",
            token: {
                symbol: pair.baseToken.symbol,
                name: pair.baseToken.name,
                address: pair.baseToken.address,
            },
            priceUsd: pair.priceUsd,
            volume24h: pair.volume?.h24 || 0,
            liquidity: pair.liquidity?.usd || 0,
            priceChange24h: pair.priceChange?.h24 || 0,
            fdv: pair.fdv || 0,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: search 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜?
const searchCmd = new Command("search")
    .description("Search for a token by name or symbol on BSC via DexScreener")
    .requiredOption("-q, --query <text>", "Token name or symbol to search");

searchCmd.action(async (opts) => {
    try {
        const results = await searchToken(opts.query);
        if (results.length === 0) {
            output({ status: "success", results: [], message: "No BSC tokens found" });
            return;
        }

        const formatted = results.map((p) => ({
            symbol: p.baseToken.symbol,
            name: p.baseToken.name,
            address: p.baseToken.address,
            priceUsd: p.priceUsd,
            liquidity: p.liquidity?.usd || 0,
            volume24h: p.volume?.h24 || 0,
        }));

        output({ status: "success", results: formatted });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?WBNB ABI fragments (wrap/unwrap) 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕
const WBNB_ABI = [
    {
        type: "function" as const, name: "deposit",
        inputs: [],
        outputs: [],
        stateMutability: "payable" as const,
    },
    {
        type: "function" as const, name: "withdraw",
        inputs: [{ name: "wad", type: "uint256" }],
        outputs: [],
        stateMutability: "nonpayable" as const,
    },
] as const;

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?ERC20 transfer ABI 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜?
const ERC20_TRANSFER_ABI = [{
    type: "function" as const, name: "transfer",
    inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable" as const,
}] as const;

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: wrap 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕
const wrapCmd = new Command("wrap")
    .description("Wrap BNB 闂?WBNB (from vault balance)")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .requiredOption("-a, --amount <bnb>", "BNB amount to wrap (human-readable)")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC);

wrapCmd.action(async (opts) => {
    try {
        if (!process.env.RUNNER_PRIVATE_KEY) {
            output({ status: "error", message: "RUNNER_PRIVATE_KEY environment variable is missing" });
            process.exit(1);
        }
        await checkAccess(opts, BigInt(opts.tokenId));
        const client = new PolicyClient({
            operatorPrivateKey: toHex(process.env.RUNNER_PRIVATE_KEY),
            rpcUrl: opts.rpc || DEFAULT_RPC,
            policyGuardAddress: toHex(DEFAULT_GUARD) as Address,
            agentNfaAddress: toHex(DEFAULT_NFA) as Address,
        });
        const tokenId = BigInt(opts.tokenId);
        const amount = parseEther(opts.amount);
        const wbnbAddr = toHex(process.env.WBNB_ADDRESS || WBNB) as Address;

        // WBNB.deposit() 闂?sends BNB from vault to WBNB contract, receives WBNB back
        const calldata = encodeFunctionData({
            abi: WBNB_ABI,
            functionName: "deposit",
        });

        output({ status: "info", message: `Wrapping ${opts.amount} BNB 闂?WBNB...` });
        const action: Action = { target: wbnbAddr, value: amount, data: calldata };

        const validation = await client.validate(tokenId, action);
        if (!validation.ok) {
            output({ status: "rejected", reason: validation.reason });
            process.exit(1);
        }

        const result = await client.execute(tokenId, action, true);
        output({ status: "success", tx: result.hash, message: `Wrapped ${opts.amount} BNB 闂?WBNB` });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: unwrap 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜?
const unwrapCmd = new Command("unwrap")
    .description("Unwrap WBNB 闂?BNB (to vault)")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .requiredOption("-a, --amount <bnb>", "WBNB amount to unwrap (human-readable)")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC);

unwrapCmd.action(async (opts) => {
    try {
        if (!process.env.RUNNER_PRIVATE_KEY) {
            output({ status: "error", message: "RUNNER_PRIVATE_KEY environment variable is missing" });
            process.exit(1);
        }
        await checkAccess(opts, BigInt(opts.tokenId));
        const client = new PolicyClient({
            operatorPrivateKey: toHex(process.env.RUNNER_PRIVATE_KEY),
            rpcUrl: opts.rpc || DEFAULT_RPC,
            policyGuardAddress: toHex(DEFAULT_GUARD) as Address,
            agentNfaAddress: toHex(DEFAULT_NFA) as Address,
        });
        const tokenId = BigInt(opts.tokenId);
        const amount = parseEther(opts.amount);
        const wbnbAddr = toHex(process.env.WBNB_ADDRESS || WBNB) as Address;

        // WBNB.withdraw(uint256) 闂?burns WBNB, vault receives BNB
        const calldata = encodeFunctionData({
            abi: WBNB_ABI,
            functionName: "withdraw",
            args: [amount],
        });

        output({ status: "info", message: `Unwrapping ${opts.amount} WBNB 闂?BNB...` });
        const action: Action = { target: wbnbAddr, value: 0n, data: calldata };

        const validation = await client.validate(tokenId, action);
        if (!validation.ok) {
            output({ status: "rejected", reason: validation.reason });
            process.exit(1);
        }

        const result = await client.execute(tokenId, action, true);
        output({ status: "success", tx: result.hash, message: `Unwrapped ${opts.amount} WBNB 闂?BNB` });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: transfer 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕
const transferCmd = new Command("transfer")
    .description("Transfer ERC20 tokens or BNB from vault to a recipient")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .requiredOption("-t, --token <symbol>", "Token symbol (e.g. USDC) or 0x address, use BNB for native")
    .requiredOption("-a, --amount <value>", "Amount to transfer (human-readable)")
    .requiredOption("--to <address>", "Recipient address")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC);

transferCmd.action(async (opts) => {
    try {
        if (!process.env.RUNNER_PRIVATE_KEY) {
            output({ status: "error", message: "RUNNER_PRIVATE_KEY environment variable is missing" });
            process.exit(1);
        }
        await checkAccess(opts, BigInt(opts.tokenId));
        const client = new PolicyClient({
            operatorPrivateKey: toHex(process.env.RUNNER_PRIVATE_KEY),
            rpcUrl: opts.rpc || DEFAULT_RPC,
            policyGuardAddress: toHex(DEFAULT_GUARD) as Address,
            agentNfaAddress: toHex(DEFAULT_NFA) as Address,
        });
        const tokenId = BigInt(opts.tokenId);
        const recipient = toHex(opts.to) as Address;
        const tokenInfo = resolveToken(opts.token);
        const amount = parseEther(opts.amount); // works for 18-decimal tokens

        let action: Action;
        const isBNB = tokenInfo.address === "0x0000000000000000000000000000000000000000";

        if (isBNB) {
            // Native BNB transfer 闂?empty calldata, value = amount
            action = { target: recipient, value: amount, data: "0x" as Hex };
        } else {
            // ERC20 transfer(address, uint256)
            const calldata = encodeFunctionData({
                abi: ERC20_TRANSFER_ABI,
                functionName: "transfer",
                args: [recipient, amount],
            });
            action = { target: tokenInfo.address, value: 0n, data: calldata };
        }

        output({ status: "info", message: `Transferring ${opts.amount} ${opts.token.toUpperCase()} to ${recipient}...` });

        const validation = await client.validate(tokenId, action);
        if (!validation.ok) {
            output({ status: "rejected", reason: validation.reason, note: "ReceiverGuardPolicy may restrict outbound transfers" });
            process.exit(1);
        }

        const result = await client.execute(tokenId, action, true);
        output({ status: "success", tx: result.hash, message: `Transferred ${opts.amount} ${opts.token.toUpperCase()} to ${recipient}` });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Policy Configuration ABI fragments 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜?
const SPENDING_LIMIT_ABI = [
    {
        type: "function" as const, name: "setLimits",
        inputs: [
            { name: "instanceId", type: "uint256" },
            { name: "maxPerTx", type: "uint256" },
            { name: "maxPerDay", type: "uint256" },
            { name: "maxSlippageBps", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable" as const,
    },
    {
        type: "function" as const, name: "instanceLimits",
        inputs: [{ name: "instanceId", type: "uint256" }],
        outputs: [
            { name: "maxPerTx", type: "uint256" },
            { name: "maxPerDay", type: "uint256" },
            { name: "maxSlippageBps", type: "uint256" },
        ],
        stateMutability: "view" as const,
    },
] as const;

const COOLDOWN_ABI = [
    {
        type: "function" as const, name: "setCooldown",
        inputs: [
            { name: "instanceId", type: "uint256" },
            { name: "seconds_", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable" as const,
    },
    {
        type: "function" as const, name: "cooldownSeconds",
        inputs: [{ name: "instanceId", type: "uint256" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view" as const,
    },
] as const;

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: policies 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕
const policiesCmd = new Command("policies")
    .description("View all active policies and current settings for an Agent")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC);

policiesCmd.action(async (opts) => {
    try {
        const client = createPolicyClient(opts);
        const tokenId = BigInt(opts.tokenId);
        const rpcUrl = opts.rpc || DEFAULT_RPC;
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });

        const policies = await client.getPolicies(tokenId);

        // Enrich with current config for configurable policies
        const enriched = [];
        const summaryParts: string[] = [];
        for (const p of policies) {
            const entry: Record<string, unknown> = {
                name: p.policyTypeName,
                address: p.address,
                renterConfigurable: p.renterConfigurable,
            };

            if (p.policyTypeName === "spending_limit") {
                try {
                    const limits = await publicClient.readContract({
                        address: p.address,
                        abi: SPENDING_LIMIT_ABI,
                        functionName: "instanceLimits",
                        args: [tokenId],
                    });
                    const [maxPerTx, maxPerDay, maxSlippageBps] = limits;
                    const txBnb = (Number(maxPerTx) / 1e18).toFixed(4);
                    const dayBnb = (Number(maxPerDay) / 1e18).toFixed(4);
                    entry.currentConfig = {
                        maxPerTx: maxPerTx.toString(),
                        maxPerTxBnb: txBnb,
                        maxPerDay: maxPerDay.toString(),
                        maxPerDayBnb: dayBnb,
                        maxSlippageBps: maxSlippageBps.toString(),
                    };
                    summaryParts.push(`Max ${txBnb} BNB/tx, ${dayBnb} BNB/day, slippage ${maxSlippageBps}bps`);
                } catch { /* policy read failed */ }
            }

            if (p.policyTypeName === "cooldown") {
                try {
                    const cd = await publicClient.readContract({
                        address: p.address,
                        abi: COOLDOWN_ABI,
                        functionName: "cooldownSeconds",
                        args: [tokenId],
                    });
                    const secs = Number(cd);
                    entry.currentConfig = { cooldownSeconds: secs.toString() };
                    summaryParts.push(`Cooldown ${secs}s between transactions`);
                } catch { /* policy read failed */ }
            }

            if (p.policyTypeName === "receiver_guard") {
                summaryParts.push("Outbound transfers restricted (ReceiverGuard)");
            }
            if (p.policyTypeName === "dex_whitelist") {
                summaryParts.push("Only whitelisted DEXs allowed");
            }
            if (p.policyTypeName === "token_whitelist") {
                summaryParts.push("Only whitelisted tokens allowed");
            }
            if (p.policyTypeName === "defi_guard") {
                summaryParts.push("DeFi interactions validated by DeFiGuard");
            }

            enriched.push(entry);
        }

        const humanSummary = summaryParts.length > 0
            ? summaryParts.join(" | ")
            : "No configurable policies found";

        output({
            status: "success",
            tokenId: tokenId.toString(),
            humanSummary,
            securityNote: "Operator wallet CANNOT withdraw vault funds or transfer Agent NFT 闂?only owner can.",
            policies: enriched,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: config 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜?
const configCmd = new Command("config")
    .description("Configure risk parameters (spending limits, cooldown)")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .option("--tx-limit <bnb>", "Max BNB per transaction (human-readable)")
    .option("--daily-limit <bnb>", "Max BNB per day (human-readable)")
    .option("--cooldown <seconds>", "Minimum seconds between transactions")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC);

configCmd.action(async (opts) => {
    try {
        if (!opts.txLimit && !opts.dailyLimit && !opts.cooldown) {
            output({ status: "error", message: "Specify at least one: --tx-limit, --daily-limit, or --cooldown" });
            process.exit(1);
        }

        if (!process.env.RUNNER_PRIVATE_KEY) {
            output({ status: "error", message: "RUNNER_PRIVATE_KEY environment variable is missing" });
            process.exit(1);
        }
        const privateKey = toHex(process.env.RUNNER_PRIVATE_KEY);
        const account = privateKeyToAccount(privateKey);
        const rpcUrl = opts.rpc || DEFAULT_RPC;

        const client = createPolicyClient(opts);
        const tokenId = BigInt(opts.tokenId);
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
        const walletClient = createWalletClient({
            account,
            chain: bsc,
            transport: http(rpcUrl),
        });

        // Discover policy addresses dynamically
        const policies = await client.getPolicies(tokenId);

        // Configure SpendingLimit if requested
        if (opts.txLimit || opts.dailyLimit) {
            const spendingPolicy = policies.find(p => p.policyTypeName === "spending_limit");
            if (!spendingPolicy) {
                output({ status: "error", message: "No SpendingLimitPolicy found for this agent" });
                process.exit(1);
            }

            // Read current limits as defaults
            const current = await publicClient.readContract({
                address: spendingPolicy.address,
                abi: SPENDING_LIMIT_ABI,
                functionName: "instanceLimits",
                args: [tokenId],
            });
            const [curMaxPerTx, curMaxPerDay, curSlippage] = current;

            const newMaxPerTx = opts.txLimit ? parseEther(opts.txLimit) : curMaxPerTx;
            const newMaxPerDay = opts.dailyLimit ? parseEther(opts.dailyLimit) : curMaxPerDay;

            output({
                status: "info",
                message: `Setting spending limits: maxPerTx=${(Number(newMaxPerTx) / 1e18).toFixed(4)} BNB, maxPerDay=${(Number(newMaxPerDay) / 1e18).toFixed(4)} BNB`,
            });

            const hash = await walletClient.writeContract({
                address: spendingPolicy.address,
                abi: SPENDING_LIMIT_ABI,
                functionName: "setLimits",
                args: [tokenId, newMaxPerTx, newMaxPerDay, curSlippage],
            });
            await publicClient.waitForTransactionReceipt({ hash });
            output({ status: "info", message: `SpendingLimit updated: ${hash}` });
        }

        // Configure Cooldown if requested
        if (opts.cooldown) {
            const cooldownPolicy = policies.find(p => p.policyTypeName === "cooldown");
            if (!cooldownPolicy) {
                output({ status: "error", message: "No CooldownPolicy found for this agent" });
                process.exit(1);
            }

            const seconds = BigInt(opts.cooldown);
            output({ status: "info", message: `Setting cooldown to ${seconds} seconds` });

            const hash = await walletClient.writeContract({
                address: cooldownPolicy.address,
                abi: COOLDOWN_ABI,
                functionName: "setCooldown",
                args: [tokenId, seconds],
            });
            await publicClient.waitForTransactionReceipt({ hash });
            output({ status: "info", message: `Cooldown updated: ${hash}` });
        }

        output({ status: "success", message: "Risk parameters updated successfully" });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// -- Subcommand: listings (query available agent templates) --------
const DEFAULT_INDEXER = "https://indexer-mainnet.shll.run";

type IndexerListing = {
    id: string;
    agentName: string;
    agentType: string;
    pricePerDay: string;
    minDays: number;
    active: boolean;
    nfa: string;
    tokenId?: string;
    owner?: string;
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
        tokenId: typeof item.tokenId === "string" ? item.tokenId : undefined,
        owner: typeof item.owner === "string" ? item.owner : undefined,
    };
}

async function fetchActiveListings(indexerUrl: string): Promise<IndexerListing[]> {
    const normalized = indexerUrl.replace(/\/+$/, "");
    const res = await fetch(`${normalized}/api/listings`, { signal: AbortSignal.timeout(10000) });
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

async function resolveSetupListing(opts: { listingId?: string; indexerUrl: string }) {
    if (opts.listingId) {
        return {
            listingId: opts.listingId,
            source: "manual" as const,
            listing: null as IndexerListing | null,
            warning: null as string | null,
        };
    }

    try {
        const active = await fetchActiveListings(opts.indexerUrl);
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
            warning: "No active listings returned by indexer; fell back to default listingId.",
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown indexer error";
        return {
            listingId: DEFAULT_LISTING_ID,
            source: "default-fallback" as const,
            listing: null as IndexerListing | null,
            warning: `Failed to fetch listings from indexer (${message}); fell back to default listingId.`,
        };
    }
}

const listingsCmd = new Command("listings")
    .description("List all available agent templates for rent")
    .option("--indexer <url>", "Indexer API URL", DEFAULT_INDEXER)
    .action(async (opts) => {
        try {
            const indexerUrl = opts.indexer || DEFAULT_INDEXER;
            const available = await fetchActiveListings(indexerUrl);
            if (available.length === 0) {
                output({ status: "success", message: "No active listings found.", listings: [] });
                return;
            }

            const listings = available.map((l) => ({
                listingId: l.id,
                name: l.agentName || "Unnamed Agent",
                type: l.agentType || "unknown",
                pricePerDayBNB: (Number(l.pricePerDay) / 1e18).toFixed(6),
                minDays: l.minDays,
                nfa: l.nfa,
            }));

            output({
                status: "success",
                count: listings.length,
                listings,
                hint: "Run setup-guide directly (auto-selects listing) or pass --listing-id explicitly.",
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error";
            outputError(message, "Run 'shll-run doctor' and retry.");
            process.exit(1);
        }
    });

// -- Subcommand: setup-guide (secure dual-wallet onboarding) ------
const setupGuideCmd = new Command("setup-guide")
    .description("Output step-by-step instructions for secure dual-wallet agent setup (auto-selects active listing if omitted)")
    .option("-l, --listing-id <bytes32>", "Template listing ID (bytes32 hex)")
    .option("-d, --days <number>", "Number of days to rent (minimum 7)", "7")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC)
    .option("--indexer <url>", "Indexer API URL", DEFAULT_INDEXER)
    .option("--listing-manager <address>", "ListingManagerV2 address", DEFAULT_LISTING_MANAGER);

setupGuideCmd.action(async (opts) => {
    try {
        // Get operator address from RUNNER_PRIVATE_KEY
        const pk = process.env.RUNNER_PRIVATE_KEY;
        let operatorAddress: string;
        if (pk) {
            const account = privateKeyToAccount(toHex(pk) as Hex);
            operatorAddress = account.address;
        } else {
            output({
                status: "error",
                message: "RUNNER_PRIVATE_KEY not set. Run 'generate-wallet' first to create an operator wallet, then set RUNNER_PRIVATE_KEY.",
            });
            process.exit(1);
            return;
        }

        const rpcUrl = opts.rpc || DEFAULT_RPC;
        const indexerUrl = opts.indexer || DEFAULT_INDEXER;
        const listingManagerAddr = toHex(opts.listingManager || DEFAULT_LISTING_MANAGER) as Address;
        const nfaAddr = toHex(DEFAULT_NFA) as Address;
        const manualListingId = opts.listingId as string | undefined;
        if (manualListingId && !isValidListingId(manualListingId)) {
            outputError("Invalid --listing-id format.", "Expected bytes32 hex string like 0x + 64 hex chars.");
            process.exit(1);
            return;
        }

        const daysToRent = Number(opts.days);
        if (!Number.isInteger(daysToRent) || daysToRent < 7) {
            outputError("Invalid --days value.", "Expected an integer day count >= 7, e.g. --days 7.");
            process.exit(1);
            return;
        }

        const resolvedListing = await resolveSetupListing({ listingId: manualListingId, indexerUrl });
        const listingId = resolvedListing.listingId;

        // Query listing to calculate rent cost
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
        let rentCost = "unknown";
        let priceInfo = "";
        try {
            const listing = await publicClient.readContract({
                address: listingManagerAddr,
                abi: LISTING_MANAGER_ABI,
                functionName: "listings",
                args: [listingId as Hex],
            });
            const [, , , pricePerDay, minDays, active] = listing;
            if (!active) {
                outputError(
                    "Selected listing is not active.",
                    "Run 'shll-run listings' to pick an active listing, then rerun setup-guide with --listing-id.",
                    { listingId, listingSource: resolvedListing.source },
                );
                process.exit(1);
            }
            if (daysToRent < minDays) {
                outputError(
                    `Minimum rental is ${minDays} days, you requested ${daysToRent}.`,
                    `Increase --days to at least ${minDays} and retry.`,
                    { listingId, listingSource: resolvedListing.source },
                );
                process.exit(1);
            }
            const totalRent = BigInt(pricePerDay) * BigInt(daysToRent);
            rentCost = `${(Number(totalRent) / 1e18).toFixed(6)} BNB`;
            priceInfo = ` (${totalRent.toString()} wei)`;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error";
            outputError(
                "Failed to query listing on-chain.",
                "Check --listing-id/--listing-manager/--rpc and retry.",
                { listingId, listingSource: resolvedListing.source, reason: message },
            );
            process.exit(1);
            return;
        }

        // Calculate operator expiry timestamp
        const expiryTimestamp = Math.floor(Date.now() / 1000) + daysToRent * 86400;

        // Build shll.run setup URL
        const setupUrl = `https://shll.run/setup?operator=${operatorAddress}&listing=${encodeURIComponent(listingId)}&days=${daysToRent}`;

        output({
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
            rentCost: `${rentCost}${priceInfo}`,
            steps: [
                {
                    step: 1,
                    title: "Open SHLL Setup Page",
                    action: `Open ${setupUrl} in your browser`,
                    note: "Connect YOUR wallet (MetaMask/WalletConnect). This is your owner wallet 闂?keep it safe and offline after setup.",
                },
                {
                    step: 2,
                    title: "Rent Agent",
                    action: "Click 'Rent Agent' and confirm the transaction",
                    fallback: {
                        method: "BscScan (manual)",
                        contract: listingManagerAddr,
                        function: "rentToMintWithParams(bytes32,uint32,uint32,uint16,bytes)",
                        args: [listingId, daysToRent, 1, 1, "0x01"],
                        value: rentCost,
                    },
                },
                {
                    step: 3,
                    title: "Authorize Operator",
                    action: "Click 'Authorize Operator' 闂?this gives the AI wallet permission to trade within PolicyGuard safety limits",
                    note: `Operator address: ${operatorAddress}`,
                    fallback: {
                        method: "BscScan (manual)",
                        contract: nfaAddr,
                        function: "setOperator(uint256,address,uint64)",
                        args: ["<tokenId from step 2>", operatorAddress, expiryTimestamp],
                    },
                },
                {
                    step: 4,
                    title: "Fund Vault (optional)",
                    action: "Deposit BNB into the vault for trading",
                    fallback: {
                        method: "BscScan (manual)",
                        contract: nfaAddr,
                        function: "fundAgent(uint256)",
                        args: ["<tokenId>"],
                        value: "amount of BNB to deposit",
                    },
                },
                {
                    step: 5,
                    title: "Tell AI your token-id",
                    action: "Come back and tell the AI your token-id number. The AI will verify your portfolio and you're ready to trade.",
                },
            ],
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// -- Subcommand: generate-wallet ---------------------------------
const genWalletCmd = new Command("generate-wallet")
    .description("Generate a new operator wallet (address + private key) for AI to use")
    .action(() => {
        const pk = generatePrivateKey();
        const account = privateKeyToAccount(pk);
        output({
            status: "success",
            address: account.address,
            privateKey: pk,
            note: "SAVE THIS PRIVATE KEY SECURELY. This is the OPERATOR wallet 闂?it can only trade within PolicyGuard limits. " +
                "It CANNOT withdraw vault funds or transfer your Agent NFT. " +
                "Send ~$1 of BNB here for gas fees, then set RUNNER_PRIVATE_KEY to this privateKey value.",
            securityReminder: "Use a SEPARATE wallet (MetaMask, hardware wallet) as the owner to rent the agent and fund the vault. " +
                "Run 'setup-guide' for step-by-step instructions.",
        });
    });

// -- Subcommand: balance (gas wallet) ----------------------------
const balanceCmd = new Command("balance")
    .description("Check BNB balance of the gas-paying wallet (RUNNER_PRIVATE_KEY)")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC)
    .action(async (opts) => {
        try {
            const pk = process.env.RUNNER_PRIVATE_KEY;
            if (!pk) {
                outputError(
                    "RUNNER_PRIVATE_KEY not set.",
                    "Run 'shll-run generate-wallet', then export RUNNER_PRIVATE_KEY and retry.",
                );
                process.exit(1);
            }
            const account = privateKeyToAccount(toHex(pk) as Hex);
            const rpcUrl = opts.rpc || DEFAULT_RPC;
            const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
            const bal = await publicClient.getBalance({ address: account.address });
            const humanBal = (Number(bal) / 1e18).toFixed(6);
            const enough = Number(bal) > 1e15; // > 0.001 BNB
            output({
                status: "success",
                address: account.address,
                balanceBNB: humanBal,
                sufficient: enough,
                note: enough
                    ? "Wallet has enough BNB for gas fees."
                    : `Wallet needs more BNB for gas. Current: ${humanBal} BNB, minimum recommended: 0.001 BNB (~$0.60). Send a small amount of BNB (BSC/BEP-20) to this address.`,
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error";
            outputError(message, "Run 'shll-run doctor' and retry.");
            process.exit(1);
        }
    });

// -- Subcommand: doctor (runtime self-check) ----------------------
const doctorCmd = new Command("doctor")
    .description("Run environment, contract binding, RPC, wallet, and optional token-id access checks")
    .option("-k, --token-id <number>", "Optional Agent NFA Token ID for access/expiry checks")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC)
    .option("--indexer <url>", "Indexer API URL", DEFAULT_INDEXER)
    .action(async (opts) => {
        const rpcUrl = opts.rpc || DEFAULT_RPC;
        const indexerUrl = (opts.indexer || DEFAULT_INDEXER).replace(/\/+$/, "");
        const hasRunnerPrivateKey = !!process.env.RUNNER_PRIVATE_KEY;
        const issues: string[] = [];
        const checks: Record<string, unknown> = {
            skillVersion: SKILL_VERSION,
            bindingsUpdatedAt: BINDINGS_UPDATED_AT,
            chainId: 56,
            contracts: {
                agentNfa: DEFAULT_NFA,
                policyGuard: DEFAULT_GUARD,
                listingManagerV2: DEFAULT_LISTING_MANAGER,
                defaultListingId: DEFAULT_LISTING_ID,
            },
            env: {
                hasRunnerPrivateKey,
            },
            rpc: {
                url: rpcUrl,
                ok: false,
            },
            indexer: {
                url: indexerUrl,
                ok: false,
            },
        };

        try {
            // RPC reachability
            const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
            const blockNumber = await publicClient.getBlockNumber();
            checks.rpc = { url: rpcUrl, ok: true, latestBlock: blockNumber.toString() };

            // Indexer reachability (status code only)
            try {
                const idxRes = await fetch(`${indexerUrl}/api/listings`, { signal: AbortSignal.timeout(8000) });
                checks.indexer = { url: indexerUrl, ok: idxRes.ok, status: idxRes.status };
                if (!idxRes.ok) issues.push(`Indexer returned ${idxRes.status}`);
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Indexer request failed";
                checks.indexer = { url: indexerUrl, ok: false, error: msg };
                issues.push(msg);
            }

            // Wallet checks
            if (!hasRunnerPrivateKey) {
                issues.push("RUNNER_PRIVATE_KEY is missing");
            } else {
                const account = privateKeyToAccount(toHex(process.env.RUNNER_PRIVATE_KEY || "") as Hex);
                const bal = await publicClient.getBalance({ address: account.address });
                const sufficientGas = bal > 1_000_000_000_000_000n; // 0.001 BNB
                checks.wallet = {
                    address: account.address,
                    balanceBNB: (Number(bal) / 1e18).toFixed(6),
                    sufficientGas,
                };
                if (!sufficientGas) issues.push("Operator wallet BNB balance is below 0.001");

                if (opts.tokenId) {
                    const tokenId = BigInt(opts.tokenId);
                    const [operatorExpires, userExpires, operator, renter, owner] = await Promise.all([
                        publicClient.readContract({ address: DEFAULT_NFA as Address, abi: AGENT_NFA_ACCESS_ABI, functionName: "operatorExpiresOf", args: [tokenId] }) as Promise<bigint>,
                        publicClient.readContract({ address: DEFAULT_NFA as Address, abi: AGENT_NFA_ACCESS_ABI, functionName: "userExpires", args: [tokenId] }) as Promise<bigint>,
                        publicClient.readContract({ address: DEFAULT_NFA as Address, abi: AGENT_NFA_ACCESS_ABI, functionName: "operatorOf", args: [tokenId] }) as Promise<Address>,
                        publicClient.readContract({ address: DEFAULT_NFA as Address, abi: AGENT_NFA_ACCESS_ABI, functionName: "userOf", args: [tokenId] }) as Promise<Address>,
                        publicClient.readContract({ address: DEFAULT_NFA as Address, abi: AGENT_NFA_ACCESS_ABI, functionName: "ownerOf", args: [tokenId] }) as Promise<Address>,
                    ]);
                    const now = BigInt(Math.floor(Date.now() / 1000));
                    const runnerLower = account.address.toLowerCase();
                    const authorized =
                        operator.toLowerCase() === runnerLower ||
                        renter.toLowerCase() === runnerLower ||
                        owner.toLowerCase() === runnerLower;

                    checks.tokenAccess = {
                        tokenId: tokenId.toString(),
                        authorized,
                        operator,
                        renter,
                        owner,
                        rentalExpired: now > userExpires,
                        operatorExpired: now > operatorExpires,
                        rentalExpiresAt: new Date(Number(userExpires) * 1000).toISOString(),
                        operatorExpiresAt: new Date(Number(operatorExpires) * 1000).toISOString(),
                        safetyConsole: agentConsoleUrl(tokenId),
                    };

                    if (!authorized) issues.push(`RUNNER_PRIVATE_KEY wallet is not authorized for token-id ${tokenId}`);
                    if (now > userExpires) issues.push(`token-id ${tokenId} rental has expired`);
                    if (now > operatorExpires) issues.push(`token-id ${tokenId} operator authorization has expired`);
                }
            }

            const nextSteps = [
                !hasRunnerPrivateKey ? "Run 'shll-run generate-wallet' then export RUNNER_PRIVATE_KEY." : null,
                issues.some((i) => i.includes("below 0.001")) ? "Send at least 0.001 BNB to the operator wallet for gas." : null,
                issues.some((i) => i.includes("not authorized")) ? "Open the safety console and set/renew operator authorization." : null,
                issues.some((i) => i.includes("rental has expired")) ? "Renew agent subscription at https://shll.run/me." : null,
                issues.some((i) => i.includes("Indexer returned")) ? "Check indexer service availability or use --indexer with a healthy endpoint." : null,
                issues.length === 0 ? "Environment looks healthy. You can proceed with trading commands." : null,
            ].filter(Boolean) as string[];

            output({
                status: issues.length === 0 ? "success" : "warning",
                summary: issues.length === 0 ? "All core checks passed." : `${issues.length} issue(s) found.`,
                issues,
                next_steps: nextSteps,
                ...checks,
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error";
            outputError(message, "Check RPC endpoint and key setup, then retry `shll-run doctor`.");
            process.exit(1);
        }
    });

// -- Subcommand: history (recent vault transactions) ------------------
const historyCmd = new Command("history")
    .description("Show recent transactions executed through the agent vault")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .option("--limit <number>", "Number of transactions to show", "10")
    .option("--indexer <url>", "Indexer API URL", DEFAULT_INDEXER);

historyCmd.action(async (opts) => {
    try {
        const tokenId = opts.tokenId;
        const limit = Number(opts.limit) || 10;
        const indexerUrl = opts.indexer || DEFAULT_INDEXER;

        // Fetch execution activity from indexer
        const activityRes = await fetch(`${indexerUrl}/api/activity/${tokenId}?limit=${limit}`, {
            signal: AbortSignal.timeout(10000),
        });

        if (!activityRes.ok) {
            output({ status: "error", message: `Indexer returned ${activityRes.status}. Is the indexer running?` });
            process.exit(1);
        }

        const data = await activityRes.json() as {
            items: Array<{
                txHash: string;
                target: string;
                success: boolean;
                timestamp: string;
                blockNumber: string;
                action?: string;
            }>;
            count: number;
        };

        // Also fetch commit failures (policy rejections)
        let failures: Array<{
            txHash: string;
            reason: string;
            timestamp: string;
        }> = [];
        try {
            const failRes = await fetch(`${indexerUrl}/api/agents/${tokenId}/commit-failures?limit=5`, {
                signal: AbortSignal.timeout(8000),
            });
            if (failRes.ok) {
                const failData = await failRes.json() as { items: typeof failures };
                failures = failData.items || [];
            }
        } catch { /* non-critical */ }

        const transactions = (data.items || []).map((tx) => {
            const date = new Date(Number(tx.timestamp) * 1000);
            return {
                time: date.toISOString(),
                txHash: tx.txHash,
                target: tx.target,
                success: tx.success,
                bscscanUrl: `https://bscscan.com/tx/${tx.txHash}`,
            };
        });

        output({
            status: "success",
            tokenId,
            transactions,
            totalShown: transactions.length,
            recentPolicyRejections: failures.length,
            policyRejections: failures.length > 0 ? failures : undefined,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// -- Subcommand: status (one-shot security overview) ------------------
const statusCmd = new Command("status")
    .description("Show a security overview: vault balance, operator status, policies, and recent activity")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC)
    .option("--indexer <url>", "Indexer API URL", DEFAULT_INDEXER);

statusCmd.action(async (opts) => {
    try {
        const tokenId = BigInt(opts.tokenId);
        const rpcUrl = opts.rpc || DEFAULT_RPC;
        const nfaAddr = toHex(DEFAULT_NFA) as Address;
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
        const indexerUrl = opts.indexer || DEFAULT_INDEXER;

        // 1. Vault address and BNB balance
        const vault = await publicClient.readContract({
            address: nfaAddr,
            abi: AGENT_NFA_ABI,
            functionName: "accountOf",
            args: [tokenId],
        }) as Address;
        const bnbBalance = await publicClient.getBalance({ address: vault });
        const bnbHuman = (Number(bnbBalance) / 1e18).toFixed(6);

        // 2. Operator wallet info
        let operatorInfo: Record<string, unknown> = { configured: false };
        const pk = process.env.RUNNER_PRIVATE_KEY;
        if (pk) {
            const account = privateKeyToAccount(toHex(pk) as Hex);
            const opBalance = await publicClient.getBalance({ address: account.address });
            const opBnb = (Number(opBalance) / 1e18).toFixed(6);
            operatorInfo = {
                configured: true,
                address: account.address,
                gasBnb: opBnb,
                gasOk: Number(opBalance) > 1e15,
            };
        }

        // 3. Policies summary
        const client = createPolicyClient(opts);
        const policies = await client.getPolicies(tokenId);
        const summaryParts: string[] = [];
        for (const p of policies) {
            if (p.policyTypeName === "spending_limit") {
                try {
                    const limits = await publicClient.readContract({
                        address: p.address,
                        abi: SPENDING_LIMIT_ABI,
                        functionName: "instanceLimits",
                        args: [tokenId],
                    });
                    const [maxPerTx, maxPerDay] = limits;
                    summaryParts.push(`Max ${(Number(maxPerTx) / 1e18).toFixed(4)} BNB/tx, ${(Number(maxPerDay) / 1e18).toFixed(4)} BNB/day`);
                } catch { /* skip */ }
            }
            if (p.policyTypeName === "cooldown") {
                try {
                    const cd = await publicClient.readContract({
                        address: p.address,
                        abi: COOLDOWN_ABI,
                        functionName: "cooldownSeconds",
                        args: [tokenId],
                    });
                    summaryParts.push(`Cooldown ${Number(cd)}s`);
                } catch { /* skip */ }
            }
            if (p.policyTypeName === "receiver_guard") summaryParts.push("ReceiverGuard active");
            if (p.policyTypeName === "dex_whitelist") summaryParts.push("DEX whitelist active");
            if (p.policyTypeName === "token_whitelist") summaryParts.push("Token whitelist active");
            if (p.policyTypeName === "defi_guard") summaryParts.push("DeFiGuard active");
        }

        // 4. Recent activity stats from indexer
        let activityStats: Record<string, unknown> = { available: false };
        try {
            const summaryRes = await fetch(`${indexerUrl}/api/agents/${opts.tokenId}/summary`, {
                signal: AbortSignal.timeout(8000),
            });
            if (summaryRes.ok) {
                const summaryData = await summaryRes.json() as {
                    totalExecutions: number;
                    successCount: number;
                    failCount: number;
                    lastExecution: string | null;
                };
                activityStats = {
                    available: true,
                    totalExecutions: summaryData.totalExecutions,
                    successRate: summaryData.totalExecutions > 0
                        ? `${((summaryData.successCount / summaryData.totalExecutions) * 100).toFixed(1)}%`
                        : "N/A",
                    lastExecution: summaryData.lastExecution
                        ? new Date(Number(summaryData.lastExecution) * 1000).toISOString()
                        : null,
                };
            }
        } catch { /* non-critical */ }

        output({
            status: "success",
            tokenId: tokenId.toString(),
            vault: {
                address: vault,
                bnbBalance: bnbHuman,
            },
            operator: operatorInfo,
            securitySummary: summaryParts.length > 0 ? summaryParts.join(" | ") : "No policies found",
            policyCount: policies.length,
            activity: activityStats,
            securityNote: "Operator wallet CANNOT withdraw vault funds or transfer Agent NFT.",
            dashboardUrl: `https://shll.run/dashboard?tokenId=${tokenId}`,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: lend (Venus Protocol) 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸?
const lendCmd = new Command("lend")
    .description("Supply tokens to Venus Protocol to earn yield")
    .requiredOption("-t, --token <symbol>", "Token to supply (BNB, USDT, USDC, BUSD)")
    .requiredOption("-a, --amount <number>", "Amount to supply (human-readable)");
addSharedOptions(lendCmd);

lendCmd.action(async (opts) => {
    try {
        const client = createClient(opts);
        const tokenId = BigInt(opts.tokenId);
        await checkAccess(opts, tokenId);
        const rpcUrl = opts.rpc || DEFAULT_RPC;
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });

        const symbol = opts.token.toUpperCase();
        const vTokenAddr = VENUS_VTOKENS[symbol];
        if (!vTokenAddr) {
            output({ status: "error", message: `Unsupported token for Venus lending: ${symbol}. Supported: ${Object.keys(VENUS_VTOKENS).join(", ")}` });
            process.exit(1);
        }

        const isBNB = symbol === "BNB";
        const tokenInfo = resolveToken(symbol);
        const amount = parseAmount(opts.amount, tokenInfo.decimals);
        const vault = await client.getVault(tokenId);

        output({ status: "info", message: `Supplying ${opts.amount} ${symbol} to Venus (vToken: ${vTokenAddr})` });

        const actions: Action[] = [];

        if (isBNB) {
            // vBNB: mint() payable 闂?send BNB directly
            const data = encodeFunctionData({ abi: VBNB_MINT_ABI, functionName: "mint" });
            actions.push({ target: vTokenAddr, value: amount, data });
        } else {
            // ERC20: approve 闂?mint(amount)
            const currentAllowance = await publicClient.readContract({
                address: tokenInfo.address,
                abi: ERC20_ABI,
                functionName: "allowance",
                args: [vault, vTokenAddr],
            }).catch(() => 0n);

            if (currentAllowance < amount) {
                const approveData = encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: "approve",
                    args: [vTokenAddr, amount],
                });
                actions.push({ target: tokenInfo.address, value: 0n, data: approveData });
            }

            const mintData = encodeFunctionData({
                abi: VTOKEN_ABI,
                functionName: "mint",
                args: [amount],
            });
            actions.push({ target: vTokenAddr, value: 0n, data: mintData });
        }

        // Validate
        for (const action of actions) {
            const simResult = await client.validate(tokenId, action);
            if (!simResult.ok) {
                output({ status: "rejected", reason: simResult.reason });
                process.exit(0);
            }
        }

        // Execute
        let hash: Hex;
        if (actions.length === 1) {
            const result = await client.execute(tokenId, actions[0], true);
            hash = result.hash;
        } else {
            const result = await client.executeBatch(tokenId, actions, true);
            hash = result.hash;
        }

        output({ status: "success", hash, protocol: "venus", action: "supply", token: symbol, amount: opts.amount });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: redeem (Venus Protocol) 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑?
const redeemCmd = new Command("redeem")
    .description("Withdraw supplied tokens from Venus Protocol")
    .requiredOption("-t, --token <symbol>", "Token to redeem (BNB, USDT, USDC, BUSD)")
    .requiredOption("-a, --amount <number>", "Amount of underlying to redeem (human-readable)");
addSharedOptions(redeemCmd);

redeemCmd.action(async (opts) => {
    try {
        const client = createClient(opts);
        const tokenId = BigInt(opts.tokenId);
        await checkAccess(opts, tokenId);

        const symbol = opts.token.toUpperCase();
        const vTokenAddr = VENUS_VTOKENS[symbol];
        if (!vTokenAddr) {
            output({ status: "error", message: `Unsupported token: ${symbol}. Supported: ${Object.keys(VENUS_VTOKENS).join(", ")}` });
            process.exit(1);
        }

        const tokenInfo = resolveToken(symbol);
        const amount = parseAmount(opts.amount, tokenInfo.decimals);

        output({ status: "info", message: `Redeeming ${opts.amount} ${symbol} from Venus` });

        const data = encodeFunctionData({
            abi: VTOKEN_ABI,
            functionName: "redeemUnderlying",
            args: [amount],
        });

        const action: Action = { target: vTokenAddr, value: 0n, data };

        const simResult = await client.validate(tokenId, action);
        if (!simResult.ok) {
            output({ status: "rejected", reason: simResult.reason });
            process.exit(0);
        }

        const result = await client.execute(tokenId, action, true);
        output({ status: "success", hash: result.hash, protocol: "venus", action: "redeem", token: symbol, amount: opts.amount });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: lending-info (read-only) 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕
const lendingInfoCmd = new Command("lending-info")
    .description("Show Venus Protocol supply balances and APY for agent vault")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC);

lendingInfoCmd.action(async (opts) => {
    try {
        const rpcUrl = opts.rpc || DEFAULT_RPC;
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
        const tokenId = BigInt(opts.tokenId);

        // Get vault address
        const policyClient = createPolicyClient(opts);
        const vault = await policyClient.getVault(tokenId);

        const BLOCKS_PER_YEAR = 10512000n; // ~3s block time on BSC

        const positions: Array<Record<string, unknown>> = [];

        for (const [symbol, vTokenAddr] of Object.entries(VENUS_VTOKENS)) {
            try {
                // balanceOfUnderlying 闂?get supplied amount
                const supplied = await publicClient.readContract({
                    address: vTokenAddr,
                    abi: VTOKEN_READ_ABI,
                    functionName: "balanceOfUnderlying",
                    args: [vault],
                });

                // supplyRatePerBlock 闂?calculate APY
                const ratePerBlock = await publicClient.readContract({
                    address: vTokenAddr,
                    abi: VTOKEN_READ_ABI,
                    functionName: "supplyRatePerBlock",
                });

                // APY = ((1 + ratePerBlock / 1e18) ^ blocksPerYear - 1) * 100
                const rateFloat = Number(ratePerBlock) / 1e18;
                const apy = (Math.pow(1 + rateFloat, Number(BLOCKS_PER_YEAR)) - 1) * 100;

                const tokenInfo = resolveToken(symbol);
                const suppliedHuman = (Number(supplied) / Math.pow(10, tokenInfo.decimals)).toFixed(6);

                positions.push({
                    token: symbol,
                    vToken: vTokenAddr,
                    supplied: suppliedHuman,
                    suppliedRaw: supplied.toString(),
                    apyPercent: apy.toFixed(2),
                    hasPosition: supplied > 0n,
                });
            } catch {
                positions.push({ token: symbol, vToken: vTokenAddr, error: "Failed to query" });
            }
        }

        const activePositions = positions.filter((p) => p.hasPosition);
        output({
            status: "success",
            vault,
            protocol: "venus",
            positions,
            activeCount: activePositions.length,
            totalMarkets: positions.length,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: my-agents 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸?
const OPERATOR_OF_ABI = [{
    type: "function" as const, name: "operatorOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view" as const,
}] as const;

const myAgentsCmd = new Command("my-agents")
    .description("List all agents where the current RUNNER_PRIVATE_KEY is the operator")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC)
    .option("--indexer <url>", "Indexer base URL", DEFAULT_INDEXER);

myAgentsCmd.action(async (opts) => {
    try {
        if (!process.env.RUNNER_PRIVATE_KEY) {
            output({ status: "error", message: "RUNNER_PRIVATE_KEY environment variable is missing" });
            process.exit(1);
        }
        const operator = privateKeyToAccount(toHex(process.env.RUNNER_PRIVATE_KEY)).address.toLowerCase();
        const rpcUrl = opts.rpc || DEFAULT_RPC;
        const nfaAddr = toHex(DEFAULT_NFA) as Address;
        const indexerUrl = (opts.indexer || DEFAULT_INDEXER).replace(/\/+$/, "");
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });

        // 1. Fetch all non-template agents from indexer
        const res = await fetch(`${indexerUrl}/api/agents`);
        if (!res.ok) {
            output({ status: "error", message: `Indexer error: ${res.status}` });
            process.exit(1);
        }
        const json = await res.json() as { items?: Array<{ tokenId?: string | number; owner?: string; account?: string; isTemplate?: boolean; agentType?: string }> };
        const agents = (json.items || []).filter(a => !a.isTemplate && a.tokenId !== undefined);

        if (agents.length === 0) {
            output({ status: "success", agents: [], message: "No agents found in indexer" });
            return;
        }

        // 2. Batch check operatorOf for all agents in parallel
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
                    return {
                        tokenId: tokenId.toString(),
                        vault: a.account || "",
                        owner: a.owner || "",
                        agentType: a.agentType || "unknown",
                        isOperator: (op as string).toLowerCase() === operator,
                    };
                } catch {
                    return null;
                }
            })
        );

        const myAgents = checks.filter(c => c !== null && c.isOperator);
        output({
            status: "success",
            operator,
            agents: myAgents,
            count: myAgents.length,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Four.meme Launchpad Constants 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸?
const FOUR_MEME_HELPER_V3 = "0xF251F83e40a78868FcfA3FA4599Dad6494E46034" as Address;

// Four.meme TokenManagerHelper3 ABI (query + routing)
const FOUR_MEME_HELPER_ABI = [
    {
        type: "function" as const, name: "getTokenInfo",
        inputs: [{ name: "token", type: "address" }],
        outputs: [
            { name: "version", type: "uint256" },
            { name: "tokenManager", type: "address" },
            { name: "quote", type: "address" },
            { name: "lastPrice", type: "uint256" },
            { name: "tradingFeeRate", type: "uint256" },
            { name: "minTradingFee", type: "uint256" },
            { name: "launchTime", type: "uint256" },
            { name: "offers", type: "uint256" },
            { name: "maxOffers", type: "uint256" },
            { name: "funds", type: "uint256" },
            { name: "maxFunds", type: "uint256" },
            { name: "liquidityAdded", type: "bool" },
        ],
        stateMutability: "view" as const,
    },
    {
        type: "function" as const, name: "tryBuy",
        inputs: [
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "funds", type: "uint256" },
        ],
        outputs: [
            { name: "tokenManager", type: "address" },
            { name: "quote", type: "address" },
            { name: "estimatedAmount", type: "uint256" },
            { name: "estimatedCost", type: "uint256" },
            { name: "estimatedFee", type: "uint256" },
            { name: "amountMsgValue", type: "uint256" },
            { name: "amountApproval", type: "uint256" },
            { name: "amountFunds", type: "uint256" },
        ],
        stateMutability: "view" as const,
    },
    {
        type: "function" as const, name: "trySell",
        inputs: [
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [
            { name: "tokenManager", type: "address" },
            { name: "quote", type: "address" },
            { name: "funds", type: "uint256" },
            { name: "fee", type: "uint256" },
        ],
        stateMutability: "view" as const,
    },
] as const;

// Four.meme TokenManager V1 ABI (pre-Sep 2024 tokens)
const FOUR_MEME_V1_ABI = [
    {
        type: "function" as const, name: "purchaseTokenAMAP",
        inputs: [
            { name: "token", type: "address" },
            { name: "funds", type: "uint256" },
            { name: "minAmount", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "payable" as const,
    },
    {
        type: "function" as const, name: "saleToken",
        inputs: [
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable" as const,
    },
] as const;

// Four.meme TokenManager2 V2 ABI (post-Sep 2024 tokens)
const FOUR_MEME_V2_ABI = [
    {
        type: "function" as const, name: "buyTokenAMAP",
        inputs: [
            { name: "token", type: "address" },
            { name: "funds", type: "uint256" },
            { name: "minAmount", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "payable" as const,
    },
    {
        type: "function" as const, name: "sellToken",
        inputs: [
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable" as const,
    },
] as const;

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: four-info 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸?
const fourInfoCmd = new Command("four-info")
    .description("Query Four.meme bonding curve token info (price, progress, DEX status)")
    .requiredOption("--token <address>", "Token contract address on Four.meme")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC);

fourInfoCmd.action(async (opts) => {
    try {
        const rpcUrl = opts.rpc || DEFAULT_RPC;
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
        const tokenAddr = opts.token as Address;

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

        output({
            status: "success",
            token: tokenAddr,
            version: Number(version),
            tokenManager,
            quoteToken: quote === "0x0000000000000000000000000000000000000000" ? "BNB" : quote,
            lastPrice: lastPrice.toString(),
            lastPriceHuman: (Number(lastPrice) / 1e18).toExponential(4),
            tradingFeeRate: `${Number(tradingFeeRate) / 100}%`,
            minTradingFee: minTradingFee.toString(),
            launchTime: new Date(Number(launchTime) * 1000).toISOString(),
            offers: offers.toString(),
            maxOffers: maxOffers.toString(),
            tokensSoldPct: `${offersPct.toFixed(2)}%`,
            fundsRaised: funds.toString(),
            fundsRaisedBNB: (Number(funds) / 1e18).toFixed(4),
            maxFunds: maxFunds.toString(),
            maxFundsBNB: (Number(maxFunds) / 1e18).toFixed(4),
            bondingCurveProgress: `${progressPct.toFixed(2)}%`,
            liquidityAdded,
            tradingPhase: liquidityAdded ? "DEX (PancakeSwap)" : "Internal (Bonding Curve)",
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: four-buy 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕
const fourBuyCmd = new Command("four-buy")
    .description("Buy tokens on Four.meme internal bonding curve using BNB")
    .requiredOption("--token <address>", "Token contract address")
    .requiredOption("-a, --amount <bnb>", "BNB amount to spend (human-readable, e.g. 0.01)")
    .option("-s, --slippage <percent>", "Slippage tolerance in percent (default: 10)", "10");
addSharedOptions(fourBuyCmd);

fourBuyCmd.action(async (opts) => {
    try {
        const client = createClient(opts);
        const tokenId = BigInt(opts.tokenId);
        await checkAccess(opts, tokenId);
        const rpcUrl = opts.rpc || DEFAULT_RPC;
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
        const vault = await client.getVault(tokenId);

        const tokenAddr = opts.token as Address;
        const slippage = Number(opts.slippage);
        const bnbAmount = parseAmount(opts.amount, 18);
        if (bnbAmount <= 0n) {
            outputError("Invalid amount.", "four-buy amount must be a positive BNB value.");
            process.exit(1);
        }

        // 1. Get token info to check status
        const info = await publicClient.readContract({
            address: FOUR_MEME_HELPER_V3,
            abi: FOUR_MEME_HELPER_ABI,
            functionName: "getTokenInfo",
            args: [tokenAddr],
        });
        const [version, tokenManager, quote, , , minTradingFee, , , , , , liquidityAdded] = info;

        if (liquidityAdded) {
            output({ status: "error", message: "Token has already migrated to DEX. Use the 'swap' command instead of 'four-buy'." });
            process.exit(1);
        }

        const isQuoteBNB = quote === "0x0000000000000000000000000000000000000000";
        if (!isQuoteBNB) {
            output({ status: "error", message: `Token uses BEP20 quote (${quote}), not BNB. BEP20 quote pairs are not yet supported in this tool.` });
            process.exit(1);
        }
        if (bnbAmount < minTradingFee) {
            outputError(
                "Input amount is below Four.meme minimum trading fee threshold.",
                "Increase --amount and retry.",
                {
                    token: tokenAddr,
                    inputBnb: opts.amount,
                    inputWei: bnbAmount.toString(),
                    minTradingFeeWei: minTradingFee.toString(),
                    minTradingFeeBnb: (Number(minTradingFee) / 1e18).toFixed(6),
                },
            );
            process.exit(1);
        }

        // 2. Pre-calculate buy estimate
        const tryBuyResult = await publicClient.readContract({
            address: FOUR_MEME_HELPER_V3,
            abi: FOUR_MEME_HELPER_ABI,
            functionName: "tryBuy",
            args: [tokenAddr, 0n, bnbAmount],
        });
        const [, , estimatedAmount, estimatedCost, estimatedFee, amountMsgValue] = tryBuyResult;
        if (amountMsgValue < minTradingFee) {
            outputError(
                "Computed payable amount is below Four.meme minimum trading fee threshold.",
                "Increase --amount and retry.",
                {
                    token: tokenAddr,
                    inputBnb: opts.amount,
                    payableWei: amountMsgValue.toString(),
                    minTradingFeeWei: minTradingFee.toString(),
                    minTradingFeeBnb: (Number(minTradingFee) / 1e18).toFixed(6),
                },
            );
            process.exit(1);
        }
        if (estimatedAmount <= 0n || amountMsgValue <= 0n) {
            outputError(
                "four-buy quote returned zero output.",
                "Requested amount is likely too small for this market. Increase --amount and retry.",
                {
                    token: tokenAddr,
                    inputBnb: opts.amount,
                    estimatedCostWei: estimatedCost.toString(),
                    estimatedFeeWei: estimatedFee.toString(),
                },
            );
            process.exit(1);
        }
        const vaultBnbBalance = await publicClient.getBalance({ address: vault });
        if (amountMsgValue > vaultBnbBalance) {
            outputError(
                "Vault BNB balance is insufficient for four-buy.",
                "Deposit more BNB to vault or reduce --amount, then retry.",
                {
                    vault,
                    requiredBnb: (Number(amountMsgValue) / 1e18).toFixed(6),
                    availableBnb: (Number(vaultBnbBalance) / 1e18).toFixed(6),
                    requiredWei: amountMsgValue.toString(),
                    availableWei: vaultBnbBalance.toString(),
                },
            );
            process.exit(1);
        }

        // Align to GWEI precision (Four.meme requirement)
        const minAmount = (estimatedAmount * BigInt(100 - slippage)) / 100n;
        const alignedMinAmount = (minAmount / 1000000000n) * 1000000000n;

        output({
            status: "info",
            message: `Four.meme Buy: ~${(Number(estimatedAmount) / 1e18).toFixed(4)} tokens for ${opts.amount} BNB` +
                ` | fee: ${(Number(estimatedFee) / 1e18).toFixed(6)} BNB | minOut: ${(Number(alignedMinAmount) / 1e18).toFixed(4)} (${slippage}% slippage)`,
        });

        // 3. Build buy action based on version
        let data: Hex;
        if (Number(version) === 1) {
            data = encodeFunctionData({
                abi: FOUR_MEME_V1_ABI,
                functionName: "purchaseTokenAMAP",
                args: [tokenAddr, bnbAmount, alignedMinAmount],
            });
        } else {
            data = encodeFunctionData({
                abi: FOUR_MEME_V2_ABI,
                functionName: "buyTokenAMAP",
                args: [tokenAddr, bnbAmount, alignedMinAmount],
            });
        }

        const action = {
            target: tokenManager as Address,
            value: amountMsgValue,
            data,
        };

        // 4. Validate + execute
        const simResult = await client.validate(tokenId, action);
        if (!simResult.ok) {
            output({ status: "rejected", reason: simResult.reason });
            process.exit(0);
        }

        let result: { hash: Hex };
        try {
            result = await client.execute(tokenId, action, true);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown execution revert";
            outputError(
                "four-buy execution reverted on-chain.",
                "Likely market-side failure (amount too small, temporary pool state change, or token-side constraint).",
                { reason: message, token: tokenAddr, inputBnb: opts.amount },
            );
            process.exit(1);
            return;
        }
        output({
            status: "success",
            hash: result.hash,
            protocol: "four.meme",
            action: "buy",
            bnbSpent: opts.amount,
            estimatedTokens: (Number(estimatedAmount) / 1e18).toFixed(4),
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

// 闂佸啿鍘滈崑鎾绘煃閸忓浜?Subcommand: four-sell 闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸嬫捇鏌嶉崗澶婁壕闂佸啿鍘滈崑鎾绘煃閸忓浜鹃梺鍐插帨閸?
const fourSellCmd = new Command("four-sell")
    .description("Sell tokens on Four.meme internal bonding curve")
    .requiredOption("--token <address>", "Token contract address")
    .requiredOption("-a, --amount <number>", "Amount of tokens to sell (human-readable, e.g. 1000)")
    .option("-s, --slippage <percent>", "Slippage tolerance in percent (default: 10)", "10");
addSharedOptions(fourSellCmd);

fourSellCmd.action(async (opts) => {
    try {
        const client = createClient(opts);
        const tokenId = BigInt(opts.tokenId);
        await checkAccess(opts, tokenId);
        const rpcUrl = opts.rpc || DEFAULT_RPC;
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });

        const tokenAddr = opts.token as Address;
        const sellAmount = parseAmount(opts.amount, 18);
        // Align to GWEI precision
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
            output({ status: "error", message: "Token has already migrated to DEX. Use the 'swap' command instead of 'four-sell'." });
            process.exit(1);
        }

        // 2. Pre-calculate sell estimate
        const trySellResult = await publicClient.readContract({
            address: FOUR_MEME_HELPER_V3,
            abi: FOUR_MEME_HELPER_ABI,
            functionName: "trySell",
            args: [tokenAddr, alignedAmount],
        });
        const [, , estimatedFunds, estimatedFee] = trySellResult;

        output({
            status: "info",
            message: `Four.meme Sell: ${opts.amount} tokens 闂?~${(Number(estimatedFunds) / 1e18).toFixed(6)} BNB` +
                ` | fee: ${(Number(estimatedFee) / 1e18).toFixed(6)} BNB`,
        });

        // 3. Build actions: approve + sell
        const actions: { target: Address; value: bigint; data: Hex }[] = [];

        // Approve TokenManager to spend tokens
        const approveData = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "approve",
            args: [tokenManager as Address, alignedAmount],
        });
        actions.push({ target: tokenAddr, value: 0n, data: approveData });

        // Sell action
        let sellData: Hex;
        if (Number(version) === 1) {
            sellData = encodeFunctionData({
                abi: FOUR_MEME_V1_ABI,
                functionName: "saleToken",
                args: [tokenAddr, alignedAmount],
            });
        } else {
            sellData = encodeFunctionData({
                abi: FOUR_MEME_V2_ABI,
                functionName: "sellToken",
                args: [tokenAddr, alignedAmount],
            });
        }
        actions.push({ target: tokenManager as Address, value: 0n, data: sellData });

        // 4. Validate + execute batch
        for (const action of actions) {
            const simResult = await client.validate(tokenId, action);
            if (!simResult.ok) {
                output({ status: "rejected", reason: simResult.reason });
                process.exit(0);
            }
        }

        const result = await client.executeBatch(tokenId, actions, true);
        output({
            status: "success",
            hash: result.hash,
            protocol: "four.meme",
            action: "sell",
            tokensSold: opts.amount,
            estimatedBNB: (Number(estimatedFunds) / 1e18).toFixed(6),
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        outputError(message, "Run 'shll-run doctor' and retry.");
        process.exit(1);
    }
});

program.addCommand(swapCmd);
program.addCommand(rawCmd);
program.addCommand(tokensCmd);
program.addCommand(initCmd);
program.addCommand(portfolioCmd);
program.addCommand(priceCmd);
program.addCommand(searchCmd);
program.addCommand(wrapCmd);
program.addCommand(unwrapCmd);
program.addCommand(transferCmd);
program.addCommand(policiesCmd);
program.addCommand(configCmd);
program.addCommand(setupGuideCmd);
program.addCommand(listingsCmd);
program.addCommand(genWalletCmd);
program.addCommand(balanceCmd);
program.addCommand(doctorCmd);
program.addCommand(historyCmd);
program.addCommand(statusCmd);
program.addCommand(lendCmd);
program.addCommand(redeemCmd);
program.addCommand(lendingInfoCmd);
program.addCommand(myAgentsCmd);
program.addCommand(fourInfoCmd);
program.addCommand(fourBuyCmd);
program.addCommand(fourSellCmd);
program.parse(process.argv);



