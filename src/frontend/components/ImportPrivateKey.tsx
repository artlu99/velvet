import { sqliteFalse } from "@evolu/common";
import { useEvolu } from "@evolu/react";
import { type FC, useState } from "react";
import toast from "react-hot-toast";
import { encryptPrivateKey, validateImportInput } from "~/lib/crypto";
import { createEoaDuplicateCheckQuery } from "~/lib/queries/eoa";
import type { EoaInsert } from "~/lib/schema";

export const ImportPrivateKey: FC = () => {
	const evolu = useEvolu();
	const [importInput, setImportInput] = useState("");
	const [showKey, setShowKey] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleImport = async () => {
		setError(null);
		setIsLoading(true);

		// Validate input (auto-detects private key vs address)
		const validationResult = validateImportInput(importInput);
		if (!validationResult.ok) {
			setError(validationResult.error);
			setIsLoading(false);
			return;
		}

		const {
			type,
			address,
			privateKey: unencryptedPrivateKey,
		} = validationResult;
		const isWatchOnly = type === "address";

		// Show warning for watch-only addresses
		if (isWatchOnly) {
			toast(
				"Watch-only address: You can receive funds but cannot send transactions.",
				{
					icon: "👁️",
					duration: 5000,
				},
			);
		}

		const duplicateCheckQuery = createEoaDuplicateCheckQuery(evolu, address);
		const duplicateRows = await evolu.loadQuery(duplicateCheckQuery);

		// Check for duplicate address
		if (duplicateRows.length > 0) {
			setError("This address is already in your wallet.");
			setIsLoading(false);
			return;
		}

		// Encrypt private key (if not watch-only)
		let encryptedPrivateKey: string | null = null;
		if (!isWatchOnly && unencryptedPrivateKey) {
			const owner = await evolu.appOwner;
			encryptedPrivateKey = encryptPrivateKey(
				unencryptedPrivateKey,
				owner.encryptionKey,
			);
		}

		const insertData: EoaInsert = {
			address,
			encryptedPrivateKey,
			keyType: "evm",
			origin: isWatchOnly ? "watchOnly" : "imported",
			isSelected: sqliteFalse,
			derivationIndex: null,
		};

		// Insert after duplicate check
		// Note: Small race condition window exists between check and insert
		const result = evolu.insert("eoa", insertData);
		if (!result.ok) {
			setError(
				`Failed to import key. Error: ${JSON.stringify(result.error, null, 2)}`,
			);
			setIsLoading(false);
			return;
		}

		// Clear sensitive data
		setImportInput("");
		setIsLoading(false);
		toast.success(
			isWatchOnly
				? "Watch-only address imported successfully!"
				: "Private key imported successfully!",
		);
	};

	return (
		<div className="card card-compact bg-base-200 shadow-xl">
			<div className="card-body">
				<h2 className="card-title">Import Private Key or Address</h2>

				<div role="alert" className="alert alert-warning">
					<i className="fa-solid fa-triangle-exclamation shrink-0" />
					<div>
						<div className="font-bold">Important!</div>
						<div className="text-sm">
							Imported keys are <strong>not recoverable</strong> from your
							mnemonic phrase. Only import keys you have backed up securely
							elsewhere.
						</div>
					</div>
				</div>

				<fieldset className="fieldset">
					<legend className="fieldset-legend">Private Key or Address</legend>
					<div className="join w-full">
						<input
							type={showKey ? "text" : "password"}
							placeholder="0x..."
							className={`input join-item grow font-mono text-sm ${error ? "input-error" : ""}`}
							value={importInput}
							onChange={(e) => setImportInput(e.target.value)}
							maxLength={66}
							autoComplete="off"
							disabled={isLoading}
						/>
						<button
							type="button"
							className="btn btn-soft join-item btn-square"
							onClick={() => setShowKey(!showKey)}
							disabled={isLoading}
							aria-label={showKey ? "Hide" : "Show"}
						>
							<i
								className={`fa-solid ${showKey ? "fa-eye-slash" : "fa-eye"}`}
							/>
						</button>
					</div>
					{error && <p className="fieldset-label text-error">{error}</p>}
				</fieldset>

				<div className="card-actions justify-end">
					<button
						type="button"
						className={`btn btn-primary ${isLoading ? "loading" : ""}`}
						onClick={handleImport}
						disabled={!importInput || isLoading}
					>
						{!isLoading && "Import Key"}
					</button>
				</div>
			</div>
		</div>
	);
};
