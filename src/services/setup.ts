import { type Hex } from "viem";
import {
    DEFAULT_LISTING_MANAGER,
    LISTING_MANAGER_ABI,
    pickPreferredListing,
    createClients,
    createReadOnlyClient,
    fetchActiveListings,
    generatePrivateKey,
    privateKeyToAccount,
    resolveSetupListing,
} from "../shared/index.js";
import { SkillError } from "../shared/errors.js";

export async function listAvailableListings() {
    const available = await fetchActiveListings();
    const preferred = pickPreferredListing(available);
    const listings = available.map((listing) => ({
        listingId: listing.id,
        id: listing.id,
        name: listing.agentName || "Unnamed Agent",
        type: listing.agentType || "unknown",
        pricePerDayBNB: (Number(listing.pricePerDay) / 1e18).toFixed(6),
        minDays: listing.minDays,
        nfa: listing.nfa,
        recommended: preferred?.id.toLowerCase() === listing.id.toLowerCase(),
        recommendationReason: getListingRecommendationReason(listing.agentName || "Unnamed Agent", preferred?.id === listing.id),
    }));

    return listings.sort((a, b) => Number(b.recommended) - Number(a.recommended));
}

export async function buildSetupGuide(listingId?: string, days = 7) {
    let operatorAddress: string;
    try {
        const { account } = createClients();
        operatorAddress = account.address;
    } catch {
        throw new SkillError(
            "ACCESS_DENIED",
            "No RUNNER_PRIVATE_KEY found. Generate an operator wallet first. In OpenClaw, AI should set RUNNER_PRIVATE_KEY automatically for the current session.",
        );
    }

    const resolvedListing = await resolveSetupListing(listingId);
    const daysToRent = Math.max(7, Math.trunc(days));

    let rentCost = "unknown";
    try {
        const publicClient = createReadOnlyClient();
        const listing = await publicClient.readContract({
            address: DEFAULT_LISTING_MANAGER,
            abi: LISTING_MANAGER_ABI,
            functionName: "listings",
            args: [resolvedListing.listingId as Hex],
        }) as unknown as readonly [Hex, bigint, `0x${string}`, bigint, number, boolean];
        const [, , , pricePerDay, minDays, active] = listing;
        if (!active || daysToRent < Number(minDays)) {
            throw new SkillError(
                "INVALID_INPUT",
                `Listing inactive or minimum days > ${daysToRent}`,
            );
        }
        const totalRent = pricePerDay * BigInt(daysToRent);
        rentCost = `${(Number(totalRent) / 1e18).toFixed(6)} BNB`;
    } catch (error) {
        if (error instanceof SkillError) {
            throw error;
        }
    }

    const setupUrl = `https://shll.run/setup?operator=${operatorAddress}&listing=${encodeURIComponent(resolvedListing.listingId)}&days=${daysToRent}`;
    return {
        status: "guide",
        operatorAddress,
        setupUrl,
        rentCost,
        walletModel: {
            type: "dual_wallet",
            ownerWallet: {
                purpose: "Subscribe or mint the agent, own the Agent NFT, authorize the operator, and hold primary assets.",
                useFor: ["subscribing to or minting the agent", "holding ownership", "authorizing the operator"],
            },
            operatorWallet: {
                purpose: "AI-only hot wallet used for gas and policy-limited execution.",
                useFor: ["paying gas", "executing policy-limited trades"],
                doNotUseFor: [
                    "minting or subscribing to the agent",
                    "holding the Agent NFT",
                    "using as your main asset wallet",
                ],
                leakImpact: "If this wallet leaks, the vault cannot be freely drained. Actions remain limited by owner permissions and on-chain PolicyGuard rules.",
            },
        },
        criticalWarnings: [
            "Do not use the operator wallet to mint, subscribe to, or hold the Agent NFT.",
            "Use your owner wallet in the browser to complete subscription and operator authorization.",
            "Keep only a small BNB balance in the operator wallet for gas.",
        ],
        listingSelection: {
            source: resolvedListing.source,
            listingId: resolvedListing.listingId,
            warning: resolvedListing.warning,
        },
        daysToRent,
        aiSessionActions: {
            env: {
                variable: "RUNNER_PRIVATE_KEY",
                autoSetInOpenClaw: true,
                userNeedsToSetItManually: false,
            },
            afterUserReturnsWithTokenId: [
                "Check operator gas balance automatically",
                "Check vault BNB and token balances automatically",
                "Check policy status and access status automatically",
            ],
        },
    };
}

export function generateOperatorWallet() {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    return {
        status: "success",
        address: account.address,
        privateKey,
        walletRole: "operator",
        purpose: "AI-only hot wallet used to pay gas and execute policy-limited actions.",
        securityModel: "dual_wallet",
        safeIfLeaked: "This is not the owner wallet. A leak does not grant unrestricted vault withdrawal because owner permissions stay on the owner wallet and PolicyGuard still limits operator actions.",
        doNotUseFor: [
            "minting or subscribing to the agent",
            "holding the Agent NFT",
            "holding your main assets",
        ],
        recommendedFunding: "Keep only a small BNB balance here for gas.",
        env: {
            variable: "RUNNER_PRIVATE_KEY",
            autoSetInOpenClaw: true,
            userNeedsToSetItManually: false,
        },
        note: "Store this private key securely. In OpenClaw, AI should set RUNNER_PRIVATE_KEY automatically for the current session.",
    };
}

function getListingRecommendationReason(agentName: string, isPreferred: boolean) {
    if (isPreferred && agentName.toLowerCase().includes("defi")) {
        return "Recommended for most first-time users: broad DeFi coverage and the default onboarding path.";
    }
    if (isPreferred) {
        return "Recommended default template for most users.";
    }
    return "Alternative template for specialized use cases.";
}
