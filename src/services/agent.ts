import {
    AGENT_NFA_ABI,
    AGENT_NFA_ACCESS_ABI,
    COOLDOWN_ABI,
    DEFAULT_INDEXER,
    DEFAULT_NFA,
    SPENDING_LIMIT_ABI,
    agentConsoleUrl,
    checkAccess,
    createClients,
    createReadOnlyClient,
    privateKeyToAccount,
    toHex,
} from "../shared/index.js";
import { SkillError } from "../shared/errors.js";
import { parseTokenId } from "./common.js";

interface PolicyDescriptor {
    policyTypeName: string;
    address: `0x${string}`;
    renterConfigurable: boolean;
}

const MIN_OPERATOR_GAS_WEI = 1_000_000_000_000_000n;

export async function getPolicySummary(tokenIdRaw: string, rpcUrl?: string) {
    const tokenId = parseTokenId(tokenIdRaw);
    const { publicClient, policyClient } = createClients(rpcUrl);
    const policies = await policyClient.getPolicies(tokenId) as PolicyDescriptor[];

    const enriched = [];
    const summaryParts: string[] = [];

    for (const policy of policies) {
        const entry: Record<string, unknown> = {
            name: policy.policyTypeName,
            address: policy.address,
            configurable: policy.renterConfigurable,
        };

        if (policy.policyTypeName === "spending_limit") {
            try {
                const limits = await publicClient.readContract({
                    address: policy.address,
                    abi: SPENDING_LIMIT_ABI,
                    functionName: "instanceLimits",
                    args: [tokenId],
                }) as [bigint, bigint, bigint];
                const [maxPerTx, maxPerDay, maxSlippageBps] = limits;
                entry.currentConfig = {
                    maxPerTx: maxPerTx.toString(),
                    maxPerTxBnb: (Number(maxPerTx) / 1e18).toFixed(4),
                    maxPerDay: maxPerDay.toString(),
                    maxPerDayBnb: (Number(maxPerDay) / 1e18).toFixed(4),
                    slippage: maxSlippageBps.toString(),
                };
                summaryParts.push(`Max ${(Number(maxPerTx) / 1e18).toFixed(4)} BNB/tx, ${(Number(maxPerDay) / 1e18).toFixed(4)} BNB/day`);
            } catch {
                // ignore unreadable policy config
            }
        }

        if (policy.policyTypeName === "cooldown") {
            try {
                const cooldown = await publicClient.readContract({
                    address: policy.address,
                    abi: COOLDOWN_ABI,
                    functionName: "cooldownSeconds",
                    args: [tokenId],
                }) as bigint;
                entry.currentConfig = { ...(entry.currentConfig as Record<string, unknown> | undefined), cooldownSeconds: Number(cooldown) };
                summaryParts.push(`Cooldown ${Number(cooldown)}s`);
            } catch {
                // ignore unreadable policy config
            }
        }

        if (policy.policyTypeName === "receiver_guard") summaryParts.push("ReceiverGuard On");
        if (policy.policyTypeName === "defi_guard") summaryParts.push("DeFiGuard On");
        enriched.push(entry);
    }

    return {
        tokenId: tokenIdRaw,
        summary: summaryParts.join(" | ") || "No configurable policies",
        policies: enriched,
        manageUrl: agentConsoleUrl(tokenId),
    };
}

export async function readTokenRestriction(tokenIdRaw: string, rpcUrl?: string) {
    const tokenId = parseTokenId(tokenIdRaw);
    const { publicClient, policyClient } = createClients(rpcUrl);
    const policies = await policyClient.getPolicies(tokenId) as PolicyDescriptor[];
    const spendingPolicy = policies.find((policy) => policy.policyTypeName === "spending_limit");

    if (!spendingPolicy) {
        throw new SkillError("NOT_FOUND", "No spending_limit policy found");
    }

    const [enabled, tokenList] = await Promise.all([
        publicClient.readContract({
            address: spendingPolicy.address,
            abi: SPENDING_LIMIT_ABI,
            functionName: "tokenRestrictionEnabled",
            args: [tokenId],
        }) as Promise<boolean>,
        publicClient.readContract({
            address: spendingPolicy.address,
            abi: SPENDING_LIMIT_ABI,
            functionName: "getTokenList",
            args: [tokenId],
        }) as Promise<string[]>,
    ]);

    return {
        tokenId: tokenIdRaw,
        status: enabled ? "ON" : "OFF",
        whitelistedTokens: tokenList,
        count: tokenList.length,
        manageUrl: agentConsoleUrl(tokenId),
    };
}

