export const Landing = () => (
	<div className="flex-1 flex flex-col items-center justify-center px-4 py-4 min-h-0">
		<div className="container mx-auto max-w-4xl w-full flex flex-col items-center justify-center gap-6 md:gap-8 lg:gap-12 h-full">
			{/* Hero Section */}
			<div className="text-center flex-shrink-0">
				<div className="mb-6">
					<h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-2 md:mb-4 pb-1 md:pb-2 leading-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent px-2">
						Underground Velvet
					</h1>
					<div className="mb-4">
						<i className="fa-solid fa-bag-shopping text-4xl sm:text-5xl md:text-6xl text-primary opacity-80" />
					</div>
					<p className="text-base sm:text-lg md:text-xl opacity-80 max-w-2xl mx-auto px-2">
						Secure, local-first crypto wallet with private sync
					</p>
				</div>
			</div>

			{/* Image Section */}
			<div className="flex justify-center items-center flex-1 min-h-0 w-full">
				<img
					src="/3e887299569d62da0a813ec6bac7e91d.jpg"
					alt="Underground Velvet Wallet"
					className="rounded-lg shadow-xl max-w-full max-h-full w-auto h-auto object-contain"
				/>
			</div>
		</div>
	</div>
);
