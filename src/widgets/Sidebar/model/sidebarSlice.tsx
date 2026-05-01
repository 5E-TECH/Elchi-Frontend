// src/store/sidebarSlice.js
import { createSlice } from "@reduxjs/toolkit";

const getStoredSidebarState = () => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const storedSidebar = window.localStorage.getItem("sidebarIsOpen");
    return storedSidebar ? JSON.parse(storedSidebar) : false;
  } catch {
    return false;
  }
};

const persistSidebarState = (value: boolean) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem("sidebarIsOpen", JSON.stringify(value));
  } catch {
    // Ignore storage failures and keep sidebar usable.
  }
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
      persistSidebarState(true);
    },
    closeSidebar(state) {
      state.isOpen = false;
      persistSidebarState(false);
    },
    toggleSidebar(state) {
      state.isOpen = !state.isOpen;
      persistSidebarState(state.isOpen);
    },
    setSidebar(state, action) {
      const value = !!action.payload;
      state.isOpen = value;
      persistSidebarState(value);
    },
  },
});

export const { openSidebar, closeSidebar, toggleSidebar, setSidebar } =
  sidebarSlice.actions;
export default sidebarSlice.reducer;
