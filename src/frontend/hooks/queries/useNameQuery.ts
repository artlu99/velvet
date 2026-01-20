import type { AppName } from "@shared/types";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "itty-fetcher";

const api = fetcher({ base: `${window.location.origin}/api` });

export const useNameQuery = () => {
	return useQuery({
		queryKey: ["name"],
		queryFn: () => api.get<AppName>("/name"),
	});
};
