/**
 * SHLL Shared Constants - BSC Mainnet contract addresses and protocol constants.
 * Security: NFA and Guard addresses are hardcoded and MUST NOT be overridable.
 */
import type { Address } from "viem";

// === Core Contracts (Security-hardcoded) ===
export const DEFAULT_NFA = "0x71cE46099E4b2a2434111C009A7E9CFd69747c8E"; // V4.1 mainnet
export const DEFAULT_GUARD = "0x25d17eA0e3Bcb8CA08a2BFE917E817AFc05dbBB3";
export const DEFAULT_RPC = "https://bsc-dataseed1.binance.org"; // Public read RPC
export const MEV_PROTECTED_RPC = "https://bscrpc.pancakeswap.finance"; // PancakeSwap MEV Guard — private mempool for writes
export const DEFAULT_LISTING_MANAGER = "0x1f9CE85bD0FF75acc3D92eB79f1Eb472f0865071";
export const DEFAULT_LISTING_ID = "0x64083b44e38db02749e6e16bf84ce6c19146cc42a108e53324e11f250b15a0b7";
export const DEFAULT_INDEXER = "https://indexer-mainnet.shll.run";

// === Version ===
export const SKILL_VERSION = "6.0.4";
export const BINDINGS_UPDATED_AT = "2026-03-07";

// === PancakeSwap ===
export const PANCAKE_V2_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
export const PANCAKE_V3_SMART_ROUTER = "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4";
export const V3_QUOTER = "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997" as Address;

// === Tokens ===
export const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

// === Venus Protocol ===
export const VENUS_VTOKENS: Record<string, Address> = {
    BNB: "0xA07c5b74C9B40447a954e1466938b865b6BBea36" as Address,
    USDT: "0xfD5840Cd36d94D7229439859C0112a4185BC0255" as Address,
    USDC: "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8" as Address,
    BUSD: "0x95c78222B3D6e262426483D42CfA53685A67Ab9D" as Address,
};

// === Four.meme ===
export const FOUR_MEME_HELPER_V3 = "0xF251F83e40a78868FcfA3FA4599Dad6494E46034" as Address;

// === External APIs ===
export const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex";
