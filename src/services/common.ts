import type { Action, PolicyClient } from "shll-policy-sdk";
import { isAddress, type Address } from "viem";
import {
    checkAccess,
    ERC20_ABI,
    FOUR_MEME_V1_ABI,
    FOUR_MEME_V2_ABI,
    policyRejectionHelp,
    SWAP_EXACT_ETH_ABI,
    SWAP_EXACT_ETH_FOR_TOKENS_FEE_ABI,
    SWAP_EXACT_TOKENS_ABI,
    SWAP_EXACT_TOKENS_FOR_ETH_ABI,
    SWAP_EXACT_TOKENS_FOR_ETH_FEE_ABI,
    SWAP_EXACT_TOKENS_FOR_TOKENS_FEE_ABI,
    tryDecodeCalldata,
    type RecipientCheckResult,
    V3_EXACT_INPUT_ABI,
    V3_EXACT_INPUT_SINGLE_ABI,
    VBNB_MINT_ABI,
    VTOKEN_ABI,
    WBNB_ABI,
} from "../shared/index.js";
import { SkillError } from "../shared/errors.js";

export function parseTokenId(tokenId: string): bigint {
    try {
        const parsed = BigInt(tokenId);
        if (parsed < 0n) {
            throw new Error("negative token id");
        }
        return parsed;
    } catch {
        throw new SkillError("INVALID_INPUT", `Invalid token_id: ${tokenId}`);
    }
}

export function assertPositiveAmount(value: bigint, fieldName = "amount"): void {
    if (value <= 0n) {
        throw new SkillError("INVALID_INPUT", `Invalid ${fieldName}`, { field: fieldName });
    }
}

export function assertAddress(value: string, fieldName = "address"): void {
    if (!isAddress(value)) {
        throw new SkillError("INVALID_INPUT", `Invalid ${fieldName}`, { field: fieldName, value });
    }
}

export async function ensureAccess(tokenId: bigint, rpcUrl?: string, publicClient?: any): Promise<void> {
    const access = await checkAccess(rpcUrl, tokenId, publicClient);
    if (access.blocked) {
        throw new SkillError(
            "ACCESS_DENIED",
            access.message || `Access denied for token_id ${tokenId.toString()}`,
            access.details,
            "Check operator permissions and rental status",
        );
    }
}

export function ensureRecipientSafe(result: RecipientCheckResult): void {
    if (!result.ok) {
        throw new SkillError(
            "INVALID_INPUT",
            "Recipient safety check failed",
            { reason: result.reason },
            "Set recipient/to to your agent vault address",
        );
    }
}

export async function validateActionsOrThrow(
    policyClient: PolicyClient,
    tokenId: bigint,
    actions: Action[],
): Promise<void> {
    for (const [index, action] of actions.entries()) {
        const sim = await policyClient.validate(tokenId, action);
        if (!sim.ok) {
            throw new SkillError(
                "POLICY_REJECTED",
                "Policy rejected transaction",
                {
                    failedActionIndex: index,
                    failedActionTarget: action.target,
                    failedActionSelector: getActionSelector(action),
                    failedActionFunction: getActionFunctionName(action),
                    failedActionValue: action.value.toString(),
                    reason: sim.reason,
                    ...policyRejectionHelp(sim.reason, tokenId.toString()),
                },
                "Adjust your safety policy config and retry",
            );
        }
    }
}

export async function executeActions(
    policyClient: PolicyClient,
    tokenId: bigint,
    actions: Action[],
): Promise<{ hash: Address | string }> {
    if (actions.length === 0) {
        throw new SkillError("INTERNAL_ERROR", "No actions to execute");
    }
    if (actions.length === 1) {
        const result = await policyClient.execute(tokenId, actions[0], true);
        return { hash: result.hash };
    }
    const result = await policyClient.executeBatch(tokenId, actions, true);
    return { hash: result.hash };
}

function getActionSelector(action: Action): string {
    return action.data && action.data.length >= 10 ? action.data.slice(0, 10) : "0x";
}

function getActionFunctionName(action: Action): string {
    if (action.data === "0x") {
        return "nativeTransfer";
    }

    const candidates = [
        ERC20_ABI,
        WBNB_ABI,
        VTOKEN_ABI,
        VBNB_MINT_ABI,
        SWAP_EXACT_ETH_ABI,
        SWAP_EXACT_TOKENS_ABI,
        SWAP_EXACT_TOKENS_FOR_ETH_ABI,
        SWAP_EXACT_ETH_FOR_TOKENS_FEE_ABI,
        SWAP_EXACT_TOKENS_FOR_TOKENS_FEE_ABI,
        SWAP_EXACT_TOKENS_FOR_ETH_FEE_ABI,
        V3_EXACT_INPUT_SINGLE_ABI,
        V3_EXACT_INPUT_ABI,
        FOUR_MEME_V1_ABI,
        FOUR_MEME_V2_ABI,
    ] as const;

    for (const abi of candidates) {
        const decoded = tryDecodeCalldata(abi, action.data);
        if (decoded?.functionName) {
            return decoded.functionName;
        }
    }

    return "unknown";
}
