#!/usr/bin/env node
import { Command } from "commander";
import { PolicyClient } from "shll-policy-sdk";
import type { Action } from "shll-policy-sdk";
import {
    createPublicClient,
    createWalletClient,
    encodeFunctionData,
    http,
    parseEther,
    decodeEventLog,
    type Address,
    type Hex,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { bsc } from "viem/chains";

// ── BSC Mainnet defaults ────────────────────────────────
const DEFAULT_NFA = "0xe98dcdbf370d7b52c9a2b88f79bef514a5375a2b";
const DEFAULT_GUARD = "0x25d17ea0e3bcb8ca08a2bfe917e817afc05dbbb3";
const DEFAULT_RPC = "https://bsc-dataseed1.binance.org";
const DEFAULT_LISTING_MANAGER = "0x1f9CE85bD0FF75acc3D92eB79f1Eb472f0865071";
const DEFAULT_LISTING_ID = "0x792d9b08749fd9739b7e57217daa08a673042fe9e1e1c35545e99acb72c12186";
const PANCAKE_V2_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

// ── Token Symbol Registry (BSC Mainnet) ─────────────────
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

// ── ABI Fragments ───────────────────────────────────────
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

// ── ListingManagerV2 ABI (rental) ────────────────────────
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

// ── AgentNFA ABI (operator + fund) ──────────────────────
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

// ── Helpers ─────────────────────────────────────────────
function toHex(s: string): Hex {
    return (s.startsWith("0x") ? s : `0x${s}`) as Hex;
}

function output(data: Record<string, unknown>) {
    console.log(JSON.stringify(data));
}

function createPolicyClient(opts: Record<string, string>): PolicyClient {
    const pk = process.env.RUNNER_PRIVATE_KEY;
    return new PolicyClient({
        operatorPrivateKey: pk ? toHex(pk) : undefined,
        rpcUrl: opts.rpc || DEFAULT_RPC,
        policyGuardAddress: toHex(opts.guardAddress || DEFAULT_GUARD) as Address,
        agentNfaAddress: toHex(opts.nfaAddress || DEFAULT_NFA) as Address,
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

// ── Shared Options ──────────────────────────────────────
function addSharedOptions(cmd: Command): Command {
    return cmd
        .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
        .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC)
        .option("--nfa-address <address>", "AgentNFA contract address", DEFAULT_NFA)
        .option("--guard-address <address>", "PolicyGuard contract address", DEFAULT_GUARD);
}

function createClient(options: Record<string, string>): PolicyClient {
    const privateKey = toHex(process.env.RUNNER_PRIVATE_KEY || "");
    if (!process.env.RUNNER_PRIVATE_KEY) {
        output({ status: "error", message: "RUNNER_PRIVATE_KEY environment variable is missing" });
        process.exit(1);
    }
    return new PolicyClient({
        rpcUrl: options.rpc || DEFAULT_RPC,
        agentNfaAddress: toHex(options.nfaAddress || DEFAULT_NFA) as Address,
        policyGuardAddress: toHex(options.guardAddress || DEFAULT_GUARD) as Address,
        operatorPrivateKey: privateKey,
        chainId: 56,
    });
}

// ── Program ─────────────────────────────────────────────
const program = new Command();
program.name("shll-onchain-runner").description("Execute DeFi actions securely via SHLL AgentNFA");

// ── Subcommand: swap ────────────────────────────────────
const swapCmd = new Command("swap")
    .description("Swap tokens on PancakeSwap V2")
    .requiredOption("-f, --from <token>", "Input token (symbol or 0x address, e.g. USDC, BNB)")
    .requiredOption("-t, --to <token>", "Output token (symbol or 0x address)")
    .requiredOption("-a, --amount <number>", "Amount to swap (human-readable, e.g. 0.5)")
    .option("-s, --slippage <percent>", "Slippage tolerance in percent (default: 5)", "5")
    .option("--router <address>", "DEX router address", PANCAKE_V2_ROUTER);
addSharedOptions(swapCmd);

swapCmd.action(async (opts) => {
    try {
        const client = createClient(opts);
        const tokenId = BigInt(opts.tokenId);
        const rpcUrl = opts.rpc || DEFAULT_RPC;

        const fromToken = resolveToken(opts.from);
        const toToken = resolveToken(opts.to);
        const isNativeIn = fromToken.address === "0x0000000000000000000000000000000000000000";
        const amountIn = parseAmount(opts.amount, fromToken.decimals);
        const slippage = Number(opts.slippage);
        const router = (opts.router || PANCAKE_V2_ROUTER) as Address;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

        // Get vault address for the agent
        const vault = await client.getVault(tokenId);

        // Build routing path (use WBNB as intermediate if needed)
        const pathIn = isNativeIn ? (WBNB as Address) : fromToken.address;
        const pathOut = toToken.address === "0x0000000000000000000000000000000000000000"
            ? (WBNB as Address) : toToken.address;
        let path: Address[];
        if (pathIn.toLowerCase() !== WBNB.toLowerCase() && pathOut.toLowerCase() !== WBNB.toLowerCase()) {
            path = [pathIn, WBNB as Address, pathOut]; // bridge through WBNB
        } else {
            path = [pathIn, pathOut];
        }

        // Get on-chain quote for minOut
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
        let minOut = 0n;
        try {
            const amounts = await publicClient.readContract({
                address: router,
                abi: GET_AMOUNTS_OUT_ABI,
                functionName: "getAmountsOut",
                args: [amountIn, path],
            });
            const expectedOut = amounts[amounts.length - 1];
            minOut = (expectedOut * BigInt(100 - slippage)) / 100n;
            output({
                status: "info",
                message: `Quote: ${amountIn.toString()} ${opts.from} → ~${expectedOut.toString()} ${opts.to} (minOut with ${slippage}% slippage: ${minOut.toString()})`,
            });
        } catch {
            output({ status: "error", message: "Failed to get on-chain quote. The token pair may lack liquidity." });
            process.exit(1);
        }

        // Build swap payload
        const actions: Action[] = [];

        // Auto-approve if ERC20 input
        if (!isNativeIn) {
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
                // If allowance check fails, add approve anyway
                const approveData = encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: "approve",
                    args: [router, amountIn],
                });
                actions.push({ target: fromToken.address, value: 0n, data: approveData });
            }
        }

        // Swap calldata
        if (isNativeIn) {
            const data = encodeFunctionData({
                abi: SWAP_EXACT_ETH_ABI,
                functionName: "swapExactETHForTokens",
                args: [minOut, path, vault, deadline],
            });
            actions.push({ target: router, value: amountIn, data });
        } else {
            const data = encodeFunctionData({
                abi: SWAP_EXACT_TOKENS_ABI,
                functionName: "swapExactTokensForTokens",
                args: [amountIn, minOut, path, vault, deadline],
            });
            actions.push({ target: router, value: 0n, data });
        }

        // Validate all actions
        for (const action of actions) {
            const simResult = await client.validate(tokenId, action);
            if (!simResult.ok) {
                output({ status: "rejected", reason: simResult.reason });
                process.exit(0);
            }
        }

        // Execute (skip internal re-validation)
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
        output({ status: "error", message });
        process.exit(1);
    }
});

