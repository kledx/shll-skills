import { Command } from "commander";
import {
    buildSetupGuide,
    generateOperatorWallet,
    listAvailableListings,
} from "../services/index.js";
import { output, outputError } from "./utils.js";

export function registerSetupCommands(program: Command) {
    const listingsCmd = new Command("listings")
        .description("List active agent templates from the indexer");
    listingsCmd.action(async () => {
        try {
            const listings = await listAvailableListings();
            output({
                status: "success",
                count: listings.length,
                listings,
                recommendationPolicy: "Prefer the listing with recommended=true unless you need a specialized template.",
            });
        } catch (error) {
            outputError(error);
            process.exit(1);
        }
    });

    const setupCmd = new Command("setup-guide")
        .description("Print dual-wallet setup instructions for a specific template")
        .option("-l, --listing <hex>", "Template listing ID")
        .option("-d, --days <number>", "Number of days to subscribe", "7");
    setupCmd.action(async (opts) => {
        try {
            const result = await buildSetupGuide(opts.listing, parseInt(opts.days, 10));
            output({
                ...result,
                steps: [
                    { step: 1, action: `Open ${result.setupUrl}` },
                    { step: 2, action: "Use your owner wallet in the browser. Do not use the operator wallet for subscription or mint." },
                    { step: 3, action: "Confirm the subscription or mint transaction in the owner wallet." },
                    { step: 4, action: "Authorize the operator wallet for AI execution." },
                    { step: 5, action: "Fund the vault with BNB or trading tokens. Do not use the operator wallet as the vault wallet." },
                    { step: 6, action: "Send the token-id back to AI so it can automatically run readiness checks." },
                ],
            });
        } catch (error) {
            outputError(error);
            process.exit(1);
        }
    });

    const genCmd = new Command("generate-wallet")
        .description("Generate a new AI operator wallet (not the owner, mint, or vault wallet)");
    genCmd.action(() => {
        output(generateOperatorWallet());
    });

    program.addCommand(listingsCmd);
    program.addCommand(setupCmd);
    program.addCommand(genCmd);
}
