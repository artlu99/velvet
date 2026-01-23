import { useEvolu } from "@evolu/react";
import { type FC, use, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { deriveKeyAt } from "~/lib/bip32";
import { getNextSuggestedIndex } from "~/lib/queries/derivation";
import type { KeyType } from "~/lib/schema";

const BTC_FEATURE_FLAG = false;
const SOLANA_FEATURE_FLAG = false;

export const DeriveWallet: FC = () => {
	const evolu = useEvolu();
	const appOwner = use(evolu.appOwner);

	const [keyType, setKeyType] = useState<KeyType>("evm");
	const [deriveIndex, setDeriveIndex] = useState(0);
	const [isDeriving, setIsDeriving] = useState(false);

	// Load initial suggested index on mount and when keyType changes
	useEffect(() => {
		const loadIndex = async () => {
			try {
				const nextIndex = await getNextSuggestedIndex(evolu, keyType);
				setDeriveIndex(nextIndex);
			} catch (error) {
				console.error("Failed to load next index:", error);
			}
		};
		void loadIndex();
	}, [evolu, keyType]);

	const handleDerive = async () => {
		if (!appOwner.mnemonic) {
			toast.error("Mnemonic not available");
			return;
		}

		setIsDeriving(true);

		const result = await deriveKeyAt(
			evolu,
			appOwner.mnemonic,
			appOwner.encryptionKey,
			deriveIndex,
			keyType,
		);

		if (result.success) {
			if (result.alreadyExists) {
				toast.success(`Wallet at index ${result.index} already exists`);
			} else {
				toast.success(`Derived wallet at index ${result.index}`);
				// Suggest next index
				setDeriveIndex(result.index + 1);
			}
		} else {
			toast.error(result.error);
		}

		setIsDeriving(false);
	};

	// Get derivation path info based on keyType
	const derivationPath =
		keyType === "evm"
			? "m/44'/60'/0'/0/index (Ethereum)"
			: keyType === "tron"
				? "m/44'/195'/0'/0/index (Tron)"
				: keyType === "btc"
					? "m/44'/0'/0'/0/index (Bitcoin)"
					: "m/44'/501'/0'/0/index (Solana)";

	return (
		<div className="card card-compact bg-base-200 shadow-xl">
			<div className="card-body">
				<h2 className="card-title">Derive Wallet</h2>

				<div role="alert" className="alert alert-info">
					<i className="fa-solid fa-info-circle" />
					<div>
						<div className="font-bold">Deterministic Key Derivation</div>
						<div className="text-sm">
							Derive wallets from your mnemonic using BIP32/BIP44 standard path:{" "}
							<code className="font-mono">{derivationPath}</code>
						</div>
					</div>
				</div>

				<fieldset className="fieldset">
					<legend className="fieldset-legend">Key Type</legend>
					<p className="fieldset-label text-sm opacity-70">
						Select the blockchain to derive a wallet for.
					</p>
					<div role="tablist" className="tabs tabs-boxed w-full">
						<button
							type="button"
							role="tab"
							className={`tab ${keyType === "evm" ? "tab-active" : ""}`}
							onClick={() => setKeyType("evm")}
							disabled={isDeriving}
						>
							EVM
						</button>
						<button
							type="button"
							role="tab"
							className={`tab ${keyType === "tron" ? "tab-active" : ""}`}
							onClick={() => setKeyType("tron")}
							disabled={isDeriving}
						>
							Tron
						</button>
						{BTC_FEATURE_FLAG && (
							<button
								type="button"
								role="tab"
								className={`tab ${keyType === "btc" ? "tab-active" : ""}`}
								onClick={() => setKeyType("btc")}
								disabled={isDeriving}
							>
								BTC
							</button>
						)}
						{SOLANA_FEATURE_FLAG && (
							<button
								type="button"
								role="tab"
								className={`tab ${keyType === "solana" ? "tab-active" : ""}`}
								onClick={() => setKeyType("solana")}
								disabled={isDeriving}
							>
								Solana
							</button>
						)}
					</div>
				</fieldset>

				<fieldset className="fieldset">
					<legend className="fieldset-legend">Derivation Index</legend>
					<p className="fieldset-label text-sm opacity-70">
						Enter the index to derive. Defaults to the next available index.
					</p>
					<div className="join w-full">
						<input
							type="number"
							min="0"
							className="input input-bordered join-item grow font-mono"
							value={deriveIndex}
							onChange={(e) =>
								setDeriveIndex(Number.parseInt(e.target.value, 10) || 0)
							}
							disabled={isDeriving}
							autoComplete="off"
							aria-label="Derivation index"
						/>
						<button
							type="button"
							className={`btn btn-primary join-item ${isDeriving ? "loading" : ""}`}
							onClick={handleDerive}
							disabled={isDeriving}
						>
							{!isDeriving && "Derive Wallet"}
						</button>
					</div>
				</fieldset>
			</div>
		</div>
	);
};
