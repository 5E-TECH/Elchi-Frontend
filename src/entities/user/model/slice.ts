import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { type UserState, type User } from "./types";

const initialState: UserState = {
  user: null,
  isAuthenticated: !!localStorage.getItem("x-auth-token"),
  token: localStorage.getItem("x-auth-token"),
  loading: false,
  error: null,
};

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    loginSuccess: (state, action: PayloadAction<{ token: string; user: User }>) => {
      state.loading = false;
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.error = null;
      localStorage.setItem("x-auth-token", action.payload.token);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.loading = false;
      state.error = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem("x-auth-token");
    }
  },
});

export const { loginSuccess, setLoading, setError, logout } = userSlice.actions;
export default userSlice.reducer;