/**
 * SHLL Shared Security Utilities - Access checks, recipient validation, and policy helpers.
 * These functions are critical for preventing unauthorized operations and recipient redirection attacks.
 */
import { decodeFunctionData, type Address, type Hex } from "viem";
import type { Action } from "shll-policy-sdk";
import { DEFAULT_NFA } from "./constants.js";
import { AGENT_NFA_ACCESS_ABI, ERC20_ABI, ERC20_TRANSFER_ABI, WBNB_ABI, VTOKEN_ABI, VBNB_MINT_ABI } from "./abi.js";
import { SWAP_EXACT_ETH_ABI, SWAP_EXACT_TOKENS_ABI, SWAP_EXACT_TOKENS_FOR_ETH_ABI } from "./abi.js";
import { SWAP_EXACT_ETH_FOR_TOKENS_FEE_ABI, SWAP_EXACT_TOKENS_FOR_TOKENS_FEE_ABI, SWAP_EXACT_TOKENS_FOR_ETH_FEE_ABI } from "./abi.js";
import { V3_EXACT_INPUT_SINGLE_ABI, V3_EXACT_INPUT_ABI } from "./abi.js";
import { toHex, agentConsoleUrl, createReadOnlyClient } from "./clients.js";
import { privateKeyToAccount } from "viem/accounts";
import type { RecipientCheckResult } from "./types.js";

/**
 * Pre-flight access check: verifies operator authorization and subscription expiry.
 * Returns a structured result that can be used by both CLI and MCP.
 * Accepts an optional publicClient to avoid creating a redundant one.
 */
export async function checkAccess(
    rpcUrl: string | undefined,
    tokenId: bigint,
    existingPublicClient?: any,
): Promise<{
    blocked: boolean;
    errorType?: "subscription_expired" | "operator_expired" | "unauthorized";
    message?: string;
    details?: Record<string, unknown>;
}> {
    const pkRaw = process.env.RUNNER_PRIVATE_KEY;
    if (!pkRaw) {
        return {
            blocked: true,
            errorType: "unauthorized",
            message: "RUNNER_PRIVATE_KEY environment variable is not set. Cannot verify operator access.",
            details: { howToFix: ["Set RUNNER_PRIVATE_KEY to your operator wallet private key", "Run 'generate_wallet' to create one"] },
        };
    }

    const nfa = DEFAULT_NFA as Address;
    const pk = toHex(pkRaw);
    const account = privateKeyToAccount(pk);
    const pc = existingPublicClient || createReadOnlyClient(rpcUrl);

    const [operatorExpires, userExpires, operator, renter, owner] = await Promise.all([
        pc.readContract({ address: nfa, abi: AGENT_NFA_ACCESS_ABI, functionName: "operatorExpiresOf", args: [tokenId] }) as Promise<bigint>,
        pc.readContract({ address: nfa, abi: AGENT_NFA_ACCESS_ABI, functionName: "userExpires", args: [tokenId] }) as Promise<bigint>,
        pc.readContract({ address: nfa, abi: AGENT_NFA_ACCESS_ABI, functionName: "operatorOf", args: [tokenId] }) as Promise<Address>,
        pc.readContract({ address: nfa, abi: AGENT_NFA_ACCESS_ABI, functionName: "userOf", args: [tokenId] }) as Promise<Address>,
        pc.readContract({ address: nfa, abi: AGENT_NFA_ACCESS_ABI, functionName: "ownerOf", args: [tokenId] }) as Promise<Address>,
    ]);

    const now = BigInt(Math.floor(Date.now() / 1000));

    if (now > userExpires) {
        return {
            blocked: true,
            errorType: "subscription_expired",
            message: `Agent token-id ${tokenId} subscription has EXPIRED (expired at ${new Date(Number(userExpires) * 1000).toISOString()}).`,
            details: { expiredAt: new Date(Number(userExpires) * 1000).toISOString(), action: "renew" },
        };
    }

    if (now > operatorExpires) {
        return {
            blocked: true,
            errorType: "operator_expired",
            message: `Agent token-id ${tokenId} operator authorization has EXPIRED (expired at ${new Date(Number(operatorExpires) * 1000).toISOString()}).`,
            details: { expiredAt: new Date(Number(operatorExpires) * 1000).toISOString(), consoleUrl: agentConsoleUrl(tokenId) },
        };
    }

    const runnerAddr = account.address.toLowerCase();
    const isOperator = operator.toLowerCase() === runnerAddr;
    const isRenter = renter.toLowerCase() === runnerAddr;
    const isOwner = owner.toLowerCase() === runnerAddr;

    if (!isOperator && !isRenter && !isOwner) {
        return {
            blocked: true,
            errorType: "unauthorized",
            message: `RUNNER_PRIVATE_KEY wallet (${account.address}) is NOT authorized for token-id ${tokenId}. On-chain operator is ${operator}.`,
            details: {
                yourWallet: account.address,
                onChainOperator: operator,
                onChainRenter: renter,
                onChainOwner: owner,
                consoleUrl: agentConsoleUrl(tokenId),
                howToFix: [
                    `1. Use 'setup_guide' command to generate an OperatorPermit for this wallet`,
                    `2. Subscriber (${renter}) can call setOperator(${tokenId}, ${account.address}, <expiry>) on AgentNFA`,
                    `3. Go to ${agentConsoleUrl(tokenId)} to set operator`,
                    `4. Use the correct RUNNER_PRIVATE_KEY for operator ${operator}`,
                ],
            },
        };
    }

    return { blocked: false };
}

