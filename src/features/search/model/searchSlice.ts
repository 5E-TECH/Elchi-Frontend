// Search State Management - Redux Slice
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface SearchState {
    [key: string]: string; // Dynamic keys uchun
}

const initialState: SearchState = {};

const searchSlice = createSlice({
    name: 'search',
    initialState,
    reducers: {
        // Bitta search qiymatini o'rnatish
        setSearchValue: (state, action: PayloadAction<{ key: string; value: string }>) => {
            const { key, value } = action.payload;
            if (value) {
                state[key] = value;
            } else {
                delete state[key];
            }
        },

        // Bir nechta search qiymatlarini o'rnatish
        setMultipleSearchValues: (state, action: PayloadAction<Record<string, string>>) => {
            Object.entries(action.payload).forEach(([key, value]) => {
                if (value) {
                    state[key] = value;
                } else {
                    delete state[key];
                }
            });
        },

        // Bitta search qiymatini o'chirish
        removeSearchValue: (state, action: PayloadAction<string>) => {
            delete state[action.payload];
        },

        // Barcha search qiymatlarini tozalash
        clearAllSearch: () => {
            return {};
        },

        // URL params dan sync qilish
        syncFromUrlParams: (_state, action: PayloadAction<Record<string, string>>) => {
            return action.payload;
        },
    },
});

export const {
    setSearchValue,
    setMultipleSearchValues,
    removeSearchValue,
    clearAllSearch,
    syncFromUrlParams,
} = searchSlice.actions;

export default searchSlice.reducer;
