import { useCallback, useState } from 'react';

export interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
}

export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);

  const show = useCallback((message: string, type: Toast['type'] = 'success') => {
    setToast({ message, type });
  }, []);

  const hide = useCallback(() => setToast(null), []);

  return { toast, show, hide };
}
