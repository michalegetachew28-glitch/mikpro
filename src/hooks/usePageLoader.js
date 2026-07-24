import { useState, useRef, useCallback, useEffect } from 'react';

const DEFAULT_MIN_DURATION = 300;   // ms – prevents flash
const DEFAULT_TIMEOUT = 15000;      // ms – shows error after 15s

/**
 * usePageLoader
 *
 * Manages full-page loading state with:
 *  • Minimum display time (avoids flash for fast loads)
 *  • Auto-timeout with error state after 15 s
 *  • AbortController cleanup on unmount / re-execute
 *  • Always clears loading in finally (timeout, error, success)
 *
 * Usage:
 *   const { loading, error, execute, reset } = usePageLoader();
 *
 *   useEffect(() => {
 *     execute(async (signal) => {
 *       const data = await api.getData(signal);
 *       setData(data);
 *     });
 *   }, []);
 *
 *   if (loading) return <LoadingOverlay visible message="Loading..." />;
 *   if (error)   return <LoadingOverlay visible error onRetry={execute} ... />;
 */
export function usePageLoader({
  minDuration = DEFAULT_MIN_DURATION,
  timeout = DEFAULT_TIMEOUT,
} = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // null | 'timeout' | Error

  // Refs so callbacks don't re-create on every render
  const abortRef = useRef(null);
  const timeoutRef = useRef(null);
  const loadStartRef = useRef(null);
  const mountedRef = useRef(true);

  // Track mounted state to avoid setState after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      _cleanup();
    };
  }, []);

  const _cleanup = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const _safeSet = (setFn, value) => {
    if (mountedRef.current) setFn(value);
  };

  const execute = useCallback(async (asyncFn) => {
    // Cancel any previous request
    _cleanup();

    const controller = new AbortController();
    abortRef.current = controller;
    loadStartRef.current = Date.now();

    _safeSet(setLoading, true);
    _safeSet(setError, null);

    // Start timeout timer
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        controller.abort();
        setLoading(false);
        setError('timeout');
      }
    }, timeout);

    try {
      await asyncFn(controller.signal);

      // Enforce minimum display time
      const elapsed = Date.now() - loadStartRef.current;
      if (elapsed < minDuration) {
        await new Promise(r => setTimeout(r, minDuration - elapsed));
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Aborted by timeout or navigate-away — timeout timer handles UI
        return;
      }
      _safeSet(setError, err);
    } finally {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      _safeSet(setLoading, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDuration, timeout]);

  const reset = useCallback(() => {
    _cleanup();
    _safeSet(setLoading, false);
    _safeSet(setError, null);
  }, []);

  return { loading, error, execute, reset };
}
