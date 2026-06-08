// src/store/sidebarSlice.js
import { createSlice } from "@reduxjs/toolkit";
import { readStoredSidebar } from "../../../shared/lib/preferencesStorage";

const getStoredSidebarState = () => {
  return readStoredSidebar() ?? false;
};

const initialState = {
  isOpen: getStoredSidebarState(),
};

const sidebarSlice = createSlice({
  name: "sidebar",
  initialState,
  reducers: {
    openSidebar(state) {
      state.isOpen = true;
    },
    closeSidebar(state) {
      state.isOpen = false;
    },
    toggleSidebar(state) {
      state.isOpen = !state.isOpen;
    },
    setSidebar(state, action) {
      const value = !!action.payload;
      state.isOpen = value;
    },
  },
});

export const { openSidebar, closeSidebar, toggleSidebar, setSidebar } =
  sidebarSlice.actions;
export default sidebarSlice.reducer;
