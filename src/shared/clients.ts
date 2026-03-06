/**
 * SHLL Shared Client Setup - PolicyClient and viem client factories.
 * Used by both CLI and MCP entry points.
 */
import { createPublicClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { bsc } from "viem/chains";
import { PolicyClient } from "shll-policy-sdk";
import { DEFAULT_NFA, DEFAULT_GUARD, DEFAULT_RPC, MEV_PROTECTED_RPC } from "./constants.js";

/** Normalize a string to 0x-prefixed Hex */
export function toHex(s: string): Hex {
    return (s.startsWith("0x") ? s : `0x${s}`) as Hex;
}

/** Build a URL for the agent safety console */
export function agentConsoleUrl(tokenId: string | bigint): string {
    return `https://shll.run/agent/${DEFAULT_NFA}/${tokenId.toString()}/console/safety`;
}

/**
 * Create all required clients for a DeFi operation.
 * Read operations use the public RPC (fast). Write operations (PolicyClient)
 * use SHLL_RPC > MEV_PROTECTED_RPC > DEFAULT_RPC to avoid mempool exposure.
 */
export function createClients(rpcUrl?: string) {
    const privateKey = process.env.RUNNER_PRIVATE_KEY;
    if (!privateKey) throw new Error("RUNNER_PRIVATE_KEY environment variable is required");

    const readRpc = rpcUrl || process.env.SHLL_RPC || DEFAULT_RPC;
    const writeRpc = rpcUrl || process.env.SHLL_RPC || MEV_PROTECTED_RPC;
    const account = privateKeyToAccount(toHex(privateKey));
    const publicClient = createPublicClient({
        chain: bsc,
        transport: http(readRpc),
        batch: { multicall: true }
    });
    const policyClient = new PolicyClient({
        agentNfaAddress: toHex(DEFAULT_NFA) as Address,
        policyGuardAddress: toHex(DEFAULT_GUARD) as Address,
        operatorPrivateKey: toHex(privateKey),
        rpcUrl: writeRpc,
        chainId: 56,
    });
    return { account, publicClient, policyClient, rpc: writeRpc };
}

export { generatePrivateKey, privateKeyToAccount };

/** Create a read-only public client (no private key required). For query-only tools. */
export function createReadOnlyClient(rpcUrl?: string) {
    const rpc = rpcUrl || process.env.SHLL_RPC || DEFAULT_RPC;
    return createPublicClient({
        chain: bsc,
        transport: http(rpc),
        batch: { multicall: true },
    });
}
