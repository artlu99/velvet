import { Mnemonic } from "@evolu/common";
import { useEvolu } from "@evolu/react";
import { localAuth } from "@evolu/react-web";
import { type FC, use, useState } from "react";
import { OwnerProfile } from "~/components/OwnerProfile";
import { formatTypeError } from "~/lib/evolu";

const authResult = await localAuth.getOwner({ service: "evolu" });

export const OwnerActions: FC = () => {
	const evolu = useEvolu();
	const appOwner = use(evolu.appOwner);

	const [showMnemonic, setShowMnemonic] = useState(false);

	// Restore owner from mnemonic to sync data across devices.
	const handleRestoreAppOwnerClick = () => {
		const mnemonic = window.prompt("Enter your mnemonic to restore your data:");
		if (mnemonic == null) return;

		const result = Mnemonic.from(mnemonic.trim());
		if (!result.ok) {
			alert(formatTypeError(result.error));
			return;
		}

		void evolu.restoreAppOwner(result.value);
	};

	const handleResetAppOwnerClick = () => {
		if (confirm("Are you sure? This will delete all your local data.")) {
			void evolu.resetAppOwner();
		}
	};

	const handleDownloadDatabaseClick = () => {
		void evolu.exportDatabase().then((array) => {
			const blob = new Blob([array], { type: "application/x-sqlite3" });
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "velvet.db3";
			a.click();
			window.URL.revokeObjectURL(url);
		});
	};

	return (
		<article className="prose dark:prose-invert">
			<div className="card card-compact">
				<div className="mt-8 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
					<h2 className="mb-4 text-lg font-medium text-gray-900">Account</h2>
					{appOwner && (
						<div className="mb-4 flex items-center justify-between gap-3">
							<OwnerProfile
								{...{
									ownerId: appOwner.id,
									username: authResult?.username ?? "Guest",
								}}
							/>
						</div>
					)}
					<p className="mb-4 text-sm text-gray-600">
						Private keys are stored unencrypted in local SQLite. During sync,
						data is encrypted in transport using your mnemonic.
					</p>

					<div className="space-y-3">
						<button
							type="button"
							className="btn btn-outline w-full"
							onClick={() => {
								setShowMnemonic(!showMnemonic);
							}}
						>{`${showMnemonic ? "Hide" : "Show"} Mnemonic`}</button>

						{showMnemonic && appOwner.mnemonic && (
							<div className="bg-gray-50 p-3">
								<label
									htmlFor="mnemonic"
									className="mb-2 block text-xs font-medium text-gray-700"
								>
									Your Mnemonic (keep this safe!)
								</label>
								<textarea
									value={appOwner.mnemonic}
									readOnly
									rows={3}
									className="w-full border-b border-gray-300 bg-white px-2 py-1 font-mono text-xs focus:border-blue-500 focus:outline-none"
								/>
							</div>
						)}

						<div className="flex gap-2">
							<button
								type="button"
								className="btn btn-outline"
								onClick={handleRestoreAppOwnerClick}
							>
								Restore from Mnemonic
							</button>
							<button
								type="button"
								className="btn btn-outline"
								onClick={handleDownloadDatabaseClick}
							>
								Download Backup
							</button>
							<button
								type="button"
								className="btn btn-outline"
								onClick={handleResetAppOwnerClick}
							>
								Reset All Data
							</button>
						</div>
					</div>
				</div>
			</div>

			<img
				src="/the-velvet-underground-now-playing-silver-vinyl-cover-art.webp"
				alt="Underground Velvet Wallet"
			/>
		</article>
	);
};
