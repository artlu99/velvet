import { sqliteFalse, sqliteTrue } from "@evolu/common";
import { useEvolu } from "@evolu/react";
import { type FC, useState } from "react";
import toast from "react-hot-toast";
import { encryptPrivateKey, validateImportInput } from "~/lib/crypto";
import {
	findEoaByAddressCaseInsensitive,
	normalizeAddressForQuery,
} from "~/lib/queries/eoa";
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

		const { type, address: rawAddress, keyType } = validationResult;
		const isWatchOnly = type === "address";
		const unencryptedPrivateKey =
			validationResult.ok && type === "privateKey"
				? validationResult.privateKey
				: null;

		// Normalize address for consistent storage (checksummed for EVM)
		const address = normalizeAddressForQuery(rawAddress);

		// Check for existing record (including deleted ones) with case-insensitive matching
		const existingRecord = await findEoaByAddressCaseInsensitive(
			evolu,
			address,
		);

		// Handle existing record scenarios
		if (existingRecord) {
			// Check isDeleted using sqliteTrue pattern (Evolu SqliteBoolean)
			const isDeleted = existingRecord.isDeleted === sqliteTrue;
			const hasPrivateKey = existingRecord.encryptedPrivateKey !== null;
			const isExistingWatchOnly = existingRecord.origin === "watchOnly";

			// Scenario: Importing watch-only when full wallet exists (prevent downgrade)
			if (isWatchOnly && hasPrivateKey && !isDeleted) {
				setError(
					"This wallet already has a private key. Cannot import as watch-only.",
				);
				setIsLoading(false);
				return;
			}

			// Scenario: Importing watch-only when watch-only already exists (no change needed)
			if (isWatchOnly && isExistingWatchOnly && !isDeleted) {
				setError("This address is already in your wallet as watch-only.");
				setIsLoading(false);
				return;
			}

			// Scenario: Importing private key when full wallet already exists
			if (!isWatchOnly && hasPrivateKey && !isDeleted) {
				setError("This wallet already has a private key.");
				setIsLoading(false);
				return;
			}

			// Scenario: Upgrade watch-only to full wallet OR restore deleted wallet
			if (!isWatchOnly && (isExistingWatchOnly || isDeleted)) {
				const owner = await evolu.appOwner;
				const encryptedPrivateKey = encryptPrivateKey(
					unencryptedPrivateKey as string,
					owner.encryptionKey,
				);

				// Update existing record: add key, change origin, restore if deleted
				evolu.update("eoa", {
					id: existingRecord.id,
					address, // Update to normalized (checksummed) format
					encryptedPrivateKey,
					keyType,
					origin: "imported",
					isDeleted: sqliteFalse, // Restore if was deleted
					// Preserve isSelected state
				});

				setImportInput("");
				setIsLoading(false);

				if (isDeleted && isExistingWatchOnly) {
					toast.success("Deleted watch-only wallet restored with private key!");
				} else if (isDeleted) {
					toast.success("Wallet restored with private key!");
				} else {
					toast.success("Private key added to existing watch-only wallet!");
				}
				return;
			}

			// Scenario: Restore deleted watch-only as watch-only
			if (isWatchOnly && isDeleted) {
				evolu.update("eoa", {
					id: existingRecord.id,
					address, // Update to normalized format
					isDeleted: sqliteFalse,
					// Preserve other fields
				});

				setImportInput("");
				setIsLoading(false);
				toast.success("Watch-only wallet restored!");
				return;
			}
		}

		// No existing record - insert new wallet
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
			keyType,
			origin: isWatchOnly ? "watchOnly" : "imported",
			isSelected: sqliteFalse,
			derivationIndex: null,
		};

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
					<legend className="fieldset-legend">
						Private Key or Address (EVM or Tron)
					</legend>
					<div className="join w-full">
						<input
							type={showKey ? "text" : "password"}
							placeholder="0x... or T..."
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
					<p className="fieldset-label text-sm opacity-70">
						Auto-detects: EVM (0x...), Tron (T...), or ENS (.eth)
					</p>
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
