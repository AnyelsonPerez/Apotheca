import { useQuery } from '@tanstack/react-query';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { Card, Title, Paragraph, IconButton, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import type { AlertsResponse, InventoryItem, AlertItem } from '@/api/types';
import { useAuth } from '@/context/AuthContext';
import { ErrorView } from '@/components/ErrorView';
import { BrandColors } from '@/constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const { data: inventory, isLoading: invLoading, isError: invError, refetch: refetchInv } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiFetch<InventoryItem[]>('/inventory'),
  });
  const { data: alerts, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => apiFetch<AlertsResponse>('/alerts'),
    refetchInterval: 60_000,
  });

  const totalMeds = inventory?.length ?? 0;
  const totalUnits = inventory?.reduce((s, m) => s + m.total_quantity, 0) ?? 0;
  const expiryAlerts = alerts?.expiry ?? [];
  const depletionAlerts = alerts?.depletion ?? [];

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres cerrar la sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: () => logout() },
      ],
    );
  };

  const renderAlertCard = ({ item, type }: { item: AlertItem; type: 'expiry' | 'depletion' }) => {
    const isUrgent = type === 'expiry'
      ? (item.days_until_expiry ?? 0) <= 0
      : (item.days_until_depleted ?? 0) <= 2;
    return (
      <Card style={[styles.alertCard, isUrgent && styles.alertCardUrgent]}>
        <Card.Content>
          <View style={styles.alertHeader}>
            <Title style={styles.alertTitle} numberOfLines={2}>{item.medication_name}</Title>
            <Paragraph style={styles.alertQty}>{item.quantity} ud</Paragraph>
          </View>
          {type === 'expiry' ? (
            <Paragraph style={styles.alertDetail}>
              {item.days_until_expiry !== null && item.days_until_expiry <= 0
                ? `Caducado hace ${Math.abs(item.days_until_expiry)} día(s)`
                : `Caduca en ${item.days_until_expiry} día(s)`}
            </Paragraph>
          ) : (
            <Paragraph style={styles.alertDetail}>
              {item.days_until_depleted !== null
                ? `Aprox. ${item.days_until_depleted} día(s) de stock`
                : 'Agotándose'}
            </Paragraph>
          )}
        </Card.Content>
      </Card>
    );
  };

  const refreshing = invLoading || alertsLoading;

  if (invError && !inventory) {
    return <ErrorView message="No se pudo cargar el inventario" onRetry={() => refetchInv()} />;
  }

  const listData: React.ReactNode[] = [];

  // Summary card
  listData.push(
    <Card key="summary" style={styles.card}>
      <Card.Content>
        <Title>Resumen</Title>
        {invLoading && !inventory ? (
          <ActivityIndicator style={styles.loader} />
        ) : (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Paragraph style={styles.statValue}>{totalMeds}</Paragraph>
              <Paragraph style={styles.statLabel}>Medicamentos</Paragraph>
            </View>
            <View style={styles.stat}>
              <Paragraph style={styles.statValue}>{totalUnits}</Paragraph>
              <Paragraph style={styles.statLabel}>Unidades</Paragraph>
            </View>
          </View>
        )}
      </Card.Content>
    </Card>,
  );

  // Empty state
  if (!invLoading && totalMeds === 0) {
    listData.push(
      <Card key="empty" style={styles.card}>
        <Card.Content style={styles.emptyContent}>
          <Text style={styles.emptyIcon}>💊</Text>
          <Title style={styles.emptyTitle}>Sin medicamentos</Title>
          <Paragraph style={styles.emptyText}>
            Añade tu primer medicamento buscando o escaneando su código de barras.
          </Paragraph>
        </Card.Content>
        <Card.Actions>
          <Pressable onPress={() => router.push('/(tabs)/search')}>
            <Text style={styles.emptyCta}>Buscar medicamento →</Text>
          </Pressable>
        </Card.Actions>
      </Card>,
    );
  }

  // Expiry alerts
  if (expiryAlerts.length > 0) {
    listData.push(
      <View key="expiry-section">
        <Text style={styles.sectionTitle}> Caducidades ({expiryAlerts.length})</Text>
        {expiryAlerts.map((item) => renderAlertCard({ item, type: 'expiry' }))}
      </View>,
    );
  }

  // Depletion alerts
  if (depletionAlerts.length > 0) {
    listData.push(
      <View key="depletion-section">
        <Text style={styles.sectionTitle}> Agotamiento ({depletionAlerts.length})</Text>
        {depletionAlerts.map((item) => renderAlertCard({ item, type: 'depletion' }))}
      </View>,
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={listData}
      keyExtractor={(_, i) => String(i)}
      renderItem={({ item }) => <>{item}</>}
      refreshing={refreshing}
      onRefresh={() => { refetchInv(); refetchAlerts(); }}
      ListHeaderComponent={
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Apotheca</Text>
            {user && <Text style={styles.welcome}>Hola, {user.name}</Text>}
          </View>
          <IconButton icon="logout" iconColor={BrandColors.danger} onPress={handleLogout} />
        </View>
      }
      ListEmptyComponent={
        !invLoading && totalMeds > 0 && expiryAlerts.length === 0 && depletionAlerts.length === 0 ? (
          <Card style={styles.card}>
            <Card.Content>
              <Title>Todo en orden </Title>
              <Paragraph>No hay alertas activas.</Paragraph>
            </Card.Content>
          </Card>
        ) : <View />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: BrandColors.primary },
  welcome: { fontSize: 13, opacity: 0.6, marginTop: 2 },
  card: { marginBottom: 12 },
  loader: { marginTop: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: 'bold' },
  statLabel: { fontSize: 12, opacity: 0.6 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, marginTop: 8, color: BrandColors.warning },
  alertCard: { marginBottom: 8, borderLeftWidth: 4, borderLeftColor: BrandColors.warning },
  alertCardUrgent: { borderLeftColor: BrandColors.danger },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertTitle: { fontSize: 16, flex: 1 },
  alertQty: { fontSize: 13, opacity: 0.6 },
  alertDetail: { fontSize: 13, opacity: 0.7, marginTop: 4 },
  emptyContent: { alignItems: 'center', paddingVertical: 16 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { textAlign: 'center', marginBottom: 4 },
  emptyText: { textAlign: 'center', opacity: 0.6, marginBottom: 8 },
  emptyCta: { color: BrandColors.primary, fontWeight: 'bold', paddingHorizontal: 8 },
});
