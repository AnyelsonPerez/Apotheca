import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type {
  AlertsResponse,
  CimaBarcodeResult,
  CimaDetail,
  CimaSearchResponse,
  InventoryItem,
  Lot,
  Medication,
  Setting,
  TokenResponse,
} from './types'

// --- Auth ---
export function useLogin() {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      apiFetch<TokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: { email: string; name: string; password: string }) =>
      apiFetch<TokenResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  })
}

// --- Unified search (inventory + CIMA) ---
export function useCimaSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      const params = `nombre=${encodeURIComponent(query)}`
      const data = await apiFetch<CimaSearchResponse>(`/cima/search?${params}`)
      return data
    },
    enabled: query.length >= 2,
  })
}

export function useCimaDetail(nregistro: string | null) {
  return useQuery({
    queryKey: ['cima-detail', nregistro],
    queryFn: () => apiFetch<CimaDetail>(`/cima/${nregistro}`),
    enabled: !!nregistro,
  })
}

// --- Barcode lookup (CIMA by codigo nacional) ---
export function useCimaBarcode(cn: string | null) {
  return useQuery({
    queryKey: ['cima-barcode', cn],
    queryFn: () => apiFetch<CimaBarcodeResult>(`/cima/barcode/${cn}`),
    enabled: !!cn,
    retry: 0,
  })
}

// --- Inventory ---
export function useInventory() {
  return useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiFetch<InventoryItem[]>('/inventory'),
  })
}

export function useMedications() {
  return useQuery({
    queryKey: ['medications'],
    queryFn: () => apiFetch<Medication[]>('/inventory/medications'),
  })
}

export function useAddMedication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nregistro: string) =>
      apiFetch<Medication>('/inventory/medications', {
        method: 'POST',
        body: JSON.stringify({ nregistro }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['medications'] })
    },
  })
}

export function useDeleteMedication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/inventory/medications/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['medications'] })
    },
  })
}

// --- Lots ---
export interface LotInput {
  medication_id: string
  quantity: number
  expiry_date?: string | null
  dosage?: string | null
  daily_dose?: number | null
  acquired_at?: string | null
}

export function useCreateLot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: LotInput) =>
      apiFetch<Lot>('/inventory/lots', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}

export function useUpdateLot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<LotInput> & { id: string }) =>
      apiFetch<Lot>(`/inventory/lots/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}

export function useDeleteLot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/inventory/lots/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}

// --- Settings ---
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<Setting[]>('/settings'),
  })
}

export function useUpdateSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiFetch<Setting>(`/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

// --- Alerts ---
export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: () => apiFetch<AlertsResponse>('/alerts'),
    refetchInterval: 60_000,
  })
}
