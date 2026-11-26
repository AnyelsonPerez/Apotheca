import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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

const PAGE_SIZE = 25;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'active'>('name');
  const debouncedQuery = useDebounce(query, 400);
  const isTyping = query !== debouncedQuery;
  const qc = useQueryClient();
  const { toast, show, hide } = useToast();

  const [page, setPage] = useState(1);

  const { data: searchResponse, isFetching, isError, refetch } = useQuery({
    queryKey: ['cima', searchType, debouncedQuery, page],
    queryFn: () => {
      const param = searchType === 'name' ? `nombre=${encodeURIComponent(debouncedQuery)}` : `pactivos=${encodeURIComponent(debouncedQuery)}`;
      return apiFetch<CimaSearchResponse>(`/cima/search?${param}&page=${page}&page_size=${PAGE_SIZE}`);
    },
    enabled: debouncedQuery.length >= 2,
  });

  // Derive deduplicated merged results from the query response
  const results = useMemo(() => {
    if (!searchResponse) return [];
    const merged = [
      ...(searchResponse.inventory ?? []),
      ...(searchResponse.cima ?? []),
    ];
    const seen = new Set<string>();
    const deduped: CimaSearchResult[] = [];
    for (const item of merged) {
      if (!seen.has(item.nregistro)) {
        seen.add(item.nregistro);
        deduped.push(item);
      }
    }
    return deduped;
  }, [searchResponse]);

  const hasMore = useMemo(() => {
    if (!searchResponse) return false;
    const totalCima = searchResponse.total_cima ?? 0;
    const cimaCount = (searchResponse.cima ?? []).length;
    return page * PAGE_SIZE < totalCima && cimaCount > 0;
  }, [searchResponse, page]);

  const handleSearchTypeChange = useCallback((type: 'name' | 'active') => {
    setSearchType(type);
    setQuery('');
    setPage(1);
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMore || isFetching) return;
    setPage((p) => p + 1);
  }, [hasMore, isFetching]);

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

  // Reset page when query or type changes
  const queryKey = `${searchType}:${debouncedQuery}`;
  const prevQueryKey = useRef(queryKey);
  useEffect(() => {
    if (prevQueryKey.current !== queryKey) {
      prevQueryKey.current = queryKey;
      setPage(1);
    }
  }, [queryKey]);

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
          onPress={() => handleSearchTypeChange('name')}
          style={styles.chip}
        >Por nombre</Chip>
        <Chip
          selected={searchType === 'active'}
          onPress={() => handleSearchTypeChange('active')}
          style={styles.chip}
        >Por principio activo</Chip>
      </View>

      {isError && debouncedQuery.length >= 2 ? (
        <ErrorView message="Error en la búsqueda" onRetry={() => refetch()} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, i) => `${item.nregistro}-${i}`}
          refreshing={isFetching && page === 1}
          onRefresh={() => refetch()}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
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
          ListFooterComponent={
            isFetching && page > 1 ? (
              <View style={styles.footerLoader}><Paragraph style={styles.footerText}>Cargando más…</Paragraph></View>
            ) : <View />
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
  footerLoader: { paddingVertical: 16, alignItems: 'center' },
  footerText: { opacity: 0.5, fontSize: 13 },
});
