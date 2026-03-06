import { encodeFunctionData, type Address } from "viem";
import type { Action } from "shll-policy-sdk";
import {
    createClients,
    resolveTokenAsync,
    parseAmount,
    ERC20_ABI,
    WBNB_ABI,
    SWAP_EXACT_ETH_ABI,
    SWAP_EXACT_TOKENS_FOR_TOKENS_FEE_ABI,
    V3_EXACT_INPUT_SINGLE_ABI,
    V3_QUOTE_ABI,
    PANCAKE_V2_ROUTER,
    PANCAKE_V3_SMART_ROUTER,
    V3_QUOTER,
    WBNB,
    GET_AMOUNTS_OUT_ABI,
} from "../shared/index.js";
import { SkillError } from "../shared/errors.js";
import { buyFourMeme, getFourMemeInfo, sellFourMeme } from "./fourmeme.js";
import {
    assertPositiveAmount,
    ensureAccess,
    executeActions,
    parseTokenId,
    validateActionsOrThrow,
} from "./common.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const V3_FEES = [500, 2500, 10000] as const;

export interface SwapInput {
    tokenId: string;
    fromToken: string;
    toToken: string;
    amount: string;
    version: "V2" | "V3";
    slippage: number;
    rpcUrl?: string;
}

export async function executeSwap(input: SwapInput) {
    const { publicClient, policyClient } = createClients(input.rpcUrl);
    const tokenId = parseTokenId(input.tokenId);
    await ensureAccess(tokenId, input.rpcUrl, publicClient);
    const vault = await policyClient.getVault(tokenId);

    const tokenIn = await resolveTokenAsync(publicClient, input.fromToken);
    const tokenOut = await resolveTokenAsync(publicClient, input.toToken);
    const amountIn = parseAmount(input.amount, tokenIn.decimals);
    assertPositiveAmount(amountIn);

    const slippage = Number(input.slippage);
    if (!Number.isFinite(slippage) || slippage <= 0 || slippage > 99.99) {
        throw new SkillError("INVALID_INPUT", "Slippage must be between 0 and 99.99");
    }

    const isNativeIn = tokenIn.address === ZERO_ADDRESS;
    const isNativeOut = tokenOut.address === ZERO_ADDRESS;

    // Smart Routing Logic: Auto-route to Four.meme if applicable
    if (isNativeIn && !isNativeOut) {
        try {
            const fourInfo = await getFourMemeInfo(tokenOut.address);
            if (fourInfo.tradingPhase === "Internal (Bonding Curve)") {
                return buyFourMeme(input.tokenId, tokenOut.address, input.amount, slippage, input.rpcUrl);
            }
        } catch (e) {
            // Not a Four.meme token, continue to normal DEX swap
        }
    } else if (!isNativeIn && isNativeOut) {
        try {
            const fourInfo = await getFourMemeInfo(tokenIn.address);
            if (fourInfo.tradingPhase === "Internal (Bonding Curve)") {
                return sellFourMeme(input.tokenId, tokenIn.address, input.amount, slippage, input.rpcUrl);
            }
        } catch (e) {
            // Not a Four.meme token, continue to normal DEX swap
        }
    }

    const pathIn = isNativeIn ? WBNB : tokenIn.address;
    const pathOut = isNativeOut ? WBNB : tokenOut.address;
    const actions: Action[] = [];

    if (input.version === "V3") {
        const quote = await getBestV3Quote(publicClient, pathIn, pathOut, amountIn);
        if (!quote || quote.estimatedAmountOut === 0n) {
            throw new SkillError("NOT_SUPPORTED", `No V3 liquidity or path found for ${tokenIn.symbol} -> ${tokenOut.symbol} (Path used: ${pathIn} -> ${pathOut})`);
        }
        const minOut = applySlippage(quote.estimatedAmountOut, slippage);

        if (!isNativeIn) {
            actions.push({
                target: tokenIn.address,
                value: 0n,
                data: encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: "approve",
                    args: [PANCAKE_V3_SMART_ROUTER as Address, amountIn],
                }),
            });
        }

        actions.push({
            target: PANCAKE_V3_SMART_ROUTER as Address,
            value: isNativeIn ? amountIn : 0n,
            data: encodeFunctionData({
                abi: V3_EXACT_INPUT_SINGLE_ABI,
                functionName: "exactInputSingle",
                args: [{
                    tokenIn: pathIn,
                    tokenOut: pathOut,
                    fee: quote.fee,
                    recipient: vault,
                    amountIn,
                    amountOutMinimum: minOut,
                    sqrtPriceLimitX96: 0n,
                }],
            }),
        });
    } else {
        const v2Router = PANCAKE_V2_ROUTER as Address;
        const path = [pathIn as Address, pathOut as Address];
        let estimatedOut = 0n;
        try {
            const amountsOut = await publicClient.readContract({
                address: v2Router,
                abi: GET_AMOUNTS_OUT_ABI,
                functionName: "getAmountsOut",
                args: [amountIn, path],
            });
            estimatedOut = (amountsOut as bigint[])[1];
        } catch (error: any) {
            throw new SkillError("NOT_SUPPORTED", `No V2 liquidity or direct path found for ${tokenIn.symbol} -> ${tokenOut.symbol}. The pair might not exist or lacks reserves. (Path used: ${pathIn} -> ${pathOut})`);
        }

        if (!estimatedOut || estimatedOut === 0n) {
            throw new SkillError("NOT_SUPPORTED", `No V2 liquidity found for ${tokenIn.symbol} -> ${tokenOut.symbol} pair`);
        }
        const minOut = applySlippage(estimatedOut, slippage);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 180);

        if (isNativeIn) {
            actions.push({
                target: v2Router,
                value: amountIn,
                data: encodeFunctionData({
                    abi: SWAP_EXACT_ETH_ABI,
                    functionName: "swapExactETHForTokens",
                    args: [minOut, path, vault, deadline],
                }),
            });
        } else {
            // ERC20 → ERC20 (or ERC20 → WBNB when user sells for BNB)
            // Use SupportingFeeOnTransferTokens to handle taxed/meme tokens.
            // Path is [Token, WBNB] for sells — WBNB lands in vault, functionally
            // equivalent to native BNB and consistent with Runner behavior.
            actions.push({
                target: tokenIn.address,
                value: 0n,
                data: encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: "approve",
                    args: [v2Router, amountIn],
                }),
            });
            actions.push({
                target: v2Router,
                value: 0n,
                data: encodeFunctionData({
                    abi: SWAP_EXACT_TOKENS_FOR_TOKENS_FEE_ABI,
                    functionName: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
                    args: [amountIn, minOut, path, vault, deadline],
                }),
            });
        }
    }

    await validateActionsOrThrow(policyClient, tokenId, actions);
    const res = await executeActions(policyClient, tokenId, actions);
    const hasCustomRpc = !!input.rpcUrl || !!process.env.SHLL_RPC;

    return {
        status: "success",
        hash: res.hash,
        protocol: `PancakeSwap ${input.version}`,
        action: "swap",
        tokenIn: tokenIn.symbol,
        tokenOut: tokenOut.symbol,
        amountIn: input.amount,
        mev_protection: {
            slippage: `${slippage}%`,
            deadline: input.version === "V2" ? "3 min" : "none (V3)",
            rpc: hasCustomRpc ? "✅ custom RPC" : "✅ PancakeSwap MEV Guard (default)",
        },
    };
}

