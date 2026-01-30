import { useQuery } from "@tanstack/react-query";
import { createPublicClient, fallback, webSocket } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { ENS_WSS_URLS } from "~/lib/constants";

let ensClient: ReturnType<typeof createPublicClient> | null = null;

function getEnsClient() {
	if (!ensClient) {
		ensClient = createPublicClient({
			chain: mainnet,
			transport: fallback(ENS_WSS_URLS.map((url) => webSocket(url))),
		});
	}
	return ensClient;
}

interface UseEnsAddressQueryOptions {
	name: string;
	enabled?: boolean;
}

/**
 * Forward lookup: ENS name → address on Ethereum mainnet
 * Resolves a .eth name to its address
 * Uses 8-hour cache with stale-while-revalidate
 */
export const useEnsAddressQuery = ({
	name,
	enabled = true,
}: UseEnsAddressQueryOptions) => {
	// Normalize name using viem's ENSIP-15 canonical normalization
	let normalizedName: string;
	try {
		normalizedName = normalize(name);
	} catch {
		// If normalization fails, fall back to lowercase for basic validation
		normalizedName = name.toLowerCase();
	}

	return useQuery({
		queryKey: ["ensAddress", normalizedName],
		queryFn: async () => {
			// Validate ENS name format (using normalized name for case-insensitive check)
			if (
				!normalizedName.endsWith(".eth") ||
				normalizedName.length < 5 ||
				normalizedName.length > 50
			) {
				return {
					ok: false,
					error:
						"Invalid ENS name format. Must end with .eth and be 5-50 characters.",
					code: "INVALID_NAME",
				} as const;
			}

			const client = getEnsClient();

			// Forward lookup: get address from ENS name
			const address = await client.getEnsAddress({
				name: normalizedName,
			});

			// If address is null, the name exists but has no resolver or no address set
			if (!address) {
				return {
					ok: false,
					error: `ENS name "${normalizedName}" does not resolve to an address.`,
					code: "NAME_NOT_FOUND",
				} as const;
			}

			return {
				ok: true,
				name: normalizedName,
				address,
				timestamp: Date.now(),
			} as const;
		},
		// Only enable query if name looks like ENS (basic format check)
		enabled: enabled && Boolean(name) && normalizedName.endsWith(".eth"),
		staleTime: 1000 * 60 * 60 * 24, // 24 hours - trust our cache more
		gcTime: 1000 * 60 * 60 * 24 * 7, // Keep in memory for 7 days
		retry: 1,
	});
};