// ── Subcommand: raw (original low-level mode) ───────────
const rawCmd = new Command("raw")
    .description("Execute a raw transaction (advanced: you provide the calldata)")
    .requiredOption("-t, --target <address>", "Target contract address")
    .requiredOption("-d, --data <hex>", "Calldata hex")
    .option("-v, --value <number>", "Native BNB value in wei", "0")
    .option("-b, --batch", "Batch mode: read actions from --actions JSON array")
    .option("-a, --actions <json>", "JSON array of actions for batch mode");
addSharedOptions(rawCmd);

rawCmd.action(async (opts) => {
    try {
        const client = createClient(opts);
        const tokenId = BigInt(opts.tokenId);

        let actions: Action[];

        if (opts.batch) {
            if (!opts.actions) {
                output({ status: "error", message: "--actions JSON is required in batch mode" });
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
        output({ status: "error", message });
        process.exit(1);
    }
});

// ── Subcommand: tokens ──────────────────────────────────
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

// ── Subcommand: init (DEPRECATED — uses same key for owner+operator) ──
const initCmd = new Command("init")
    .description("[DEPRECATED] One-click setup — uses same key as owner AND operator. Use setup-guide instead.")
    .requiredOption("-l, --listing-id <bytes32>", "Template listing ID (bytes32 hex)")
    .requiredOption("-d, --days <number>", "Number of days to rent")
    .option("-f, --fund <bnb>", "BNB to deposit into vault (human-readable, e.g. 0.1)", "0")
    .option("--i-understand-the-risk", "Acknowledge the security risk of using same key for owner and operator")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC)
    .option("--listing-manager <address>", "ListingManagerV2 address", DEFAULT_LISTING_MANAGER)
    .option("--nfa-address <address>", "AgentNFA contract address", DEFAULT_NFA);

initCmd.action(async (opts) => {
    try {
        // Deprecation guard
        if (!opts.iUnderstandTheRisk) {
            output({
                status: "error",
                message: "⚠️  DEPRECATED: 'init' uses the same private key as both owner AND operator. " +
                    "If this key is leaked (e.g. via AI prompt injection), an attacker can withdraw ALL vault funds. " +
                    "Use 'setup-guide' instead for a secure dual-wallet setup. " +
                    "If you understand the risk and still want to proceed, add --i-understand-the-risk.",
            });
            process.exit(1);
        }

        // Validate private key
        if (!process.env.RUNNER_PRIVATE_KEY) {
            output({ status: "error", message: "RUNNER_PRIVATE_KEY environment variable is missing" });
            process.exit(1);
        }
        const privateKey = toHex(process.env.RUNNER_PRIVATE_KEY);
        const account = privateKeyToAccount(privateKey);
        const rpcUrl = opts.rpc || DEFAULT_RPC;

        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
        const walletClient = createWalletClient({
            account,
            chain: bsc,
            transport: http(rpcUrl),
        });

        const listingManagerAddr = toHex(opts.listingManager || DEFAULT_LISTING_MANAGER) as Address;
        const nfaAddr = toHex(opts.nfaAddress || DEFAULT_NFA) as Address;
        const listingId = opts.listingId as Hex;
        const daysToRent = Number(opts.days);

        // Step 0: Query listing to get pricePerDay
        output({ status: "info", message: `Querying listing ${listingId.slice(0, 10)}...` });
        const listing = await publicClient.readContract({
            address: listingManagerAddr,
            abi: LISTING_MANAGER_ABI,
            functionName: "listings",
            args: [listingId],
        });

        const [, , , pricePerDay, minDays, active] = listing;
        if (!active) {
            output({ status: "error", message: "Listing is not active" });
            process.exit(1);
        }
        if (daysToRent < minDays) {
            output({ status: "error", message: `Minimum rental is ${minDays} days, you requested ${daysToRent}` });
            process.exit(1);
        }

        const totalRent = BigInt(pricePerDay) * BigInt(daysToRent);
        output({ status: "info", message: `Rent cost: ${totalRent.toString()} wei for ${daysToRent} days` });

        // Step 1: Rent (mint instance)
        output({ status: "info", message: "Step 1/3: Renting agent (rentToMintWithParams)..." });
        const rentHash = await walletClient.writeContract({
            address: listingManagerAddr,
            abi: LISTING_MANAGER_ABI,
            functionName: "rentToMintWithParams",
            args: [listingId, daysToRent, 1, 1, "0x01"],
            value: totalRent,
        });

        output({ status: "info", message: `Rent tx submitted: ${rentHash}` });
        const rentReceipt = await publicClient.waitForTransactionReceipt({ hash: rentHash });

        // Extract minted tokenId from InstanceRented event
        let tokenId: bigint | null = null;
        let vaultAddress: Address | null = null;
        for (const log of rentReceipt.logs) {
            if (log.address.toLowerCase() !== listingManagerAddr.toLowerCase()) continue;
            try {
                const decoded = decodeEventLog({
                    abi: LISTING_MANAGER_ABI,
                    data: log.data,
                    topics: log.topics,
                    strict: false,
                });
                if (decoded.eventName === "InstanceRented" && decoded.args) {
                    const args = decoded.args as {
                        instanceTokenId?: bigint;
                        instanceAccount?: Address;
                    };
                    if (args.instanceTokenId !== undefined) {
                        tokenId = args.instanceTokenId;
                        vaultAddress = args.instanceAccount || null;
                        break;
                    }
                }
            } catch { /* skip non-matching logs */ }
        }

        if (tokenId === null) {
            output({ status: "error", message: "Failed to extract tokenId from rent transaction" });
            process.exit(1);
        }

        output({ status: "info", message: `Agent minted! Token ID: ${tokenId.toString()}, Vault: ${vaultAddress}` });

        // Step 2: setOperator (authorize self)
        output({ status: "info", message: "Step 2/3: Authorizing self as operator (setOperator)..." });
        const rentExpires = BigInt(Math.floor(Date.now() / 1000) + daysToRent * 86400);
        const opHash = await walletClient.writeContract({
            address: nfaAddr,
            abi: AGENT_NFA_ABI,
            functionName: "setOperator",
            args: [tokenId, account.address, rentExpires],
        });
        await publicClient.waitForTransactionReceipt({ hash: opHash });
        output({ status: "info", message: `Operator set: ${account.address}` });

        // Step 3: Fund vault (optional)
        const fundBnb = opts.fund || "0";
        if (fundBnb !== "0") {
            output({ status: "info", message: `Step 3/3: Funding vault with ${fundBnb} BNB...` });
            const fundValue = parseEther(fundBnb);
            const fundHash = await walletClient.writeContract({
                address: nfaAddr,
                abi: AGENT_NFA_ABI,
                functionName: "fundAgent",
                args: [tokenId],
                value: fundValue,
            });
            await publicClient.waitForTransactionReceipt({ hash: fundHash });
            output({ status: "info", message: `Vault funded with ${fundBnb} BNB` });
        } else {
            output({ status: "info", message: "Step 3/3: Skipped (no --fund specified)" });
        }

        // Done!
        output({
            status: "success",
            tokenId: tokenId.toString(),
            vault: vaultAddress,
            operator: account.address,
            rentTx: rentHash,
            message: `Agent #${tokenId} is ready! Use: shll-onchain-runner swap --from BNB --to USDC --amount 0.1 --token-id ${tokenId}`,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        output({ status: "error", message });
        process.exit(1);
    }
});

// ── DexScreener API helpers ─────────────────────────────
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

// ── ERC20 balanceOf ABI ─────────────────────────────────
const ERC20_BALANCE_ABI = [{
    type: "function" as const, name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view" as const,
}] as const;

// ── Subcommand: portfolio ───────────────────────────────
const portfolioCmd = new Command("portfolio")
    .description("Query vault BNB balance, ERC20 holdings, and USD values")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC)
    .option("--nfa-address <address>", "AgentNFA contract address", DEFAULT_NFA);

portfolioCmd.action(async (opts) => {
    try {
        const rpcUrl = opts.rpc || DEFAULT_RPC;
        const nfaAddr = toHex(opts.nfaAddress || DEFAULT_NFA) as Address;
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
        output({ status: "error", message });
        process.exit(1);
    }
});

// ── Subcommand: price ───────────────────────────────────
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
        output({ status: "error", message });
        process.exit(1);
    }
});

