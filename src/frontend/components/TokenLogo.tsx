import type { SupportedChainId } from "@shared/types";
import { type FC, useEffect } from "react";
import { usePlatformMetadataQuery } from "~/hooks/queries/usePlatformMetadataQuery";
import { useTokenMetadataQuery } from "~/hooks/queries/useTokenMetadataQuery";
import { usePlatformStore } from "~/providers/platformStore";
import { useTokenStore } from "~/providers/tokenStore";

type LogoSize = "thumb" | "small" | "large";

interface TokenLogoProps {
	readonly coinId: string;
	readonly size?: LogoSize;
	readonly chainId?: SupportedChainId;
	readonly className?: string;
	readonly alt?: string;
}

const SIZE_PX: Record<LogoSize, number> = {
	thumb: 16,
	small: 24,
	large: 32,
};

/**
 * Map chainId to platform ID used by CoinGecko
 */
function chainIdToPlatformId(chainId: SupportedChainId): string {
	if (chainId === 1) return "ethereum";
	if (chainId === 8453) return "base";
	if (chainId === "tron") return "tron";
	return String(chainId);
}

/**
 * Check if token is native on the given chain
 * Native tokens have empty string for contract address
 */
function isNativeToken(
	coinId: string,
	chainId: SupportedChainId,
	tokenStore?: ReturnType<typeof useTokenStore.getState>,
): boolean {
	if (!tokenStore) return false;

	// Map chainId to platform ID used in tokenStore
	const platformId = chainIdToPlatformId(chainId);

	// Get token from store
	const token = tokenStore.tokens[coinId];
	if (!token) return false;

	// Native tokens have empty contract address
	const contractAddress = token.platforms?.[platformId];
	return contractAddress === "" || contractAddress === undefined;
}

/**
 * Chain logo image component
 */
const ChainLogoImage: FC<{
	readonly chainId: SupportedChainId;
	readonly size: number;
}> = ({ chainId, size }) => {
	const platformId = chainIdToPlatformId(chainId);
	const logoUrl = usePlatformStore((state) =>
		state.getPlatformLogo(platformId, "thumb" as const),
	);

	if (!logoUrl) return null;

	return <img src={logoUrl} alt={platformId} width={size} height={size} />;
};

/**
 * Token logo component with optional chain indicator badge in corner
 * Fetches metadata from CoinGecko API on first render for each coin ID
 * Shows generic coin icon if image fails to load
 *
 * Chain indicator: small chain logo badge in bottom-right corner
 * Only shown for non-native tokens (ERC20/TRC20)
 */
export const TokenLogo: FC<TokenLogoProps> = ({
	coinId,
	size = "small",
	chainId,
	className = "",
	alt,
}) => {
	const token = useTokenStore((state) => state.getTokenById(coinId));
	const imageUrl = token?.image?.[size];
	const setPlatforms = usePlatformStore((state) => state.setPlatforms);

	// Fetch platform metadata (for chain logos)
	const { data: platformData } = usePlatformMetadataQuery();

	// Update platform store when platforms are fetched
	useEffect(() => {
		if (platformData?.ok) {
			setPlatforms(platformData.platforms);
		}
	}, [platformData, setPlatforms]);

	// Fetch metadata for this coin using persisted query (cache + API)
	const { data: metadata } = useTokenMetadataQuery({
		coinIds: [coinId],
		enabled: !imageUrl,
	});

	const src =
		imageUrl ||
		(metadata?.ok ? metadata.tokens[coinId]?.image[size] : undefined);
	const altText = alt || token?.name || coinId;
	const pxSize = SIZE_PX[size];

	// Only show chain badge if this is NOT a native token on this chain
	const tokenStore = useTokenStore((state) => state);
	const showChainBadge = chainId && !isNativeToken(coinId, chainId, tokenStore);

	const chainBadgeSize = size === "large" ? 18 : 14;
	const chainIconSize = chainBadgeSize - 4;

	if (src) {
		return (
			<div className={`relative inline-block ${className}`}>
				{/* Token logo */}
				<img
					src={src}
					alt={altText}
					width={pxSize}
					height={pxSize}
					className="rounded-full"
					style={{ width: pxSize, height: pxSize }}
				/>
				{/* Chain badge in bottom-right corner - only for ERC20/TRC20 */}
				{showChainBadge && (
					<span
						className="absolute bottom-0 right-0 rounded-full border border-base-100 bg-base-300 flex items-center justify-center overflow-hidden"
						style={{
							width: chainBadgeSize,
							height: chainBadgeSize,
							transform: "translate(25%, 25%)",
						}}
					>
						<ChainLogoImage chainId={chainId} size={chainIconSize} />
					</span>
				)}
			</div>
		);
	}

	// Fallback: generic coin icon (shown while loading or on error)
	return (
		<div
			className={`relative inline-block ${className}`}
			role="img"
			aria-label={altText}
		>
			<i
				className="fa-solid fa-coins"
				style={{
					fontSize: pxSize,
					width: pxSize,
					height: pxSize,
					lineHeight: `${pxSize}px`,
				}}
			/>
			{/* Chain badge in bottom-right corner - only for ERC20/TRC20 */}
			{showChainBadge && (
				<span
					className="absolute bottom-0 right-0 rounded-full border border-base-100 bg-base-300 flex items-center justify-center overflow-hidden"
					style={{
						width: chainBadgeSize,
						height: chainBadgeSize,
						transform: "translate(25%, 25%)",
					}}
				>
					<ChainLogoImage chainId={chainId} size={chainIconSize} />
				</span>
			)}
		</div>
	);
};
