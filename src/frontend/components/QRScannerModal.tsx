import type { FC } from "react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { QrReader } from "react-qr-reader";

interface QRScannerModalProps {
	isOpen: boolean;
	onClose: () => void;
	onScanSuccess: (data: string) => void;
}

export const QRScannerModal: FC<QRScannerModalProps> = ({
	isOpen,
	onClose,
	onScanSuccess,
}) => {
	const [isSupported, setIsSupported] = useState(true);

	// Check if camera is supported
	useEffect(() => {
		if (!isOpen) return;

		// Check if getUserMedia is supported
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			setIsSupported(false);
			toast.error("Camera not supported in this browser");
			return;
		}

		// Check if we're on iOS
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
		if (isIOS) {
			console.log("iOS detected - camera access may require HTTPS");
		}
	}, [isOpen]);

	// Fix iOS video rendering
	useEffect(() => {
		if (!isOpen) return;

		// iOS requires specific video attributes for inline playback
		const fixIOSVideo = () => {
			const video = document.getElementById("qr-video") as HTMLVideoElement;
			if (!video) return;

			// Required for iOS inline video playback
			video.setAttribute("playsinline", "");
			video.setAttribute("webkit-playsinline", "");
			video.setAttribute("autoplay", "");
			video.setAttribute("muted", "");
			video.muted = true;
			video.autoplay = true;

			// Ensure video is visible
			video.style.display = "block";
			video.style.visibility = "visible";
			video.style.opacity = "1";

			// Force play (iOS sometimes needs explicit play call)
			video.play().catch(() => {
				// Ignore errors if already playing
			});
		};

		// Try multiple times as QrReader creates video element asynchronously
		const timeouts = [100, 300, 500, 1000, 2000].map((delay) =>
			setTimeout(fixIOSVideo, delay),
		);

		return () => {
			for (const timeout of timeouts) {
				clearTimeout(timeout);
			}
		};
	}, [isOpen]);

	// Handle QR code detection
	const handleScan = (result: string | null) => {
		if (result) {
			onScanSuccess(result);
			onClose();
		}
	};

	if (!isOpen) return null;

	if (!isSupported) {
		return (
			<div className="modal modal-open">
				<div className="modal-box max-w-lg mx-auto">
					<h3 className="font-bold text-lg">Scan QR Code</h3>
					<div className="alert alert-warning mt-4">
						<i
							className="fa-solid fa-triangle-exclamation shrink-0"
							aria-hidden="true"
						/>
						<span>
							Camera not supported. Please ensure you're using HTTPS or try on a
							different device.
						</span>
					</div>
					<div className="modal-action">
						<button type="button" className="btn btn-ghost" onClick={onClose}>
							Close
						</button>
					</div>
				</div>
				<button
					className="modal-backdrop"
					onClick={onClose}
					type="button"
					aria-label="Close modal"
				/>
			</div>
		);
	}

	return (
		<div className="modal modal-open">
			<div className="modal-box max-w-lg mx-auto">
				<h3 className="font-bold text-lg">Scan QR Code</h3>

				{/* iOS warning */}
				{/iPad|iPhone|iPod/.test(navigator.userAgent) && (
					<div className="alert alert-info mt-4 text-sm">
						<span>
							<strong>iOS Tip:</strong> If camera doesn't load, ensure the app
							is open in Safari (not Chrome) and tap Allow when prompted.
						</span>
					</div>
				)}

				{/* Camera feed */}
				<div className="w-full bg-black rounded-lg mt-4 relative" style={{ height: "400px" }}>
					<QrReader
						videoId="qr-video"
						videoStyle={{
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							height: "100%",
							objectFit: "cover",
						}}
						videoContainerStyle={{
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							height: "100%",
						}}
						onResult={(result) => {
							if (result) {
								handleScan(result.getText());
							}
						}}
						constraints={{ facingMode: "environment" }}
					/>
				</div>

				<p className="text-xs text-center mt-4 opacity-70">
					Position the QR code within the frame to scan
				</p>

				{/* Actions */}
				<div className="modal-action">
					<button type="button" className="btn btn-ghost" onClick={onClose}>
						Cancel
					</button>
				</div>
			</div>
			<button
				className="modal-backdrop"
				onClick={onClose}
				type="button"
				aria-label="Close modal"
			/>
		</div>
	);
};
