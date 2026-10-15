// src/store/sidebarSlice.js
import { createSlice } from "@reduxjs/toolkit";
import { readStoredSidebar } from "../../../shared/lib/preferencesStorage";

/**
 * SHELL HOLATI (dizayn v2, 2-bosqich).
 *
 * - `isOpen` — desktop (≥ 1024) yon menyusi yoyilganmi/yig'ilganmi. Foydalanuvchi
 *   sozlamasi: brauzerda (`preferencesStorage`) va serverda (`SettingsSync`)
 *   saqlanadi. Amallar: `openSidebar` / `closeSidebar` / `toggleSidebar` / `setSidebar`.
 * - `isMobileMenuOpen` — planshet va telefondagi (< 1024) suriluvchi menyu
 *   (`MobileMenu`) ochiqmi. Saqlanmaydi: har sahifa almashganda va ekran ≥ 1024
 *   ga kengayganda shell uni yopadi. Uni ochadiganlar: yuqori paneldagi menyu
 *   tugmasi (planshet/telefon) va pastki menyudagi «Menyu» bandi (telefon).
 *   Amallar: `openMobileMenu` / `closeMobileMenu` / `toggleMobileMenu`.
 *   Komponentlarda to'g'ridan-to'g'ri emas, `useMobileMenu()` (`./shellNav`) orqali.
 */
const getStoredSidebarState = () => {
  return readStoredSidebar() ?? false;
};

const initialState = {
  isOpen: getStoredSidebarState(),
  isMobileMenuOpen: false,
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
    openMobileMenu(state) {
      state.isMobileMenuOpen = true;
    },
    closeMobileMenu(state) {
      state.isMobileMenuOpen = false;
    },
    toggleMobileMenu(state) {
      state.isMobileMenuOpen = !state.isMobileMenuOpen;
    },
  },
});

export const {
  openSidebar,
  closeSidebar,
  toggleSidebar,
  setSidebar,
  openMobileMenu,
  closeMobileMenu,
  toggleMobileMenu,
} = sidebarSlice.actions;
export default sidebarSlice.reducer;
