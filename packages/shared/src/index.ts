// Shared domain types for Apotheca web and mobile clients.

export interface Medication {
  id: string;
  name: string;
  activeIngredient: string;
  nationalCode: string;
  barcode?: string;
  categoryId: string;
}

export interface Lot {
  id: string;
  medicationId: string;
  quantity: number;
  expiryDate?: string;
  dosage?: string;
  acquiredAt?: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}