/**
 * MCP-specific wrapper: checks access and returns a tool-ready response if blocked.
 * Eliminates the need for duplicated checkAgentExpiry in every tool file.
 */
export async function checkAgentExpiryMcp(
    tokenId: bigint,
    publicClient?: any,
): Promise<{ blocked: false } | { blocked: true; content: Array<{ type: "text"; text: string }> }> {
    const res = await checkAccess(undefined, tokenId, publicClient);
    if (res.blocked) {
        return {
            blocked: true,
            content: [{ type: "text" as const, text: JSON.stringify({ status: "error", message: res.message, details: res.details }) }],
        };
    }
    return { blocked: false };
}

/** Try to decode function call data using a given ABI */
export function tryDecodeCalldata(abi: readonly unknown[], data: Hex) {
    try {
        return decodeFunctionData({ abi: abi as never, data });
    } catch {
        return null;
    }
}

/**
 * Verify that a transaction's recipient matches the agent vault.
 * Prevents recipient redirection attacks by decoding calldata and checking
 * the embedded recipient argument against the known vault address.
 */
export function checkActionRecipientSafety(action: Action, vault: Address): RecipientCheckResult {
    const vaultLower = vault.toLowerCase();
    const targetLower = action.target.toLowerCase();
    const data = action.data as Hex;

    // Native transfer: recipient is the target itself
    if (data === "0x") {
        if (targetLower !== vaultLower) {
            return { ok: false, reason: `Native transfer target ${action.target} does not match vault ${vault}.` };
        }
        return { ok: true, checkedRecipient: action.target, mode: "direct" };
    }

    // V2: swapExactETHForTokens
    const swapEth = tryDecodeCalldata(SWAP_EXACT_ETH_ABI, data);
    if (swapEth?.functionName === "swapExactETHForTokens") {
        const recipient = swapEth.args?.[2] as Address | undefined;
        if (!recipient) return { ok: false, reason: "Decoded swapExactETHForTokens calldata but recipient was missing." };
        return recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: recipient, mode: "decoded" }
            : { ok: false, reason: `swapExactETHForTokens recipient ${recipient} does not match vault ${vault}.` };
    }

    // V2: swapExactTokensForTokens
    const swapTokens = tryDecodeCalldata(SWAP_EXACT_TOKENS_ABI, data);
    if (swapTokens?.functionName === "swapExactTokensForTokens") {
        const recipient = swapTokens.args?.[3] as Address | undefined;
        if (!recipient) return { ok: false, reason: "Decoded swapExactTokensForTokens calldata but recipient was missing." };
        return recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: recipient, mode: "decoded" }
            : { ok: false, reason: `swapExactTokensForTokens recipient ${recipient} does not match vault ${vault}.` };
    }

    // V2: swapExactTokensForETH
    const swapTokensForEth = tryDecodeCalldata(SWAP_EXACT_TOKENS_FOR_ETH_ABI, data);
    if (swapTokensForEth?.functionName === "swapExactTokensForETH") {
        const recipient = swapTokensForEth.args?.[3] as Address | undefined;
        if (!recipient) return { ok: false, reason: "Decoded swapExactTokensForETH calldata but recipient was missing." };
        return recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: recipient, mode: "decoded" }
            : { ok: false, reason: `swapExactTokensForETH recipient ${recipient} does not match vault ${vault}.` };
    }

    // Fee-on-transfer variants
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

    // V3: exactInputSingle
    const v3Single = tryDecodeCalldata(V3_EXACT_INPUT_SINGLE_ABI, data);
    if (v3Single?.functionName === "exactInputSingle") {
        const params = v3Single.args?.[0] as { recipient?: Address } | undefined;
        if (!params?.recipient) return { ok: false, reason: "Decoded exactInputSingle calldata but recipient was missing." };
        return params.recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: params.recipient, mode: "decoded" }
            : { ok: false, reason: `exactInputSingle recipient ${params.recipient} does not match vault ${vault}.` };
    }

    // V3: exactInput
    const v3ExactInput = tryDecodeCalldata(V3_EXACT_INPUT_ABI, data);
    if (v3ExactInput?.functionName === "exactInput") {
        const params = v3ExactInput.args?.[0] as { recipient?: Address } | undefined;
        if (!params?.recipient) return { ok: false, reason: "Decoded exactInput calldata but recipient was missing." };
        return params.recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: params.recipient, mode: "decoded" }
            : { ok: false, reason: `exactInput recipient ${params.recipient} does not match vault ${vault}.` };
    }

    // ERC20 transfer
    const transfer = tryDecodeCalldata(ERC20_TRANSFER_ABI, data);
    if (transfer?.functionName === "transfer") {
        const recipient = transfer.args?.[0] as Address | undefined;
        if (!recipient) return { ok: false, reason: "Decoded ERC20 transfer calldata but recipient was missing." };
        return recipient.toLowerCase() === vaultLower
            ? { ok: true, checkedRecipient: recipient, mode: "decoded" }
            : { ok: false, reason: `ERC20 transfer recipient ${recipient} does not match vault ${vault}.` };
    }

    // Known safe no-recipient calls (approve/deposit/withdraw/redeem/supply)
    if (tryDecodeCalldata(ERC20_ABI, data)?.functionName === "approve") return { ok: true, mode: "no-recipient" };
    if (tryDecodeCalldata(WBNB_ABI, data)) return { ok: true, mode: "no-recipient" };
    if (tryDecodeCalldata(VTOKEN_ABI, data)) return { ok: true, mode: "no-recipient" };
    if (tryDecodeCalldata(VBNB_MINT_ABI, data)) return { ok: true, mode: "no-recipient" };

    return {
        ok: false,
        reason: "Unable to decode recipient from calldata. Blocked by default to prevent recipient redirection risk.",
    };
}

