// Universal Filter Slice - barcha selectlar uchun
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// Dynamic filter state - istalgan maydon qo'shish mumkin
interface FilterState {
  [key: string]: string | string[] | number | boolean | null;
}

const initialState: FilterState = {};

const filterSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    // Bitta maydonni o'zgartirish
    setFilterValue: (
      state,
      action: PayloadAction<{ key: string; value: string | string[] | number | boolean | null }>,
    ) => {
      state[action.payload.key] = action.payload.value;
    },

    // Bir nechta maydonni bir vaqtda o'zgartirish
    setMultipleFilters: (state, action: PayloadAction<Record<string, any>>) => {
      return { ...state, ...action.payload };
    },

    // Bitta maydonni o'chirish
    removeFilterValue: (state, action: PayloadAction<string>) => {
      delete state[action.payload];
    },

    // Barcha filterlarni tozalash (pathname o'zgarganda)
    resetFilters: () => {
      return {};
    },
  }
});

export const {
  setFilterValue,
  setMultipleFilters,
  removeFilterValue,
  resetFilters
} = filterSlice.actions;

export default filterSlice.reducer;
