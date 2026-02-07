import { useQuery } from "@tanstack/react-query";
import { apiCall } from "@/lib/_core/api";

export function useFeatures() {
  const q = useQuery({
    queryKey: ["features"],
    queryFn: async () => {
      const data = await apiCall<any>("/features");
      return (data?.features ?? null) as string[] | null;
    },
    staleTime: 60_000,
  });

  const features = (q.data ?? null) as string[] | null;
  const has = (code: string) => !features || features.includes(code);

  return { ...q, features, has };
}
