import { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { TextInput, Card, Title, Paragraph, Button, Chip, Searchbar } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { CimaSearchResult, Medication } from '@/api/types';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'active'>('name');
  const qc = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ['cima', searchType, query],
    queryFn: () => {
      const param = searchType === 'name' ? `nombre=${query}` : `pactivos=${query}`;
      return apiFetch<CimaSearchResult[]>(`/cima/search?${param}`);
    },
    enabled: query.length >= 2,
  });

  const addMutation = useMutation({
    mutationFn: (nregistro: string) =>
      apiFetch<Medication>('/inventory/medications', {
        method: 'POST',
        body: JSON.stringify({ nregistro }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const results = data ?? [];

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Buscar medicamento…"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />
      <View style={styles.chips}>
        <Chip
          selected={searchType === 'name'}
          onPress={() => setSearchType('name')}
          style={styles.chip}
        >Por nombre</Chip>
        <Chip
          selected={searchType === 'active'}
          onPress={() => setSearchType('active')}
          style={styles.chip}
        >Por principio activo</Chip>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.nregistro}
        refreshing={isFetching}
        onRefresh={() => {}}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Title numberOfLines={2} style={styles.name}>{item.nombre}</Title>
              <Paragraph numberOfLines={1}>{item.pactivos}</Paragraph>
              <View style={styles.row}>
                <Chip mode="outlined" style={styles.chip}>{item.nregistro}</Chip>
                {item.cpresc && item.cpresc !== 'Sin Receta' && (
                  <Chip mode="outlined" style={[styles.chip, styles.prescChip]}>Con receta</Chip>
                )}
              </View>
            </Card.Content>
            <Card.Actions>
              <Button
                mode="contained"
                buttonColor="#0CA678"
                onPress={() => addMutation.mutate(item.nregistro)}
                loading={addMutation.isPending}
              >
                Añadir al inventario
              </Button>
            </Card.Actions>
          </Card>
        )}
        ListEmptyComponent={
          query.length >= 2 && !isFetching ? (
            <Paragraph style={styles.empty}>Sin resultados</Paragraph>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  search: { marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { marginBottom: 4 },
  prescChip: { borderColor: '#F44336' },
  card: { marginBottom: 12 },
  name: { fontSize: 16 },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 24, opacity: 0.5 },
});
