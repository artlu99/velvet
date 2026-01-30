import { Mnemonic } from "@evolu/common";
import { featureFlags } from "@shared/feature-flags";
import { use, useState } from "react";
import { useClipboardWithTimeout } from "~/hooks/useClipboardWithTimeout";
import { ENS_WSS_URLS } from "~/lib/constants";
import { formatTypeError, useEvolu } from "~/lib/evolu";
import { CLIPBOARD_TIMEOUT_MS } from "~/lib/helpers";

export const DataActions = () => {
	const evolu = useEvolu();
	const appOwner = use(evolu.appOwner);

	const { isCopied, timeLeft, copyToClipboard } =
		useClipboardWithTimeout(CLIPBOARD_TIMEOUT_MS);

	const [showRestoreModal, setShowRestoreModal] = useState(false);
	const [mnemonicInput, setMnemonicInput] = useState("");
	const [restoreError, setRestoreError] = useState<string | null>(null);

	// Restore owner from mnemonic to sync data across devices.
	const handleRestoreAppOwnerClick = () => {
		setShowRestoreModal(true);
		setMnemonicInput("");
		setRestoreError(null);
	};

	const handleRestoreSubmit = () => {
		const trimmed = mnemonicInput.trim();
		if (!trimmed) {
			setRestoreError("Mnemonic is required");
			return;
		}

		const result = Mnemonic.from(trimmed);
		if (!result.ok) {
			setRestoreError(formatTypeError(result.error));
			return;
		}

		setRestoreError(null);
		setShowRestoreModal(false);
		setMnemonicInput("");
		void evolu.restoreAppOwner(result.value);
	};

	const handleRestoreCancel = () => {
		setShowRestoreModal(false);
		setMnemonicInput("");
		setRestoreError(null);
	};

	const handleResetAppOwnerClick = () => {
		if (confirm("Are you sure? This will delete all your local data.")) {
			void evolu.resetAppOwner();
		}
	};

	const handleCopyMnemonic = async () => {
		if (appOwner?.mnemonic) {
			await copyToClipboard(appOwner.mnemonic);
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
						<i className="fa-solid fa-cloud-bolt text-6xl text-primary opacity-80" />
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
						{appOwner?.mnemonic && (
							<div className="card bg-base-200">
								<div className="card-body">
									<label htmlFor="mnemonic" className="label">
										<span className="label-text font-semibold">
											<i className="fa-solid fa-key mr-2" />
											Your Mnemonic (keep this safe!)
										</span>
									</label>
									<div className="flex gap-2">
										<input
											id="mnemonic"
											value="•••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••"
											readOnly
											className="input input-bordered font-mono text-sm bg-base-100 w-full"
											type="text"
										/>
										<button
											type="button"
											className="btn btn-square btn-outline"
											onClick={handleCopyMnemonic}
											title="Copy Mnemonic"
										>
											<i
												className={`fa-solid ${isCopied ? "fa-check" : "fa-copy"}`}
											/>
										</button>
									</div>
									<div className="label flex-col items-start gap-1">
										<span className="label-text-alt text-warning">
											<i className="fa-solid fa-exclamation-triangle mr-1" />
											Never share this mnemonic with anyone
										</span>
										{isCopied && (
											<span className="label-text-alt text-info">
												<i className="fa-solid fa-clock mr-1" />
												Clipboard clears in {timeLeft}s
											</span>
										)}
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

						{/* Restore Modal */}
						{showRestoreModal && (
							<div className="modal modal-open">
								<div className="modal-box">
									<h3 className="font-bold text-lg mb-4">
										Restore from Mnemonic
									</h3>
									<p className="text-sm opacity-70 mb-4">
										Enter your mnemonic phrase to restore your data across
										devices.
									</p>
									<div className="form-control">
										<label className="label" htmlFor="restore-mnemonic">
											<span className="label-text">Mnemonic Phrase</span>
										</label>
										<input
											id="restore-mnemonic"
											type="password"
											className={`input input-bordered font-mono ${
												restoreError ? "input-error" : ""
											}`}
											placeholder="Enter your 12 or 24 word mnemonic phrase"
											value={mnemonicInput}
											onChange={(e) => {
												setMnemonicInput(e.target.value);
												setRestoreError(null);
											}}
											autoComplete="new-password"
											data-1p-ignore
											data-lpignore="true"
											data-form-type="other"
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													handleRestoreSubmit();
												} else if (e.key === "Escape") {
													handleRestoreCancel();
												}
											}}
										/>
										{restoreError && (
											<div className="label">
												<span className="label-text-alt text-error">
													{restoreError}
												</span>
											</div>
										)}
									</div>
									<div className="modal-action">
										<button
											type="button"
											className="btn btn-ghost"
											onClick={handleRestoreCancel}
										>
											Cancel
										</button>
										<button
											type="button"
											className="btn btn-primary"
											onClick={handleRestoreSubmit}
										>
											Restore
										</button>
									</div>
								</div>
								<button
									type="button"
									className="modal-backdrop"
									onClick={handleRestoreCancel}
									aria-label="Close modal"
								/>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* RPC Settings Card */}
			<div className="card bg-base-100 shadow-xl">
				<div className="card-body">
					<div className="alert alert-info mb-6">
						<i className="fa-solid fa-info-circle" />
						<div>
							<p className="text-sm">
								Ethereum mainnet WSS endpoints used for ENS/Basename in the
								browser. Backend RPCs (Ethereum, Base, Trongrid) are in{" "}
								<code>wrangler.jsonc</code>.
							</p>
						</div>
					</div>
					<div className="card bg-base-200">
						<div className="card-body">
							<h3 className="card-title">ENS / Basename (client)</h3>
							<p className="text-sm opacity-70">
								{ENS_WSS_URLS.map((url) => (
									<div key={url}>{url}</div>
								))}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Image Section */}
			{featureFlags.MUSIC_LINKS.enabled && (
				<div className="flex justify-center mt-12">
					<a
						href="https://youtu.be/uqAN9Ox2Stw?si=501QygjKvQPXaAPk"
						target="_blank"
						rel="noopener noreferrer"
					>
						<img
							src={`/${featureFlags.MUSIC_LINKS.assets.nowPlaying}`}
							alt="Underground Velvet Wallet"
							className="rounded-lg shadow-xl max-w-full h-auto"
						/>
					</a>
				</div>
			)}
		</div>
	);
};
