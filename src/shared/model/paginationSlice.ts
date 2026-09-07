import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type PaginationScope = "orders" | "products" | "users" | "payments" | "mails" | "batches" | "returns";

export interface PaginationEntry {
  page: number;
  limit: number;
}

type PaginationState = Record<PaginationScope, PaginationEntry>;

interface SetPaginationPayload {
  key: PaginationScope;
  page?: number;
  limit?: number;
}

const initialState: PaginationState = {
  orders: { page: 1, limit: 15 },
  products: { page: 1, limit: 10 },
  users: { page: 1, limit: 10 },
  payments: { page: 1, limit: 10 },
  mails: { page: 1, limit: 8 },
  batches: { page: 1, limit: 10 },
  returns: { page: 1, limit: 10 },
};

const normalizePositiveNumber = (value: number | undefined, fallback: number) => {
  if (typeof value !== "number" || Number.isNaN(value) || value < 1) {
    return fallback;
  }

  return Math.floor(value);
};

const paginationSlice = createSlice({
  name: "pagination",
  initialState,
  reducers: {
    setPagination: (state, action: PayloadAction<SetPaginationPayload>) => {
      const { key, page, limit } = action.payload;
      const current = state[key];

      state[key] = {
        page: normalizePositiveNumber(page, current.page),
        limit: normalizePositiveNumber(limit, current.limit),
      };
    },
    resetPagination: (state, action: PayloadAction<SetPaginationPayload>) => {
      const { key, limit } = action.payload;
      const current = state[key];

      state[key] = {
        page: 1,
        limit: normalizePositiveNumber(limit, current.limit),
      };
    },
  },
});

export const { setPagination, resetPagination } = paginationSlice.actions;
export default paginationSlice.reducer;