export async function getStatusOverview(tokenIdRaw: string, rpcUrl?: string) {
    const tokenId = parseTokenId(tokenIdRaw);
    const publicClient = createReadOnlyClient(rpcUrl);
    const vault = await publicClient.readContract({
        address: DEFAULT_NFA,
        abi: AGENT_NFA_ABI,
        functionName: "accountOf",
        args: [tokenId],
    }) as `0x${string}`;
    const [bnbBalance, operatorExpires, userExpires, operator] = await Promise.all([
        publicClient.getBalance({ address: vault }),
        publicClient.readContract({
            address: DEFAULT_NFA,
            abi: AGENT_NFA_ACCESS_ABI,
            functionName: "operatorExpiresOf",
            args: [tokenId],
        }) as Promise<bigint>,
        publicClient.readContract({
            address: DEFAULT_NFA,
            abi: AGENT_NFA_ACCESS_ABI,
            functionName: "userExpires",
            args: [tokenId],
        }) as Promise<bigint>,
        publicClient.readContract({
            address: DEFAULT_NFA,
            abi: AGENT_NFA_ACCESS_ABI,
            functionName: "operatorOf",
            args: [tokenId],
        }) as Promise<`0x${string}`>,
    ]);
    const runnerPrivateKey = process.env.RUNNER_PRIVATE_KEY;
    const runnerAccount = runnerPrivateKey ? privateKeyToAccount(toHex(runnerPrivateKey)) : null;
    const opBalance = runnerAccount
        ? await publicClient.getBalance({ address: runnerAccount.address })
        : null;
    const access = await checkAccess(rpcUrl, tokenId, publicClient);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const rentalActive = now <= userExpires;
    const operatorAuthorizationActive = now <= operatorExpires;
    const runnerMatchesOperator = runnerAccount
        ? runnerAccount.address.toLowerCase() === operator.toLowerCase()
        : null;
    const blockers: string[] = [];
    const warnings: string[] = [];
    const nextActions: string[] = [];

    if (!runnerAccount) {
        blockers.push("Operator session key is not loaded.");
        nextActions.push("In OpenClaw, have AI set RUNNER_PRIVATE_KEY for the current session automatically.");
    }

    if (!rentalActive) {
        blockers.push(`Rental expired at ${new Date(Number(userExpires) * 1000).toISOString()}.`);
        nextActions.push("Use the owner wallet on shll.run to renew the rental before trading.");
    }

    if (!operatorAuthorizationActive) {
        blockers.push(`Operator authorization expired at ${new Date(Number(operatorExpires) * 1000).toISOString()}.`);
        nextActions.push("Use the owner wallet to re-authorize the operator wallet before trading.");
    }

    if (runnerAccount && !runnerMatchesOperator) {
        blockers.push(`Current operator session wallet does not match on-chain operator ${operator}.`);
        nextActions.push("Use the owner wallet to authorize the current operator wallet, or switch RUNNER_PRIVATE_KEY to the authorized operator.");
    }

    if (runnerAccount && opBalance !== null && opBalance < MIN_OPERATOR_GAS_WEI) {
        blockers.push("Operator wallet gas is too low for reliable execution.");
        nextActions.push("Fund the operator wallet with a small amount of BNB for gas only.");
    }

    if (bnbBalance === 0n) {
        warnings.push("Vault currently has 0 BNB. If you plan to buy or pay protocol fees in BNB, fund the vault first.");
        nextActions.push("Deposit BNB or supported tokens into the vault before asking AI to trade.");
    }

    if (access.blocked && access.message && !warnings.includes(access.message)) {
        warnings.push(access.message);
    }

    if (blockers.length === 0 && bnbBalance > 0n) {
        nextActions.push("Agent is ready. You can ask AI to trade, lend, transfer, or rebalance from this token-id.");
    }

    const readinessStage = !runnerAccount
        ? "needs_session_key"
        : !rentalActive
            ? "needs_rental"
            : !operatorAuthorizationActive || !runnerMatchesOperator
                ? "needs_operator_authorization"
                : opBalance !== null && opBalance < MIN_OPERATOR_GAS_WEI
                    ? "needs_operator_gas"
                    : bnbBalance === 0n
                        ? "ready_but_unfunded"
                        : "ready";

    let activityStats: Record<string, unknown> = { available: false };
    try {
        const res = await fetch(`${DEFAULT_INDEXER}/api/agents/${tokenIdRaw}/summary`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
            const data = await res.json() as Record<string, unknown>;
            activityStats = {
                available: true,
                totalExecutions: data.totalExecutions,
                success: data.successCount,
            };
        }
    } catch {
        // ignore indexer errors in status overview
    }

    return {
        status: "success",
        tokenId: tokenIdRaw,
        readiness: {
            ready: blockers.length === 0,
            canExecuteWrites: blockers.length === 0,
            stage: readinessStage,
            summary: blockers.length > 0
                ? "Agent is not ready yet. Resolve the listed blockers before asking AI to trade."
                : bnbBalance === 0n
                    ? "Agent access is ready, but the vault is unfunded for immediate BNB-based trading."
                    : "Agent is ready for normal AI-driven operations.",
            blockers,
            warnings: dedupeStrings(warnings),
            nextActions: dedupeStrings(nextActions),
        },
        walletModelReminder: {
            ownerWallet: "Use your owner wallet to mint, rent, renew, and authorize the operator.",
            operatorWallet: "Use RUNNER_PRIVATE_KEY only as the AI hot wallet for gas and policy-limited execution.",
            doNotUseOperatorWalletFor: [
                "minting or renting the agent",
                "holding the Agent NFT",
                "storing primary funds",
            ],
        },
        vault: {
            address: vault,
            bnbBalance: (Number(bnbBalance) / 1e18).toFixed(6),
            hasBnbForImmediateTrading: bnbBalance > 0n,
        },
        operator: {
            sessionKeyLoaded: Boolean(runnerAccount),
            sessionWallet: runnerAccount?.address ?? null,
            onChainOperator: operator,
            gasBnb: opBalance === null ? null : (Number(opBalance) / 1e18).toFixed(6),
            gasOk: opBalance === null ? null : opBalance >= MIN_OPERATOR_GAS_WEI,
            recommendedMinGasBnb: "0.001",
        },
        access: {
            rentalActive,
            rentalExpiresAt: new Date(Number(userExpires) * 1000).toISOString(),
            operatorAuthorizationActive,
            operatorAuthorizationExpiresAt: new Date(Number(operatorExpires) * 1000).toISOString(),
            runnerMatchesOperator,
            blocked: access.blocked,
            blockReason: access.message,
            details: access.details,
        },
        activity: activityStats,
        dashboardUrl: agentConsoleUrl(tokenId),
    };
}

