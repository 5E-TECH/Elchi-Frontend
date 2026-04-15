import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { type UserState, type User } from "./types";

const initialState: UserState = {
  user: null,
  isAuthenticated: !!localStorage.getItem("accessToken"),
  accessToken: localStorage.getItem("accessToken"),
  refreshToken: null,
  loading: false,
  isAppInitializing: !!localStorage.getItem("accessToken"), // If token exists, we are initializing (fetching profile)
  error: null,
};

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    loginSuccess: (
      state,
      action: PayloadAction<{ accessToken: string; user: User; refreshToken?: string | null }>,
    ) => {
      state.loading = false;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken ?? null;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.error = null;
      localStorage.setItem("accessToken", action.payload.accessToken);
      localStorage.setItem("role", action.payload.user.role);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setAppInitializing: (state, action: PayloadAction<boolean>) => {
      state.isAppInitializing = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.loading = false;
      state.error = action.payload;
    },
    setProfile: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem("accessToken");
      localStorage.removeItem("role");
    }
  },
});

export const { loginSuccess, setLoading, setAppInitializing, setError, setProfile, logout } = userSlice.actions;
export default userSlice.reducer;
