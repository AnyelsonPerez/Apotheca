import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { BrandColors } from '@/constants/theme';

interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorView({ message = 'Algo salió mal', onRetry }: ErrorViewProps) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="cloud-off-outline" size={56} color={BrandColors.danger} />
      <Text variant="bodyLarge" style={styles.message}>{message}</Text>
      {onRetry && (
        <Button
          mode="contained-tonal"
          onPress={onRetry}
          style={styles.button}
          textColor={BrandColors.primary}
        >
          Reintentar
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  message: { textAlign: 'center', opacity: 0.7, marginBottom: 16, marginTop: 12 },
  button: { marginTop: 8 },
});
