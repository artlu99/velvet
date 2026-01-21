import { sqliteFalse } from "@evolu/common";
import { useEvolu } from "@evolu/react";
import { type FC, useState } from "react";
import toast from "react-hot-toast";
import * as v from "valibot";
import { EvmPrivateKeySchema, validateAndDeriveAddress } from "~/lib/crypto";
import { createEoaDuplicateCheckQuery } from "~/lib/queries/eoa";
import type { EoaInsert } from "~/lib/schema";

export const ImportPrivateKey: FC = () => {
	const evolu = useEvolu();
	const [privateKey, setPrivateKey] = useState("");
	const [showKey, setShowKey] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleImport = async () => {
		setError(null);
		setIsLoading(true);

		// Validate format
		const keyResult = v.safeParse(EvmPrivateKeySchema, privateKey.trim());
		if (!keyResult.success) {
			setError(
				"Invalid private key format. Must be 0x followed by 64 hex characters.",
			);
			setIsLoading(false);
			return;
		}

		// Derive address and verify
		const derivationResult = validateAndDeriveAddress(keyResult.output);
		if (!derivationResult.ok) {
			setError(derivationResult.error);
			setIsLoading(false);
			return;
		}

		const { address } = derivationResult;
		const unencryptedPrivateKey = keyResult.output;

		const duplicateCheckQuery = createEoaDuplicateCheckQuery(
			evolu,
			address,
			unencryptedPrivateKey,
		);

		const duplicateRows = await evolu.loadQuery(duplicateCheckQuery);

		// Check results and provide specific error messages
		if (duplicateRows.length > 0) {
			const hasAddressMatch = duplicateRows.some(
				(row) => row.address === address,
			);
			const hasKeyMatch = duplicateRows.some(
				(row) => row.unencryptedPrivateKey === unencryptedPrivateKey,
			);

			if (hasKeyMatch) {
				setError("This private key is already in your wallet.");
				setIsLoading(false);
				return;
			}
			if (hasAddressMatch) {
				setError("This address is already in your wallet.");
				setIsLoading(false);
				return;
			}
		}

		const insertData: EoaInsert = {
			address,
			unencryptedPrivateKey,
			keyType: "evm",
			origin: "imported",
			isSelected: sqliteFalse,
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
		setPrivateKey("");
		setIsLoading(false);
		toast.success("Private key imported successfully!");
	};

	return (
		<div className="card card-compact bg-base-200 shadow-xl">
			<div className="card-body">
				<h2 className="card-title">Import Private Key</h2>

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
					<legend className="fieldset-legend">EVM Private Key</legend>
					<div className="join w-full">
						<input
							type={showKey ? "text" : "password"}
							placeholder="0x..."
							className={`input join-item grow font-mono text-sm ${error ? "input-error" : ""}`}
							value={privateKey}
							onChange={(e) => setPrivateKey(e.target.value)}
							maxLength={66}
							autoComplete="off"
							disabled={isLoading}
						/>
						<button
							type="button"
							className="btn btn-soft join-item btn-square"
							onClick={() => setShowKey(!showKey)}
							disabled={isLoading}
							aria-label={showKey ? "Hide private key" : "Show private key"}
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
						disabled={!privateKey || isLoading}
					>
						{!isLoading && "Import Key"}
					</button>
				</div>
			</div>
		</div>
	);
};
