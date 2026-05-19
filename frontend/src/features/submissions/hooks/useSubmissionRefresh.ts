import { useCallback, useEffect, useRef, useState } from "react";

type RefreshState<T> = {
  data: T | null;
  error: unknown;
  isLoading: boolean;
  isRefreshing: boolean;
  lastCheckedAt: string | null;
};

const initialState = {
  data: null,
  error: null,
  isLoading: true,
  isRefreshing: false,
  lastCheckedAt: null,
};

export function useSubmissionRefresh<T>(load: () => Promise<T>, refreshKey: string) {
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const loadRef = useRef(load);
  const [state, setState] = useState<RefreshState<T>>(initialState);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const run = useCallback(async (mode: "initial" | "manual" = "manual") => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((current) => ({
      ...current,
      error: null,
      isLoading: mode === "initial" && current.data === null,
      isRefreshing: mode === "manual",
    }));

    try {
      const data = await loadRef.current();
      if (!isMountedRef.current || requestIdRef.current !== requestId) {
        return;
      }
      setState({
        data,
        error: null,
        isLoading: false,
        isRefreshing: false,
        lastCheckedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (!isMountedRef.current || requestIdRef.current !== requestId) {
        return;
      }
      setState((current) => ({
        ...current,
        error,
        isLoading: false,
        isRefreshing: false,
      }));
    }
  }, []);

  useEffect(() => {
    setState(initialState);
    void run("initial");
  }, [refreshKey, run]);

  return {
    ...state,
    refresh: run,
  };
}