/**
 * Get actionable user guidance for a specific policy rejection reason.
 * Maps on-chain policy error messages to human-readable explanations.
 */
export function policyRejectionHelp(reason: string | undefined, tokenId: string): Record<string, string> {
    const consoleUrl = agentConsoleUrl(tokenId);
    const r = reason ?? "";
    if (r.includes("Function not allowed"))
        return { explanation: "The contract method selector is not enabled by the active DeFi policy configuration.", action: "Enable the required protocol pack or selector in Console > Safety, or use a supported transaction path.", consoleUrl };
    if (r.includes("Approve spender not allowed"))
        return { explanation: "The DEX router address is not in the approved spender whitelist.", action: "Contact the Agent owner to approve this router, or use a different DEX.", consoleUrl };
    if (r.includes("Target not allowed"))
        return { explanation: "The contract address is not in the DeFi target whitelist.", action: "Enable the corresponding DeFi Pack in Console > Safety, or contact the Agent owner.", consoleUrl };
    if (r.includes("Receiver must be vault"))
        return { explanation: "Swap output recipient must be the agent vault address enforced by ReceiverGuard.", action: "Retry with recipient/to set to the vault address, or use a supported flow that routes proceeds back to the vault.", consoleUrl };
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

// === Listing resolution helpers ===
const LISTING_ID_REGEX = /^0x[0-9a-fA-F]{64}$/;

export function isValidListingId(value: string): boolean {
    return LISTING_ID_REGEX.test(value);
}

export function toSafeInt(value: unknown, fallback: number): number {
    if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    return fallback;
}
