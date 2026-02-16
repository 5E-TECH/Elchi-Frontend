// store/slices/filterSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface FilterState {
  role: string;
  status: string;
  search: string;
}

const initialState: FilterState = {
  role: '',
  status: '',
  search: ''
};

const filterSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setRole: (state, action: PayloadAction<string>) => {
      state.role = action.payload;
    },
    setStatus: (state, action: PayloadAction<string>) => {
      state.status = action.payload;
    },
    setSearch: (state, action: PayloadAction<string>) => {
      state.search = action.payload;
    },
    resetFilters: (state) => {
      state.role = '';
      state.status = '';
      state.search = '';
    },
    setFilters: (state, action: PayloadAction<FilterState>) => {
        state
      return action.payload;
    }
  }
});

export const { setRole, setStatus, setSearch, resetFilters, setFilters } = filterSlice.actions;
export default filterSlice.reducer;