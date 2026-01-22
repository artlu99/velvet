import { Mnemonic } from "@evolu/common";
import { useEvolu } from "@evolu/react";
import { type FC, use, useState } from "react";
import { formatTypeError } from "~/lib/evolu";

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
		<div className="container mx-auto px-4 py-8 max-w-4xl space-y-12">
			{/* Hero Section */}
			<div className="text-center">
				<div className="mb-6">
					<div className="mb-4">
						<i className="fa-solid fa-database text-6xl text-primary opacity-80" />
					</div>
					<h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
						Data Settings
					</h1>
					<p className="text-lg opacity-80 max-w-2xl mx-auto">
						Sync and Export across your devices
					</p>
				</div>
			</div>

			{/* Data Card */}
			<div className="card bg-base-100 shadow-xl">
				<div className="card-body">
					<div className="alert alert-info mb-6">
						<i className="fa-solid fa-info-circle" />
						<div>
							<p className="text-sm">
								Private keys are stored unencrypted in local SQLite. During
								sync, data is encrypted in transport using your mnemonic.
							</p>
						</div>
					</div>

					<div className="space-y-4">
						<button
							type="button"
							className="btn btn-outline w-full"
							onClick={() => {
								setShowMnemonic(!showMnemonic);
							}}
						>
							<i
								className={`fa-solid ${showMnemonic ? "fa-eye-slash" : "fa-eye"} mr-2`}
							/>
							{showMnemonic ? "Hide" : "Show"} Mnemonic
						</button>

						{showMnemonic && appOwner.mnemonic && (
							<div className="card bg-base-200">
								<div className="card-body">
									<label htmlFor="mnemonic" className="label">
										<span className="label-text font-semibold">
											<i className="fa-solid fa-key mr-2" />
											Your Mnemonic (keep this safe!)
										</span>
									</label>
									<textarea
										id="mnemonic"
										value={appOwner.mnemonic}
										readOnly
										rows={3}
										className="textarea textarea-bordered font-mono text-sm bg-base-100"
									/>
									<div className="label">
										<span className="label-text-alt text-warning">
											<i className="fa-solid fa-exclamation-triangle mr-1" />
											Never share this mnemonic with anyone
										</span>
									</div>
								</div>
							</div>
						)}

						<div className="divider">Actions</div>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
							<button
								type="button"
								className="btn btn-outline"
								onClick={handleRestoreAppOwnerClick}
							>
								<i className="fa-solid fa-rotate-left mr-2" />
								Restore
							</button>
							<button
								type="button"
								className="btn btn-outline"
								onClick={handleDownloadDatabaseClick}
							>
								<i className="fa-solid fa-download mr-2" />
								Download Backup
							</button>
							<button
								type="button"
								className="btn btn-outline btn-error"
								onClick={handleResetAppOwnerClick}
							>
								<i className="fa-solid fa-trash mr-2" />
								Reset All
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Image Section */}
			<div className="flex justify-center mt-12">
				<img
					src="/the-velvet-underground-now-playing-silver-vinyl-cover-art.webp"
					alt="Underground Velvet Wallet"
					className="rounded-lg shadow-xl max-w-full h-auto"
				/>
			</div>
		</div>
	);
};
