import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
    getHistory,
    getPolicySummary,
    getStatusOverview,
    readTokenRestriction,
    getPolicyConfigGuidance,
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

export function registerAgentTools(server: McpServer) {
    server.tool(
        "policies",
        "View active policies and risk settings",
        { token_id: CommonSchemas.tokenId },
        async ({ token_id }) => {
            try {
                return asToolResult(await getPolicySummary(token_id));
            } catch (error) {
                return formatMcpError(error);
            }
        },
    );

    server.tool(
        "token_restriction",
        "Check token whitelist restriction status",
        { token_id: CommonSchemas.tokenId },
        async ({ token_id }) => {
            try {
                return asToolResult(await readTokenRestriction(token_id));
            } catch (error) {
                return formatMcpError(error);
            }
        },
    );

    server.tool(
        "status",
        "One-shot readiness overview: vault, operator session, access blockers, warnings, and next actions",
        { token_id: CommonSchemas.tokenId },
        async ({ token_id }) => {
            try {
                return asToolResult(await getStatusOverview(token_id));
            } catch (error) {
                return formatMcpError(error);
            }
        },
    );

    server.tool(
        "history",
        "Show recent transactions executed through the vault",
        {
            token_id: CommonSchemas.tokenId,
            limit: z.number().default(10),
        },
        async ({ token_id, limit }) => {
            try {
                return asToolResult(await getHistory(token_id, limit));
            } catch (error) {
                return formatMcpError(error);
            }
        },
    );

    server.tool(
        "config",
        "View current risk parameters and get a link to the web console for modifications",
        {
            token_id: CommonSchemas.tokenId.describe("Agent Token ID"),
        },
        async ({ token_id }) => {
            try {
                return asToolResult(await getPolicyConfigGuidance(token_id));
            } catch (error) {
                return formatMcpError(error);
            }
        },
    );
}

