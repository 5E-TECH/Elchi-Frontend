import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface IState {
  id: string | null,
  role: string | null,
  region: string | null,
  name: string | null
}

const getStoredAuthField = (key: "region" | "name" | "role") => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage.getItem(key) || null;
  } catch {
    return null;
  }
};

const setStoredAuthField = (key: "region" | "name" | "role", value: string) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, value);
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures and keep auth state usable.
  }
};

const removeStoredAuthField = (key: "region" | "name" | "role") => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures and keep auth state usable.
  }
};

const initialState: IState = {
  id: null,
  role: getStoredAuthField("role"),
  region: getStoredAuthField("region"),
  name: getStoredAuthField("name")
};

export const roleSlice = createSlice({
  name: "role",
  initialState,
  reducers: {
    setRole: (state, action: PayloadAction<string>) => {
      const role = action.payload.trim().toLowerCase();
      state.role = role;
      setStoredAuthField("role", role);
    },
    setName: (state, action: PayloadAction<string>) => {
      state.name = action.payload;
      setStoredAuthField("name", action.payload);
    },
    setRegion: (state, action: PayloadAction<string>) => {
      state.region = action.payload;
      setStoredAuthField("region", action.payload);
    },
    removeRole: (state) => {
      state.id = null;
      state.role = null;
      state.region = null;
      state.name = null;
      removeStoredAuthField("region");
      removeStoredAuthField("name");
      removeStoredAuthField("role");
    },
    setId: (state, action: PayloadAction<string>) => {
      state.id = action.payload;
    },
  },
});

export const { setRole, removeRole, setId, setRegion, setName } = roleSlice.actions;
export default roleSlice.reducer;
