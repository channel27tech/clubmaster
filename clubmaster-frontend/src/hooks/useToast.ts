// src/hooks/useToast.ts (The Corrected Version)

import { useCallback, useMemo } from 'react';

/**
 * A simple hook for displaying toast notifications
 * In a real app, this would use a toast library like react-toastify or chakra-ui
 * but for now we'll just use console.log as a placeholder
 */
export const useToast = () => {
  // useCallback "memoizes" the function. It's only created once because the
  // dependency array [] is empty.
  const success = useCallback((message: string) => {
    // In a real app: toast.success(message)
    console.log(`%c[SUCCESS]: ${message}`, 'color: green; font-weight: bold;');
  }, []);

  const error = useCallback((message: string) => {
    // In a real app: toast.error(message)
    console.error(`[ERROR]: ${message}`);
  }, []);

  const info = useCallback((message: string) => {
    // In a real app: toast.info(message)
    console.log(`%c[INFO]: ${message}`, 'color: blue; font-weight: bold;');
  }, []);

  const warning = useCallback((message: string) => {
    // In a real app: toast.warning(message)
    console.warn(`[WARNING]: ${message}`);
  }, []);

  // useMemo memoizes the returned object. This object will now only be
  // re-created if one of its dependencies (success, error, info, warning)
  // were to change, which they won't.
  return useMemo(() => ({
    success,
    error,
    info,
    warning
  }), [success, error, info, warning]);
};