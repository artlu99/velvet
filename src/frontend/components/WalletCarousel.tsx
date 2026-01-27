import useEmblaCarousel from "embla-carousel-react";
import { useEffect } from "react";

interface WalletCarouselProps {
	readonly wallets: readonly EoaRow[];
	readonly currentIndex: number;
	readonly onIndexChange: (index: number) => void;
	readonly renderWallet: (wallet: EoaRow) => React.ReactNode;
}

import type { EoaRow } from "~/lib/eoaValidation";

/**
 * Mobile wallet carousel with horizontal swipe support.
 * Hidden on desktop via CSS (block sm:hidden).
 */
export const WalletCarousel = ({
	wallets,
	currentIndex,
	onIndexChange,
	renderWallet,
}: WalletCarouselProps) => {
	const [emblaRef, emblaApi] = useEmblaCarousel({
		loop: false,
		align: "center",
		skipSnaps: false,
		dragFree: false,
		startIndex: currentIndex,
	});

	// Sync carousel when currentIndex prop changes (external updates)
	useEffect(() => {
		if (!emblaApi) return;

		const currentSnap = emblaApi.selectedScrollSnap();
		if (currentSnap !== currentIndex && currentIndex < wallets.length) {
			emblaApi.scrollTo(currentIndex);
		}
	}, [emblaApi, currentIndex, wallets.length]);

	// Track index changes from user swipes
	useEffect(() => {
		if (!emblaApi) return;

		const onSelect = () => {
			const index = emblaApi.selectedScrollSnap();
			onIndexChange(index);
		};

		emblaApi.on("select", onSelect);
		emblaApi.on("settle", onSelect);

		return () => {
			emblaApi.off("select", onSelect);
			emblaApi.off("settle", onSelect);
		};
	}, [emblaApi, onIndexChange]);

	return (
		<div className="block sm:hidden">
			<div className="overflow-hidden" ref={emblaRef}>
				<div className="flex">
					{wallets.map((wallet) => (
						<div key={wallet.id} className="flex-shrink-0 w-full min-w-0">
							<div className="flex items-center justify-center px-2 sm:px-4">
								<div className="w-full max-w-lg">{renderWallet(wallet)}</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};