export async function getHistory(tokenIdRaw: string, limit: number) {
    const txRes = await fetch(`${DEFAULT_INDEXER}/api/activity/${tokenIdRaw}?limit=${limit}`, {
        signal: AbortSignal.timeout(8000),
    });
    if (!txRes.ok) {
        throw new SkillError("RPC_ERROR", `Indexer returned ${txRes.status}`);
    }
    const data = await txRes.json() as { items?: Array<Record<string, unknown>> };

    let rejections: Record<string, unknown>[] = [];
    try {
        const failRes = await fetch(`${DEFAULT_INDEXER}/api/agents/${tokenIdRaw}/commit-failures?limit=5`, {
            signal: AbortSignal.timeout(5000),
        });
        if (failRes.ok) {
            const failData = await failRes.json() as { items?: Record<string, unknown>[] };
            rejections = failData.items || [];
        }
    } catch {
        // ignore failure fetch errors
    }

    const transactions = (data.items || []).map((item) => ({
        time: new Date(Number(item.timestamp) * 1000).toISOString(),
        txHash: item.txHash,
        target: item.target,
        success: item.success,
    }));

    return {
        tokenId: tokenIdRaw,
        transactions,
        recentPolicyRejections: rejections.length,
    };
}

/**
 * Read-only policy config guidance. Returns current values and directs
 * the user to the web console for modifications.
 */
export async function getPolicyConfigGuidance(tokenIdRaw: string, rpcUrl?: string) {
    const tokenId = parseTokenId(tokenIdRaw);
    const { publicClient, policyClient } = createClients(rpcUrl);
    const policies = await policyClient.getPolicies(tokenId) as PolicyDescriptor[];
    const consoleUrl = agentConsoleUrl(tokenId);
    const currentConfig: Record<string, unknown> = {};

    const spendingPolicy = policies.find((p) => p.policyTypeName === "spending_limit");
    if (spendingPolicy) {
        try {
            const [maxPerTx, maxPerDay, maxSlippageBps] = await publicClient.readContract({
                address: spendingPolicy.address,
                abi: SPENDING_LIMIT_ABI,
                functionName: "instanceLimits",
                args: [tokenId],
            }) as [bigint, bigint, bigint];
            currentConfig.spendingLimit = {
                maxPerTx: (Number(maxPerTx) / 1e18).toFixed(4) + " BNB",
                maxPerDay: (Number(maxPerDay) / 1e18).toFixed(4) + " BNB",
                slippageBps: maxSlippageBps.toString(),
            };
        } catch {
            // ignore unreadable policy config
        }
    }

    const cooldownPolicy = policies.find((p) => p.policyTypeName === "cooldown");
    if (cooldownPolicy) {
        try {
            const cooldown = await publicClient.readContract({
                address: cooldownPolicy.address,
                abi: COOLDOWN_ABI,
                functionName: "cooldownSeconds",
                args: [tokenId],
            }) as bigint;
            currentConfig.cooldown = { seconds: Number(cooldown) };
        } catch {
            // ignore unreadable policy config
        }
    }

    return {
        status: "read_only",
        tokenId: tokenIdRaw,
        currentConfig,
        message: "Policy modification via Skills is disabled. Please use the web console to adjust your security settings.",
        consoleUrl,
    };
}

function dedupeStrings(values: string[]) {
    return [...new Set(values)];
}
