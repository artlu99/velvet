import useEmblaCarousel from "embla-carousel-react";
import { useEffect } from "react";

interface WalletCarouselProps<T extends { id: string }> {
	readonly wallets: readonly T[];
	readonly currentIndex: number;
	readonly onIndexChange: (index: number) => void;
	readonly renderWallet: (wallet: T, index: number) => React.ReactNode;
}

/**
 * Mobile wallet carousel with horizontal swipe support.
 * Hidden on desktop via CSS (block sm:hidden).
 *
 * Generic type T allows flexibility in wallet data structure.
 */
export const WalletCarousel = <T extends { id: string }>({
	wallets,
	currentIndex,
	onIndexChange,
	renderWallet,
}: WalletCarouselProps<T>) => {
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
					{wallets.map((wallet, index) => (
						<div key={wallet.id} className="flex-shrink-0 w-full min-w-0">
							<div className="flex items-center justify-center px-2 sm:px-4">
								<div className="w-full max-w-lg">
									{renderWallet(wallet, index)}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};