// ── Subcommand: search ──────────────────────────────────
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
        output({ status: "error", message });
        process.exit(1);
    }
});

// ── WBNB ABI fragments (wrap/unwrap) ────────────────────
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

// ── ERC20 transfer ABI ──────────────────────────────────
const ERC20_TRANSFER_ABI = [{
    type: "function" as const, name: "transfer",
    inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable" as const,
}] as const;

// ── Subcommand: wrap ────────────────────────────────────
const wrapCmd = new Command("wrap")
    .description("Wrap BNB → WBNB (from vault balance)")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .requiredOption("-a, --amount <bnb>", "BNB amount to wrap (human-readable)")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC)
    .option("--nfa-address <address>", "AgentNFA contract address", DEFAULT_NFA)
    .option("--guard-address <address>", "PolicyGuard contract address", DEFAULT_GUARD);

wrapCmd.action(async (opts) => {
    try {
        if (!process.env.RUNNER_PRIVATE_KEY) {
            output({ status: "error", message: "RUNNER_PRIVATE_KEY environment variable is missing" });
            process.exit(1);
        }
        const client = new PolicyClient({
            operatorPrivateKey: toHex(process.env.RUNNER_PRIVATE_KEY),
            rpcUrl: opts.rpc || DEFAULT_RPC,
            policyGuardAddress: toHex(opts.guardAddress || DEFAULT_GUARD) as Address,
            agentNfaAddress: toHex(opts.nfaAddress || DEFAULT_NFA) as Address,
        });
        const tokenId = BigInt(opts.tokenId);
        const amount = parseEther(opts.amount);
        const wbnbAddr = toHex(process.env.WBNB_ADDRESS || WBNB) as Address;

        // WBNB.deposit() — sends BNB from vault to WBNB contract, receives WBNB back
        const calldata = encodeFunctionData({
            abi: WBNB_ABI,
            functionName: "deposit",
        });

        output({ status: "info", message: `Wrapping ${opts.amount} BNB → WBNB...` });
        const action: Action = { target: wbnbAddr, value: amount, data: calldata };

        const validation = await client.validate(tokenId, action);
        if (!validation.ok) {
            output({ status: "rejected", reason: validation.reason });
            process.exit(1);
        }

        const result = await client.execute(tokenId, action, true);
        output({ status: "success", tx: result.hash, message: `Wrapped ${opts.amount} BNB → WBNB` });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        output({ status: "error", message });
        process.exit(1);
    }
});

