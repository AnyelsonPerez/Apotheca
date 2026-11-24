import { useQuery } from '@tanstack/react-query';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, Paragraph, IconButton } from 'react-native-paper';
import { apiFetch } from '@/api/client';
import type { AlertsResponse, InventoryItem } from '@/api/types';
import { useAuth } from '@/context/AuthContext';

export default function HomeScreen() {
  const { logout } = useAuth();
  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiFetch<InventoryItem[]>('/inventory'),
  });
  const { data: alerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => apiFetch<AlertsResponse>('/alerts'),
    refetchInterval: 60_000,
  });

  const totalMeds = inventory?.length ?? 0;
  const totalUnits = inventory?.reduce((s, m) => s + m.total_quantity, 0) ?? 0;
  const expiryCount = alerts?.expiry.length ?? 0;
  const depletionCount = alerts?.depletion.length ?? 0;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Apotheca</Text>
        <IconButton icon="logout" onPress={logout} />
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Resumen</Title>
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
        </Card.Content>
      </Card>

      <Card style={[styles.card, expiryCount > 0 && styles.cardWarning]}>
        <Card.Content>
          <Title> Caducidades</Title>
          <Paragraph>{expiryCount} lote(s) próximo(s) a caducar</Paragraph>
        </Card.Content>
      </Card>

      <Card style={[styles.card, depletionCount > 0 && styles.cardWarning]}>
        <Card.Content>
          <Title> Agotamiento</Title>
          <Paragraph>{depletionCount} lote(s) próximo(s) a agotarse</Paragraph>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0CA678' },
  card: { marginBottom: 12 },
  cardWarning: { borderLeftWidth: 4, borderLeftColor: '#FF9800' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: '#666' },
});
