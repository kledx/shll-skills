import { formatEther, type Address } from "viem";
import {
    AGENT_NFA_ABI,
    AGENT_NFA_ACCESS_ABI,
    DEFAULT_NFA,
    ERC20_ABI,
    TOKEN_REGISTRY,
    agentConsoleUrl,
    createClients,
    createReadOnlyClient,
    fetchTokenPrice,
    searchToken,
} from "../shared/index.js";
import { SkillError } from "../shared/errors.js";
import { parseTokenId } from "./common.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function getPortfolio(tokenIdRaw: string, rpcUrl?: string) {
    const tokenId = parseTokenId(tokenIdRaw);
    const { account, publicClient, policyClient } = createClients(rpcUrl);
    const vault = await policyClient.getVault(tokenId);

    const tokenEntries = Object.entries(TOKEN_REGISTRY).filter(([symbol]) => symbol !== "BNB");
    const tokenResults = await Promise.allSettled(tokenEntries.map(async ([symbol, info]) => {
        const bal = await publicClient.readContract({
            address: info.address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [vault],
        });
        if (bal <= 0n) return null;
        return [symbol, (Number(bal) / (10 ** info.decimals)).toString()] as const;
    }));

    const tokenBalances: Record<string, string> = {};
    for (const r of tokenResults) {
        if (r.status === "fulfilled" && r.value) {
            tokenBalances[r.value[0]] = r.value[1];
        }
    }

    const [bnbBal, gasBal, operatorExpires, userExpires, operator] = await Promise.all([
        publicClient.getBalance({ address: vault }),
        publicClient.getBalance({ address: account.address }),
        publicClient.readContract({ address: DEFAULT_NFA as Address, abi: AGENT_NFA_ACCESS_ABI, functionName: "operatorExpiresOf", args: [tokenId] }) as Promise<bigint>,
        publicClient.readContract({ address: DEFAULT_NFA as Address, abi: AGENT_NFA_ACCESS_ABI, functionName: "userExpires", args: [tokenId] }) as Promise<bigint>,
        publicClient.readContract({ address: DEFAULT_NFA as Address, abi: AGENT_NFA_ACCESS_ABI, functionName: "operatorOf", args: [tokenId] }) as Promise<Address>,
    ]);

    const now = BigInt(Math.floor(Date.now() / 1000));
    let accessStatus = "Active";
    if (now > userExpires) accessStatus = "Subscription Expired";
    else if (now > operatorExpires) accessStatus = "Operator Auth Expired";
    else if (operator.toLowerCase() !== account.address.toLowerCase()) accessStatus = "Operator Mismatch";

    return {
        status: "success",
        tokenId: tokenIdRaw,
        vaultAddress: vault,
        bnbBalance: formatEther(bnbBal),
        tokenBalances,
        operatorWallet: account.address,
        operatorGasBnb: formatEther(gasBal),
        accessStatus,
        manageUrl: agentConsoleUrl(tokenId),
    };
}

export async function getBalance(tokenIdRaw: string, token: string, rpcUrl?: string) {
    const tokenId = parseTokenId(tokenIdRaw);
    const publicClient = createReadOnlyClient(rpcUrl);
    const vault = await publicClient.readContract({
        address: DEFAULT_NFA as Address,
        abi: AGENT_NFA_ABI,
        functionName: "accountOf",
        args: [tokenId],
    }) as Address;
    const upper = token.toUpperCase();

    if (upper === "BNB" || token === ZERO_ADDRESS) {
        const bal = await publicClient.getBalance({ address: vault });
        return {
            status: "success",
            token: "BNB",
            balance: formatEther(bal),
            balanceWei: bal.toString(),
            vault,
        };
    }

    let address = token as Address;
    let decimals = 18;
    if (TOKEN_REGISTRY[upper]) {
        address = TOKEN_REGISTRY[upper].address;
        decimals = TOKEN_REGISTRY[upper].decimals;
    }

    const bal = await publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [vault],
    });
    return {
        status: "success",
        token: upper,
        address,
        balance: (Number(bal) / (10 ** decimals)).toString(),
        balanceRaw: bal.toString(),
        decimals,
        vault,
    };
}

export async function getPrice(token: string) {
    const upper = token.toUpperCase();
    const address = TOKEN_REGISTRY[upper]?.address || token;
    const data = await fetchTokenPrice(address);
    if (!data) {
        throw new SkillError(
            "NOT_FOUND",
            "Price data not found on BSC",
            { token, resolvedAddress: address },
        );
    }
    return {
        status: "success",
        symbol: data.baseToken.symbol,
        priceUsd: data.priceUsd,
        priceChange24h: `${data.priceChange.h24}%`,
        volume24hUsd: data.volume.h24,
        liquidityUsd: data.liquidity.usd,
        fdv: data.fdv,
        address: data.baseToken.address,
    };
}

export async function searchTokens(query: string) {
    const pairs = await searchToken(query);
    if (pairs.length === 0) {
        throw new SkillError(
            "NOT_FOUND",
            "No matching BSC tokens found",
            { query },
        );
    }
    const results = pairs.map((p) => ({
        symbol: p.baseToken.symbol,
        name: p.baseToken.name,
        address: p.baseToken.address,
        priceUsd: p.priceUsd,
        liquidityUsd: p.liquidity?.usd || 0,
        volume24hUsd: p.volume?.h24 || 0,
    }));
    return {
        status: "success",
        results,
        count: results.length,
    };
}

export function listMappedTokens() {
    const tokens = Object.values(TOKEN_REGISTRY).map((info) => ({
        symbol: info.symbol,
        address: info.address,
        decimals: info.decimals,
    }));
    return {
        status: "success",
        tokens,
        count: tokens.length,
    };
}