// ── Subcommand: unwrap ──────────────────────────────────
const unwrapCmd = new Command("unwrap")
    .description("Unwrap WBNB → BNB (to vault)")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .requiredOption("-a, --amount <bnb>", "WBNB amount to unwrap (human-readable)")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC)
    .option("--nfa-address <address>", "AgentNFA contract address", DEFAULT_NFA)
    .option("--guard-address <address>", "PolicyGuard contract address", DEFAULT_GUARD);

unwrapCmd.action(async (opts) => {
    try {
        if (!process.env.RUNNER_PRIVATE_KEY) {
            output({ status: "error", message: "RUNNER_PRIVATE_KEY environment variable is missing" });
            process.exit(1);
        }
        const client = new PolicyClient({
            operatorPrivateKey: toHex(process.env.RUNNER_PRIVATE_KEY),
            rpcUrl: opts.rpc || DEFAULT_RPC,
            policyGuardAddress: toHex(opts.guardAddress || DEFAULT_GUARD) as Address,
            agentNfaAddress: toHex(opts.nfaAddress || DEFAULT_NFA) as Address,
        });
        const tokenId = BigInt(opts.tokenId);
        const amount = parseEther(opts.amount);
        const wbnbAddr = toHex(process.env.WBNB_ADDRESS || WBNB) as Address;

        // WBNB.withdraw(uint256) — burns WBNB, vault receives BNB
        const calldata = encodeFunctionData({
            abi: WBNB_ABI,
            functionName: "withdraw",
            args: [amount],
        });

        output({ status: "info", message: `Unwrapping ${opts.amount} WBNB → BNB...` });
        const action: Action = { target: wbnbAddr, value: 0n, data: calldata };

        const validation = await client.validate(tokenId, action);
        if (!validation.ok) {
            output({ status: "rejected", reason: validation.reason });
            process.exit(1);
        }

        const result = await client.execute(tokenId, action, true);
        output({ status: "success", tx: result.hash, message: `Unwrapped ${opts.amount} WBNB → BNB` });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        output({ status: "error", message });
        process.exit(1);
    }
});

