import { QRCodeSVG } from "qrcode.react";
import type { FC } from "react";
import toast from "react-hot-toast";
import { useClipboardWithTimeout } from "~/hooks/useClipboardWithTimeout";
import { CLIPBOARD_TIMEOUT_MS } from "~/lib/helpers";

type Network = "ethereum" | "base" | "tron";

interface QRCodeDisplayProps {
	/** Wallet address to display */
	readonly address: string;
	/** Network for display label */
	readonly network: Network;
	/** QR code size in pixels (default: 256) */
	readonly size?: number;
}

export const QRCodeDisplay: FC<QRCodeDisplayProps> = ({
	address,
	network,
	size = 256,
}) => {
	const { isCopied, timeLeft, copyToClipboard } =
		useClipboardWithTimeout(CLIPBOARD_TIMEOUT_MS);

	const handleCopy = async () => {
		try {
			await copyToClipboard(address);
			toast.success("Address copied!");
		} catch {
			toast.error("Failed to copy address");
		}
	};

	// Derive network label and badge color
	const networkLabel =
		network === "ethereum" ? "Ethereum" : network === "base" ? "Base" : "Tron";
	const networkBadgeClass =
		network === "ethereum"
			? "badge-primary"
			: network === "base"
				? "badge-neutral"
				: "badge-secondary";

	return (
		<div className="flex flex-col items-center gap-4">
			{/* QR Code */}
			<div className="bg-white p-4 rounded-lg shadow-md">
				<QRCodeSVG
					value={address}
					size={size}
					level="M"
					includeMargin={false}
					aria-label={`QR code for address ${address}`}
				/>
			</div>

			{/* Address display */}
			<div className="w-full max-w-md">
				<div className="flex items-center justify-between gap-2 bg-base-200 rounded-lg p-3">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<span className="text-xs font-medium opacity-70">Network:</span>
							<span className={`badge badge-sm ${networkBadgeClass}`}>
								{networkLabel}
							</span>
						</div>
						<div className="font-mono text-sm break-all" title={address}>
							{address}
						</div>
					</div>
					<button
						type="button"
						className="btn btn-ghost btn-sm btn-circle shrink-0"
						onClick={handleCopy}
						aria-label="Copy address to clipboard"
						title="Copy address"
					>
						{isCopied ? (
							<i
								className="fa-solid fa-check h-4 w-4 text-success"
								aria-hidden="true"
							/>
						) : (
							<i className="fa-solid fa-copy h-4 w-4" aria-hidden="true" />
						)}
					</button>
				</div>
				{isCopied && (
					<div className="text-center text-xs text-info mt-1">
						<i className="fa-solid fa-clock mr-1" />
						Clipboard clears in {timeLeft}s
					</div>
				)}
			</div>

			{/* Help text */}
			<div className="text-center text-sm opacity-70">
				<i className="fa-solid fa-info-circle mr-1" aria-hidden="true" />
				Scan with your wallet app to send funds
			</div>
		</div>
	);
};
