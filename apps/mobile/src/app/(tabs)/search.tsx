import { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, Searchbar } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { CimaSearchResult, Medication, InventoryItem } from '@/api/types';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { ToastSnackbar } from '@/components/ToastSnackbar';
import { ErrorView } from '@/components/ErrorView';
import { BrandColors } from '@/constants/theme';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'active'>('name');
  const debouncedQuery = useDebounce(query, 400);
  const qc = useQueryClient();
  const { toast, show, hide } = useToast();

  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiFetch<InventoryItem[]>('/inventory'),
  });

  const inventoryNregistros = new Set(inventory?.map((m) => m.national_code) ?? []);

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['cima', searchType, debouncedQuery],
    queryFn: () => {
      const param = searchType === 'name' ? `nombre=${encodeURIComponent(debouncedQuery)}` : `pactivos=${encodeURIComponent(debouncedQuery)}`;
      return apiFetch<CimaSearchResult[]>(`/cima/search?${param}`);
    },
    enabled: debouncedQuery.length >= 2,
  });

  const addMutation = useMutation({
    mutationFn: (nregistro: string) =>
      apiFetch<Medication>('/inventory/medications', {
        method: 'POST',
        body: JSON.stringify({ nregistro }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      show('Medicamento añadido al inventario');
    },
    onError: (err) => show(String(err.message), 'error'),
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

      {isError && debouncedQuery.length >= 2 ? (
        <ErrorView message="Error en la búsqueda" onRetry={() => refetch()} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.nregistro}
          refreshing={isFetching}
          onRefresh={() => {}}
          renderItem={({ item }) => {
            const alreadyAdded = inventoryNregistros.has(item.nregistro);
            return (
              <Card style={styles.card}>
                <Card.Content>
                  <Title numberOfLines={2} style={styles.name}>{item.nombre}</Title>
                  <Paragraph numberOfLines={1}>{item.pactivos}</Paragraph>
                  <View style={styles.row}>
                    <Chip mode="outlined" style={styles.chip}>{item.nregistro}</Chip>
                    {item.cpresc && item.cpresc !== 'Sin Receta' && (
                      <Chip mode="outlined" style={[styles.chip, styles.prescChip]}>Con receta</Chip>
                    )}
                    {alreadyAdded && (
                      <Chip mode="outlined" style={[styles.chip, styles.addedChip]} textStyle={styles.addedChipText}>En inventario</Chip>
                    )}
                  </View>
                </Card.Content>
                <Card.Actions>
                  <Button
                    mode="contained"
                    buttonColor={BrandColors.primary}
                    onPress={() => addMutation.mutate(item.nregistro)}
                    loading={addMutation.isPending}
                    disabled={alreadyAdded}
                  >
                    {alreadyAdded ? 'Añadido' : 'Añadir al inventario'}
                  </Button>
                </Card.Actions>
              </Card>
            );
          }}
          ListEmptyComponent={
            debouncedQuery.length >= 2 && !isFetching ? (
              <Paragraph style={styles.empty}>Sin resultados para &ldquo;{debouncedQuery}&rdquo;</Paragraph>
            ) : undefined
          }
        />
      )}

      <ToastSnackbar toast={toast} onDismiss={hide} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  search: { marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { marginBottom: 4 },
  prescChip: { borderColor: BrandColors.danger },
  addedChip: { borderColor: BrandColors.success },
  addedChipText: { color: BrandColors.success, fontSize: 11 },
  card: { marginBottom: 12 },
  name: { fontSize: 16 },
  row: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  empty: { textAlign: 'center', marginTop: 24, opacity: 0.5 },
});
