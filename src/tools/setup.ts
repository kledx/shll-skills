import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
    buildSetupGuide,
    generateOperatorWallet,
    listAvailableListings,
} from "../services/index.js";
import { CommonSchemas, formatMcpError } from "../shared/index.js";

function asToolResult(payload: unknown) {
    return {
        content: [{
            type: "text" as const,
            text: JSON.stringify(payload),
        }],
    };
}

export function registerSetupTools(server: McpServer) {
    server.tool(
        "listings",
        "List all available agent templates for subscription",
        {},
        async () => {
            try {
                const listings = await listAvailableListings();
                return asToolResult({
                    count: listings.length,
                    listings,
                    recommendationPolicy: "Prefer the listing with recommended=true unless the user explicitly wants a specialized template.",
                    hint: "setup_guide can auto-select an active listing when listing_id is omitted.",
                });
            } catch (error) {
                return formatMcpError(error);
            }
        },
    );

    server.tool(
        "setup_guide",
        "Generate step-by-step dual-wallet onboarding instructions. Owner wallet completes subscription or mint; operator wallet is AI-only.",
        {
            listing_id: CommonSchemas.listingId.optional(),
            days: z.number().int().min(7).default(7).describe("Number of days to subscribe"),
        },
        async ({ listing_id, days }) => {
            try {
                const result = await buildSetupGuide(listing_id, days);
                return asToolResult({
                    ...result,
                    steps: [
                        { step: 1, title: "Open SHLL Setup Page", action: `Open ${result.setupUrl}` },
                        { step: 2, title: "Use Owner Wallet", action: "Use your main owner wallet in the browser. Do not use the operator wallet for this step." },
                        { step: 3, title: "Subscribe or Mint Agent", action: "Confirm the subscription or mint transaction in the owner wallet." },
                        { step: 4, title: "Authorize Operator", action: "Authorize the operator wallet for AI execution.", note: `Operator: ${result.operatorAddress}` },
                        { step: 5, title: "Fund Vault", action: "Deposit BNB or tokens into the vault for trading. Do not store primary assets in the operator wallet." },
                        { step: 6, title: "Return Token ID", action: "Send the token-id back to AI so it can automatically check operator gas, vault balance, and policy readiness." },
                    ],
                });
            } catch (error) {
                return formatMcpError(error);
            }
        },
    );

    server.tool(
        "generate_wallet",
        "Generate a new operator wallet for AI only. This is not the owner wallet, mint wallet, or vault wallet.",
        {},
        async () => asToolResult(generateOperatorWallet()),
    );
}
