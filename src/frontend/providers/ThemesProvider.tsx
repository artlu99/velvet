import { createContext, type ReactNode, useContext } from "react";
import type { Themes } from "~/constants";
import { useLocalStorageZustand } from "~/hooks/use-zustand";

export interface ThemeContextType {
	themeName: Themes | null;
	setTheme: (theme: Themes) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(
	undefined,
);

export const useTheme = (): ThemeContextType => {
	const context = useContext(ThemeContext);

	if (!context) {
		throw new Error(
			"useTheme must be used within a ThemesProvider. " +
				"Wrap your component tree with <ThemesProvider>.",
		);
	}

	return context;
};

export const ThemesProvider = ({ children }: { children: ReactNode }) => {
	const { themeName, setThemeName } = useLocalStorageZustand();

	const setTheme = (name: Themes | null) => {
		setThemeName(name);
	};

	return (
		<ThemeContext.Provider value={{ themeName, setTheme }}>
			{children}
		</ThemeContext.Provider>
	);
};