// ── Subcommand: transfer ────────────────────────────────
const transferCmd = new Command("transfer")
    .description("Transfer ERC20 tokens or BNB from vault to a recipient")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .requiredOption("-t, --token <symbol>", "Token symbol (e.g. USDC) or 0x address, use BNB for native")
    .requiredOption("-a, --amount <value>", "Amount to transfer (human-readable)")
    .requiredOption("--to <address>", "Recipient address")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC)
    .option("--nfa-address <address>", "AgentNFA contract address", DEFAULT_NFA)
    .option("--guard-address <address>", "PolicyGuard contract address", DEFAULT_GUARD);

transferCmd.action(async (opts) => {
    try {
        if (!process.env.RUNNER_PRIVATE_KEY) {
            output({ status: "error", message: "RUNNER_PRIVATE_KEY environment variable is missing" });
            process.exit(1);
        }
        const client = new PolicyClient({
            operatorPrivateKey: toHex(process.env.RUNNER_PRIVATE_KEY),
            rpcUrl: opts.rpc || DEFAULT_RPC,
            policyGuardAddress: toHex(opts.guardAddress || DEFAULT_GUARD) as Address,
            agentNfaAddress: toHex(opts.nfaAddress || DEFAULT_NFA) as Address,
        });
        const tokenId = BigInt(opts.tokenId);
        const recipient = toHex(opts.to) as Address;
        const tokenInfo = resolveToken(opts.token);
        const amount = parseEther(opts.amount); // works for 18-decimal tokens

        let action: Action;
        const isBNB = tokenInfo.address === "0x0000000000000000000000000000000000000000";

        if (isBNB) {
            // Native BNB transfer — empty calldata, value = amount
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
        output({ status: "error", message });
        process.exit(1);
    }
});

// ── Policy Configuration ABI fragments ──────────────────
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

// ── Subcommand: policies ────────────────────────────────
const policiesCmd = new Command("policies")
    .description("View all active policies and current settings for an Agent")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC)
    .option("--nfa-address <address>", "AgentNFA contract address", DEFAULT_NFA)
    .option("--guard-address <address>", "PolicyGuard contract address", DEFAULT_GUARD);

