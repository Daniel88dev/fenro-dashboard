"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useTransition } from "react";

export const TaskRefresh = createContext<(() => void) | null>(null);

export function useTaskRefresh(): () => void {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const dialog = useContext(TaskRefresh);
  return useCallback(() => {
    dialog?.();
    startTransition(() => router.refresh());
  }, [dialog, router]);
}
