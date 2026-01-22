import type { FC } from "react";

interface DeleteKeyConfirmationProps {
	address: string;
	mode: "delete" | "hide";
	derivationIndex: number | null;
	onConfirm: () => void;
	onCancel: () => void;
}

export const DeleteKeyConfirmation: FC<DeleteKeyConfirmationProps> = ({
	address,
	mode,
	derivationIndex,
	onConfirm,
	onCancel,
}) => {
	const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
	const isHide = mode === "hide";

	return (
		<div className="modal modal-open">
			<div className="modal-box">
				<h3 className="font-bold text-lg">
					{isHide ? "Hide Wallet?" : "Delete Private Key?"}
				</h3>

				{isHide ? (
					<div className="alert alert-info mb-4">
						<i
							className="fa-solid fa-info-circle h-6 w-6 shrink-0"
							aria-hidden="true"
						/>
						<div>
							<h3 className="font-bold">Hide Wallet</h3>
							<div className="text-xs">
								This wallet will be hidden from your account list. You can
								re-derive it anytime from your mnemonic at index{" "}
								{derivationIndex !== null ? (
									<code className="font-mono">{derivationIndex}</code>
								) : (
									<code className="font-mono">{truncatedAddress}</code>
								)}
								.
							</div>
						</div>
					</div>
				) : (
					<div className="alert alert-error mb-4">
						<i
							className="fa-solid fa-triangle-exclamation h-6 w-6 shrink-0"
							aria-hidden="true"
						/>
						<div>
							<h3 className="font-bold">Warning!</h3>
							<div className="text-xs">
								This action <strong>cannot be undone</strong>. If you
								haven&apos;t backed up this private key, you will{" "}
								<strong>permanently lose access</strong> to funds at{" "}
								<code className="font-mono">{truncatedAddress}</code>.
							</div>
						</div>
					</div>
				)}

				<p className="py-4">
					{isHide
						? "Derived wallets can be re-derived from your mnemonic at any time. This will only hide it from your account list."
						: "Imported keys are not recoverable from your mnemonic. Make sure you have saved this private key in a secure location before proceeding."}
				</p>

				<div className="modal-action">
					<button type="button" className="btn btn-ghost" onClick={onCancel}>
						Cancel
					</button>
					<button
						type="button"
						className={isHide ? "btn btn-secondary" : "btn btn-error"}
						onClick={onConfirm}
					>
						{isHide ? "Hide Wallet" : "Delete Key"}
					</button>
				</div>
			</div>
			<button
				type="button"
				className="modal-backdrop"
				onClick={onCancel}
				aria-label="Close modal"
			/>
		</div>
	);
};
