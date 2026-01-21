import type { FC } from "react";
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
		<div className="dropdown dropdown-end">
			<button
				type="button"
				className="btn btn-outline m-1"
				tabIndex={0}
				aria-expanded="false"
				aria-controls="token-dropdown"
			>
				{selectedToken.symbol.toUpperCase()}
				<i className="fa-solid fa-chevron-down ml-2" />
			</button>
			<div
				id="token-dropdown"
				className="dropdown-content z-[1] card card-compact w-64 p-2 shadow bg-base-100 text-primary-content"
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
							<span className="font-bold">{token.symbol.toUpperCase()}</span>
							<span className="text-xs opacity-70">{token.name}</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
};
