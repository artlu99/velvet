import { useCallback, useEffect, useState } from "react";
import { CLIPBOARD_TIMEOUT_MS } from "~/lib/helpers";

interface UseClipboardWithTimeoutResult {
	isCopied: boolean;
	timeLeft: number;
	copiedText: string | null;
	copyToClipboard: (text: string) => Promise<void>;
}

export function useClipboardWithTimeout(
	timeoutMs = CLIPBOARD_TIMEOUT_MS,
): UseClipboardWithTimeoutResult {
	const [isCopied, setIsCopied] = useState(false);
	const [timeLeft, setTimeLeft] = useState(0);
	const [copiedText, setCopiedText] = useState<string | null>(null);

	const copyToClipboard = useCallback(
		async (text: string) => {
			if (!navigator.clipboard) return;
			try {
				await navigator.clipboard.writeText(text);
				setCopiedText(text);
				setIsCopied(true);
				setTimeLeft(Math.ceil(timeoutMs / 1000));

				// Set a timeout to clear the clipboard that persists even if the component unmounts.
				// This is a "fire-and-forget" background task.
				setTimeout(async () => {
					try {
						// Check read permission
						const readPermission = await navigator.permissions
							// @ts-expect-error - clipboard-read is not in the standard type definition yet
							.query({ name: "clipboard-read" });

						if (readPermission.state === "granted") {
							const currentContent = await navigator.clipboard.readText();
							// Only clear if the clipboard content still matches what we copied.
							// This prevents clearing if the user has since copied something else.
							if (currentContent === text) {
								await navigator.clipboard.writeText("");
							}
						} else {
							// Fallback: blind clear if we can't verify
							// Note: This is risky if the user copied something else in the meantime,
							// but standard behavior for password managers without read permissions.
							await navigator.clipboard.writeText("");
						}
					} catch {
						// If permission query fails or read fails, attempt blind clear
						void navigator.clipboard.writeText("");
					}
				}, timeoutMs);
			} catch (err) {
				console.error("Failed to copy!", err);
			}
		},
		[timeoutMs],
	);

	// Separate effect for the UI countdown timer.
	// This CAN be cleared on unmount, as it's purely visual.
	useEffect(() => {
		if (!isCopied || !copiedText) return;

		const startTime = Date.now();
		const endTime = startTime + timeoutMs;

		const intervalId = setInterval(() => {
			const remaining = Math.ceil((endTime - Date.now()) / 1000);

			if (remaining <= 0) {
				clearInterval(intervalId);
				setIsCopied(false);
				setCopiedText(null);
				setTimeLeft(0);
			} else {
				setTimeLeft(remaining);
			}
		}, 1000);

		return () => clearInterval(intervalId);
	}, [isCopied, copiedText, timeoutMs]);

	return { isCopied, timeLeft, copiedText, copyToClipboard };
}
