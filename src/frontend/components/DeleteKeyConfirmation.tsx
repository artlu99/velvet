import type { FC } from "react";

interface DeleteKeyConfirmationProps {
	address: string;
	onConfirm: () => void;
	onCancel: () => void;
}

export const DeleteKeyConfirmation: FC<DeleteKeyConfirmationProps> = ({
	address,
	onConfirm,
	onCancel,
}) => {
	const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

	return (
		<div className="modal modal-open">
			<div className="modal-box">
				<h3 className="font-bold text-lg">Delete Private Key?</h3>

				<div className="alert alert-error mb-4">
					<i
						className="fa-solid fa-triangle-exclamation h-6 w-6 shrink-0"
						aria-hidden="true"
					/>
					<div>
						<h3 className="font-bold">Warning!</h3>
						<div className="text-xs">
							This action <strong>cannot be undone</strong>. If you haven&apos;t
							backed up this private key, you will{" "}
							<strong>permanently lose access</strong> to funds at{" "}
							<code className="font-mono">{truncatedAddress}</code>.
						</div>
					</div>
				</div>

				<p className="py-4">
					Imported keys are not recoverable from your mnemonic. Make sure you
					have saved this private key in a secure location before proceeding.
				</p>

				<div className="modal-action">
					<button type="button" className="btn btn-ghost" onClick={onCancel}>
						Cancel
					</button>
					<button type="button" className="btn btn-error" onClick={onConfirm}>
						Delete Key
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