export async function wrapBnb(tokenIdRaw: string, amount: string, rpcUrl?: string) {
    const { publicClient, policyClient } = createClients(rpcUrl);
    const tokenId = parseTokenId(tokenIdRaw);
    await ensureAccess(tokenId, rpcUrl, publicClient);

    const amountWei = parseAmount(amount, 18);
    assertPositiveAmount(amountWei);

    const action: Action = {
        target: WBNB as Address,
        value: amountWei,
        data: encodeFunctionData({ abi: WBNB_ABI, functionName: "deposit" }),
    };
    await validateActionsOrThrow(policyClient, tokenId, [action]);
    const res = await executeActions(policyClient, tokenId, [action]);

    return {
        status: "success",
        hash: res.hash,
        action: "wrap",
        amount,
    };
}

export async function unwrapWbnb(tokenIdRaw: string, amount: string, rpcUrl?: string) {
    const { publicClient, policyClient } = createClients(rpcUrl);
    const tokenId = parseTokenId(tokenIdRaw);
    await ensureAccess(tokenId, rpcUrl, publicClient);

    const amountWei = parseAmount(amount, 18);
    assertPositiveAmount(amountWei);

    const action: Action = {
        target: WBNB as Address,
        value: 0n,
        data: encodeFunctionData({ abi: WBNB_ABI, functionName: "withdraw", args: [amountWei] }),
    };
    await validateActionsOrThrow(policyClient, tokenId, [action]);
    const res = await executeActions(policyClient, tokenId, [action]);

    return {
        status: "success",
        hash: res.hash,
        action: "unwrap",
        amount,
    };
}

async function getBestV3Quote(
    publicClient: any,
    tokenIn: Address,
    tokenOut: Address,
    amountIn: bigint,
): Promise<{ fee: number; estimatedAmountOut: bigint } | null> {
    const quotes = await Promise.allSettled(V3_FEES.map((feeTier) =>
        publicClient.readContract({
            address: V3_QUOTER as Address,
            abi: V3_QUOTE_ABI,
            functionName: "quoteExactInputSingle",
            args: [{ tokenIn, tokenOut, amountIn, fee: feeTier, sqrtPriceLimitX96: 0n }],
        }),
    ));

    let bestFee = 0;
    let bestOut = 0n;
    for (let i = 0; i < V3_FEES.length; i++) {
        const result = quotes[i];
        if (result.status !== "fulfilled") continue;
        const [out] = result.value as unknown as [bigint];
        if (out > bestOut) {
            bestOut = out;
            bestFee = V3_FEES[i];
        }
    }

    if (bestOut === 0n || bestFee === 0) {
        return null;
    }
    return { fee: bestFee, estimatedAmountOut: bestOut };
}

function applySlippage(amountOut: bigint, slippagePct: number): bigint {
    return (amountOut * BigInt(Math.floor((100 - slippagePct) * 100))) / 10000n;
}
