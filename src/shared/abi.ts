/**
 * SHLL Shared ABI Fragments - All contract ABI constants used by CLI and MCP.
 * Consolidated from duplicated definitions across index.ts and mcp.ts.
 */

// === ERC20 ===
export const ERC20_ABI = [
    { type: "function" as const, name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" as const },
    { type: "function" as const, name: "allowance", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" as const },
    { type: "function" as const, name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" as const },
    { type: "function" as const, name: "decimals", inputs: [], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" as const },
    { type: "function" as const, name: "symbol", inputs: [], outputs: [{ name: "", type: "string" }], stateMutability: "view" as const },
] as const;

export const ERC20_TRANSFER_ABI = [{
    type: "function" as const, name: "transfer",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable" as const,
}] as const;

// === PancakeSwap V2 ===
export const GET_AMOUNTS_OUT_ABI = [{
    type: "function" as const, name: "getAmountsOut",
    inputs: [{ name: "amountIn", type: "uint256" }, { name: "path", type: "address[]" }],
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "view" as const,
}] as const;

export const SWAP_EXACT_ETH_ABI = [{ type: "function" as const, name: "swapExactETHForTokens", inputs: [{ name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [{ name: "", type: "uint256[]" }], stateMutability: "payable" as const }] as const;
export const SWAP_EXACT_TOKENS_ABI = [{ type: "function" as const, name: "swapExactTokensForTokens", inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [{ name: "", type: "uint256[]" }], stateMutability: "nonpayable" as const }] as const;
export const SWAP_EXACT_TOKENS_FOR_ETH_ABI = [{ type: "function" as const, name: "swapExactTokensForETH", inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [{ name: "", type: "uint256[]" }], stateMutability: "nonpayable" as const }] as const;
export const SWAP_EXACT_ETH_FOR_TOKENS_FEE_ABI = [{ type: "function" as const, name: "swapExactETHForTokensSupportingFeeOnTransferTokens", inputs: [{ name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [], stateMutability: "payable" as const }] as const;
export const SWAP_EXACT_TOKENS_FOR_TOKENS_FEE_ABI = [{ type: "function" as const, name: "swapExactTokensForTokensSupportingFeeOnTransferTokens", inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [], stateMutability: "nonpayable" as const }] as const;
export const SWAP_EXACT_TOKENS_FOR_ETH_FEE_ABI = [{ type: "function" as const, name: "swapExactTokensForETHSupportingFeeOnTransferTokens", inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [], stateMutability: "nonpayable" as const }] as const;

// === PancakeSwap V3 ===
export const V3_EXACT_INPUT_SINGLE_ABI = [{
    type: "function" as const, name: "exactInputSingle",
    inputs: [{
        name: "params", type: "tuple", components: [
            { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
            { name: "fee", type: "uint24" }, { name: "recipient", type: "address" },
            { name: "amountIn", type: "uint256" }, { name: "amountOutMinimum", type: "uint256" },
            { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
    }],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable" as const,
}] as const;

export const V3_EXACT_INPUT_ABI = [{
    type: "function" as const, name: "exactInput",
    inputs: [{
        name: "params", type: "tuple", components: [
            { name: "path", type: "bytes" },
            { name: "recipient", type: "address" },
            { name: "amountIn", type: "uint256" },
            { name: "amountOutMinimum", type: "uint256" },
            { name: "deadline", type: "uint256" },
        ],
    }],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable" as const,
}] as const;

export const V3_QUOTE_ABI = [{
    type: "function" as const, name: "quoteExactInputSingle",
    inputs: [{
        name: "params", type: "tuple", components: [
            { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
            { name: "amountIn", type: "uint256" }, { name: "fee", type: "uint24" },
            { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
    }],
    outputs: [
        { name: "amountOut", type: "uint256" }, { name: "sqrtPriceX96After", type: "uint160" },
        { name: "initializedTicksCrossed", type: "uint32" }, { name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable" as const,
}] as const;

// === Venus Protocol ===
export const VTOKEN_ABI = [
    { type: "function" as const, name: "mint", inputs: [{ name: "mintAmount", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "nonpayable" as const },
    { type: "function" as const, name: "redeemUnderlying", inputs: [{ name: "redeemAmount", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "nonpayable" as const },
] as const;

export const VTOKEN_READ_ABI = [
    { type: "function" as const, name: "balanceOfUnderlying", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" as const },
    { type: "function" as const, name: "supplyRatePerBlock", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" as const },
    { type: "function" as const, name: "underlying", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" as const },
] as const;

export const VBNB_MINT_ABI = [{ type: "function" as const, name: "mint", inputs: [], outputs: [], stateMutability: "payable" as const }] as const;

// === WBNB ===
export const WBNB_ABI = [
    { type: "function" as const, name: "deposit", inputs: [], outputs: [], stateMutability: "payable" as const },
    { type: "function" as const, name: "withdraw", inputs: [{ name: "wad", type: "uint256" }], outputs: [], stateMutability: "nonpayable" as const },
] as const;

// === AgentNFA ===
export const AGENT_NFA_ABI = [
    { type: "function" as const, name: "setOperator", inputs: [{ name: "tokenId", type: "uint256" }, { name: "operator", type: "address" }, { name: "opExpires", type: "uint64" }], outputs: [], stateMutability: "nonpayable" as const },
    { type: "function" as const, name: "fundAgent", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [], stateMutability: "payable" as const },
    { type: "function" as const, name: "accountOf", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }], stateMutability: "view" as const },
] as const;

export const AGENT_NFA_ACCESS_ABI = [
    { name: "operatorExpiresOf", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
    { name: "userExpires", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
    { name: "operatorOf", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
    { name: "userOf", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
    { name: "ownerOf", type: "function" as const, stateMutability: "view" as const, inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
] as const;

// === ListingManager ===
export const LISTING_MANAGER_ABI = [
    {
        type: "function" as const, name: "rentToMintWithParams",
        inputs: [
            { name: "listingId", type: "bytes32" }, { name: "daysToRent", type: "uint32" },
            { name: "", type: "uint32" }, { name: "", type: "uint16" },
            { name: "paramsPacked", type: "bytes" },
        ],
        outputs: [{ name: "instanceId", type: "uint256" }],
        stateMutability: "payable" as const,
    },
    {
        type: "function" as const, name: "listings",
        inputs: [{ name: "listingId", type: "bytes32" }],
        outputs: [
            { name: "nfa", type: "address" }, { name: "templateId", type: "uint256" }, { name: "owner", type: "address" },
            { name: "pricePerDay", type: "uint256" }, { name: "minDays", type: "uint32" }, { name: "active", type: "bool" },
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

// === Policy Configuration (read-only; writes are done via web console) ===
export const SPENDING_LIMIT_ABI = [
    { type: "function" as const, name: "instanceLimits", inputs: [{ name: "instanceId", type: "uint256" }], outputs: [{ name: "maxPerTx", type: "uint256" }, { name: "maxPerDay", type: "uint256" }, { name: "maxSlippageBps", type: "uint256" }], stateMutability: "view" as const },
    { type: "function" as const, name: "tokenRestrictionEnabled", inputs: [{ name: "instanceId", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" as const },
    { type: "function" as const, name: "getTokenList", inputs: [{ name: "instanceId", type: "uint256" }], outputs: [{ name: "", type: "address[]" }], stateMutability: "view" as const },
] as const;

export const COOLDOWN_ABI = [
    { type: "function" as const, name: "cooldownSeconds", inputs: [{ name: "instanceId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" as const },
] as const;


// === Four.meme ===
export const FOUR_MEME_HELPER_ABI = [
    {
        type: "function" as const, name: "getTokenInfo",
        inputs: [{ name: "token", type: "address" }],
        outputs: [
            { name: "version", type: "uint256" }, { name: "tokenManager", type: "address" },
            { name: "quote", type: "address" }, { name: "lastPrice", type: "uint256" },
            { name: "tradingFeeRate", type: "uint256" }, { name: "minTradingFee", type: "uint256" },
            { name: "launchTime", type: "uint256" }, { name: "offers", type: "uint256" },
            { name: "maxOffers", type: "uint256" }, { name: "funds", type: "uint256" },
            { name: "maxFunds", type: "uint256" }, { name: "liquidityAdded", type: "bool" },
        ],
        stateMutability: "view" as const,
    },
    {
        type: "function" as const, name: "tryBuy",
        inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }, { name: "funds", type: "uint256" }],
        outputs: [
            { name: "tokenManager", type: "address" }, { name: "quote", type: "address" },
            { name: "estimatedAmount", type: "uint256" }, { name: "estimatedCost", type: "uint256" },
            { name: "estimatedFee", type: "uint256" }, { name: "amountMsgValue", type: "uint256" },
            { name: "amountApproval", type: "uint256" }, { name: "amountFunds", type: "uint256" },
        ],
        stateMutability: "view" as const,
    },
    {
        type: "function" as const, name: "trySell",
        inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }],
        outputs: [
            { name: "tokenManager", type: "address" }, { name: "quote", type: "address" },
            { name: "funds", type: "uint256" }, { name: "fee", type: "uint256" },
        ],
        stateMutability: "view" as const,
    },
] as const;

export const FOUR_MEME_V1_ABI = [
    { type: "function" as const, name: "purchaseTokenAMAP", inputs: [{ name: "token", type: "address" }, { name: "funds", type: "uint256" }, { name: "minAmount", type: "uint256" }], outputs: [], stateMutability: "payable" as const },
    { type: "function" as const, name: "saleToken", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" as const },
] as const;

export const FOUR_MEME_V2_ABI = [
    { type: "function" as const, name: "buyTokenAMAP", inputs: [{ name: "token", type: "address" }, { name: "funds", type: "uint256" }, { name: "minAmount", type: "uint256" }], outputs: [], stateMutability: "payable" as const },
    { type: "function" as const, name: "sellToken", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" as const },
] as const;
