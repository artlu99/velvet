import { useContext } from "react";
import {
	ThemeContext,
	type ThemeContextType,
} from "~/providers/ThemesProvider";

export const useThemes = (): ThemeContextType => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useThemes must be used within a ThemesProvider");
	}
	return context;
};
