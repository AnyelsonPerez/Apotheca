import { Snackbar } from 'react-native-paper';
import { BrandColors } from '@/constants/theme';
import type { Toast } from '@/hooks/use-toast';

interface ToastSnackbarProps {
  toast: Toast | null;
  onDismiss: () => void;
}

export function ToastSnackbar({ toast, onDismiss }: ToastSnackbarProps) {
  const bgColor =
    toast?.type === 'error' ? BrandColors.danger
    : toast?.type === 'info' ? '#333333'
    : BrandColors.primary;

  return (
    <Snackbar
      visible={toast !== null}
      onDismiss={onDismiss}
      duration={3000}
      style={{ backgroundColor: bgColor }}
    >
      {toast?.message ?? ''}
    </Snackbar>
  );
}
