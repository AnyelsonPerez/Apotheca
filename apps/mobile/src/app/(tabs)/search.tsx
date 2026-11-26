import { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, Searchbar } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { apiFetch } from '@/api/client';
import type { CimaSearchResult, Medication, CimaSearchResponse } from '@/api/types';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { ToastSnackbar } from '@/components/ToastSnackbar';
import { ErrorView } from '@/components/ErrorView';
import { BrandColors } from '@/constants/theme';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'active'>('name');
  const debouncedQuery = useDebounce(query, 400);
  const isTyping = query !== debouncedQuery;
  const qc = useQueryClient();
  const { toast, show, hide } = useToast();

  const { data: searchResponse, isFetching, isError, refetch } = useQuery({
    queryKey: ['cima', searchType, debouncedQuery],
    queryFn: () => {
      const param = searchType === 'name' ? `nombre=${encodeURIComponent(debouncedQuery)}` : `pactivos=${encodeURIComponent(debouncedQuery)}`;
      return apiFetch<CimaSearchResponse>(`/cima/search?${param}`);
    },
    enabled: debouncedQuery.length >= 2,
  });

  const results: CimaSearchResult[] = [
    ...(searchResponse?.inventory ?? []),
    ...(searchResponse?.cima ?? []),
  ];

  const addMutation = useMutation({
    mutationFn: (nregistro: string) =>
      apiFetch<Medication>('/inventory/medications', {
        method: 'POST',
        body: JSON.stringify({ nregistro }),
      }),
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['cima'] });
      show('Medicamento añadido al inventario');
    },
    onError: async (err) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      show(String(err.message), 'error');
    },
  });

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Buscar medicamento…"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
        loading={isTyping || isFetching}
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
          keyExtractor={(item, i) => `${item.nregistro}-${i}`}
          refreshing={isFetching}
          onRefresh={() => refetch()}
          renderItem={({ item }) => {
            const alreadyAdded = item.in_inventory === true;
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
            debouncedQuery.length >= 2 && !isFetching && !isTyping ? (
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
