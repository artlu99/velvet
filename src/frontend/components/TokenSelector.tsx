import type React from "react";
import type { FC } from "react";
import { TokenLogo } from "~/components/TokenLogo";
import type { CoinGeckoToken } from "~/providers/tokenStore";

interface TokenSelectorProps {
	readonly tokens: CoinGeckoToken[];
	readonly selectedToken: CoinGeckoToken;
	readonly onSelect: (token: CoinGeckoToken) => void;
}

export const TokenSelector: FC<TokenSelectorProps> = ({
	tokens,
	selectedToken,
	onSelect,
}) => {
	return (
		<>
			<button
				type="button"
				className="btn btn-outline m-1"
				aria-expanded="false"
				aria-controls="token-dropdown"
				popoverTarget="token-dropdown"
				style={{ anchorName: "--token-dropdown-anchor" } as React.CSSProperties}
			>
				<TokenLogo coinId={selectedToken.id} size="small" className="mr-2" />
				{selectedToken.symbol.toUpperCase()}
				<i className="fa-solid fa-chevron-down ml-2" />
			</button>
			<div
				id="token-dropdown"
				className="dropdown card card-compact w-64 p-2 bg-neutral text-neutral-content rounded-sm"
				popover="auto"
				style={
					{
						positionAnchor: "--token-dropdown-anchor",
						positionArea: "bottom span-left",
					} as React.CSSProperties
				}
			>
				<div className="card-body">
					<h3 className="card-title text-sm">Select Token</h3>
					{tokens.map((token) => (
						<button
							key={token.id}
							type="button"
							className={`btn btn-justify ${
								token.id === selectedToken.id ? "btn-active" : ""
							}`}
							onClick={() => onSelect(token)}
						>
							<TokenLogo coinId={token.id} size="small" className="mr-2" />
							<span className="font-bold">{token.symbol.toUpperCase()}</span>
							<span className="text-xs opacity-70">{token.name}</span>
						</button>
					))}
				</div>
			</div>
		</>
	);
};
