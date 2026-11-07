"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext } from "react";

import { useTrackedTransition } from "@/modules/github-insights/ui/navigation-progress";

export const TaskRefresh = createContext<(() => void) | null>(null);

export function useTaskRefresh(): () => void {
  const router = useRouter();
  const [, startTransition] = useTrackedTransition();
  const dialog = useContext(TaskRefresh);
  return useCallback(() => {
    dialog?.();
    startTransition(() => router.refresh());
  }, [dialog, router, startTransition]);
}