policiesCmd.action(async (opts) => {
    try {
        const client = createPolicyClient(opts);
        const tokenId = BigInt(opts.tokenId);
        const rpcUrl = opts.rpc || DEFAULT_RPC;
        const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });

        const policies = await client.getPolicies(tokenId);

        // Enrich with current config for configurable policies
        const enriched = [];
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
                    entry.currentConfig = {
                        maxPerTx: maxPerTx.toString(),
                        maxPerTxBnb: (Number(maxPerTx) / 1e18).toFixed(4),
                        maxPerDay: maxPerDay.toString(),
                        maxPerDayBnb: (Number(maxPerDay) / 1e18).toFixed(4),
                        maxSlippageBps: maxSlippageBps.toString(),
                    };
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
                    entry.currentConfig = { cooldownSeconds: (cd as bigint).toString() };
                } catch { /* policy read failed */ }
            }

            enriched.push(entry);
        }

        output({ status: "success", tokenId: tokenId.toString(), policies: enriched });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        output({ status: "error", message });
        process.exit(1);
    }
});

// ── Subcommand: config ──────────────────────────────────
const configCmd = new Command("config")
    .description("Configure risk parameters (spending limits, cooldown)")
    .requiredOption("-k, --token-id <number>", "Agent NFA Token ID")
    .option("--tx-limit <bnb>", "Max BNB per transaction (human-readable)")
    .option("--daily-limit <bnb>", "Max BNB per day (human-readable)")
    .option("--cooldown <seconds>", "Minimum seconds between transactions")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC)
    .option("--nfa-address <address>", "AgentNFA contract address", DEFAULT_NFA)
    .option("--guard-address <address>", "PolicyGuard contract address", DEFAULT_GUARD);

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
        output({ status: "error", message });
        process.exit(1);
    }
});

