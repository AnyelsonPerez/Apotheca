// Shared types for Apotheca mobile app

export interface User {
  id: string
  email: string
  name: string
  is_admin: boolean
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface Medication {
  id: string
  national_code: string
  name: string
  barcode: string | null
  laboratory: string | null
  dosage: string | null
  prescription: boolean
  active_ingredient_name: string | null
  presentation_name: string | null
  lots: Lot[]
}

export interface Lot {
  id: string
  medication_id: string
  user_id: string
  quantity: number
  expiry_date: string | null
  daily_dose: number | null
  acquired_at: string | null
  created_at: string
  updated_at: string
}

export interface InventoryItem {
  id: string
  national_code: string
  name: string
  laboratory: string | null
  dosage: string | null
  active_ingredient_name: string | null
  presentation_name: string | null
  total_quantity: number
  lots: Lot[]
}

export interface Setting {
  key: string
  value: string
}

export interface AlertItem {
  lot_id: string
  medication_name: string
  national_code: string
  quantity: number
  expiry_date: string | null
  daily_dose: number | null
  days_until_expiry: number | null
  days_until_depleted: number | null
  alert_type: string
}

export interface AlertsResponse {
  expiry: AlertItem[]
  depletion: AlertItem[]
}

export interface CimaSearchResult {
  nregistro: string
  nombre: string
  pactivos: string
  labtitular: string
  dosis: string
  cpresc: string
}
