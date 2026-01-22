import { useEvolu } from "@evolu/react";
import { type FC, use, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { deriveKeyAt } from "~/lib/bip32";
import { getNextSuggestedIndex } from "~/lib/queries/derivation";

export const DeriveWallet: FC = () => {
	const evolu = useEvolu();
	const appOwner = use(evolu.appOwner);

	const [deriveIndex, setDeriveIndex] = useState(0);
	const [isDeriving, setIsDeriving] = useState(false);

	// Load initial suggested index on mount
	useEffect(() => {
		const loadIndex = async () => {
			try {
				const nextIndex = await getNextSuggestedIndex(evolu, "evm");
				setDeriveIndex(nextIndex);
			} catch (error) {
				console.error("Failed to load next index:", error);
			}
		};
		void loadIndex();
	}, [evolu]);

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

	return (
		<div className="card card-compact bg-base-200 shadow-xl">
			<div className="card-body">
				<h2 className="card-title">Derive Wallet</h2>

				<div role="alert" className="alert alert-info">
					<i className="fa-solid fa-info-circle" />
					<div>
						<div className="font-bold">Deterministic Key Derivation</div>
						<div className="text-sm">
							Derive wallets from your mnemonic using BIP32/BIP44 standard path
							m/44'/60'/0'/0/index
						</div>
					</div>
				</div>

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