// -- Subcommand: listings (query available agent templates) --------
const DEFAULT_INDEXER = "https://indexer.shll.run";

const listingsCmd = new Command("listings")
    .description("List all available agent templates for rent")
    .option("--indexer <url>", "Indexer API URL", DEFAULT_INDEXER)
    .action(async (opts) => {
        try {
            const indexerUrl = opts.indexer || DEFAULT_INDEXER;
            const res = await fetch(`${indexerUrl}/api/listings`);
            if (!res.ok) {
                output({ status: "error", message: `Indexer returned ${res.status}` });
                process.exit(1);
            }
            const data = await res.json() as {
                items: Array<{
                    id: string;
                    agentName: string;
                    agentType: string;
                    pricePerDay: string;
                    minDays: number;
                    active: boolean;
                    nfa: string;
                    tokenId: string;
                    owner: string;
                }>;
                count: number;
            };

            const available = data.items.filter((l) => l.active);
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
                hint: "Use the listingId with setup-guide: shll-run setup-guide --listing-id <ID> --days <N>",
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error";
            output({ status: "error", message });
            process.exit(1);
        }
    });

// -- Subcommand: setup-guide (secure dual-wallet onboarding) ------
const setupGuideCmd = new Command("setup-guide")
    .description("Output step-by-step instructions for secure dual-wallet agent setup")
    .option("-l, --listing-id <bytes32>", "Template listing ID (bytes32 hex)", DEFAULT_LISTING_ID)
    .option("-d, --days <number>", "Number of days to rent", "1")
    .option("-r, --rpc <url>", "BSC RPC URL", DEFAULT_RPC)
    .option("--listing-manager <address>", "ListingManagerV2 address", DEFAULT_LISTING_MANAGER)
    .option("--nfa-address <address>", "AgentNFA contract address", DEFAULT_NFA);

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
        const listingManagerAddr = toHex(opts.listingManager || DEFAULT_LISTING_MANAGER) as Address;
        const nfaAddr = toHex(opts.nfaAddress || DEFAULT_NFA) as Address;
        const listingId = opts.listingId as string;
        const daysToRent = Number(opts.days);

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
                output({ status: "error", message: "Listing is not active" });
                process.exit(1);
            }
            if (daysToRent < minDays) {
                output({ status: "error", message: `Minimum rental is ${minDays} days, you requested ${daysToRent}` });
                process.exit(1);
            }
            const totalRent = BigInt(pricePerDay) * BigInt(daysToRent);
            rentCost = `${(Number(totalRent) / 1e18).toFixed(6)} BNB`;
            priceInfo = ` (${totalRent.toString()} wei)`;
        } catch {
            rentCost = "unable to query — check listing-id";
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
            rentCost: `${rentCost}${priceInfo}`,
            steps: [
                {
                    step: 1,
                    title: "Open SHLL Setup Page",
                    action: `Open ${setupUrl} in your browser`,
                    note: "Connect YOUR wallet (MetaMask/WalletConnect). This is your owner wallet — keep it safe and offline after setup.",
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
                    action: "Click 'Authorize Operator' — this gives the AI wallet permission to trade within PolicyGuard safety limits",
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
        output({ status: "error", message });
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
            note: "SAVE THIS PRIVATE KEY SECURELY. This is the OPERATOR wallet — it can only trade within PolicyGuard limits. " +
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
                output({ status: "error", message: "RUNNER_PRIVATE_KEY not set. Run `generate-wallet` first to create one." });
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
            output({ status: "error", message });
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
program.parse(process.argv);

