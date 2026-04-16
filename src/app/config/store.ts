import { configureStore } from "@reduxjs/toolkit";
import sidebarSlice from "../../widgets/Sidebar/model/sidebarSlice";
import userReducer from "../../entities/user/model/slice";
import filterslice from "../../features/Select/model/FilterSlice";
import searchSlice from "../../features/search/model/searchSlice";
import roleReducer from "../../features/auth/model/loginSlice";
import paginationReducer from "../../features/pagination/model/paginationSlice";

export const store = configureStore({
  reducer: {
    sidebar: sidebarSlice,
    user: userReducer,
    filter: filterslice,
    search: searchSlice,
    role: roleReducer,
    pagination: paginationReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store; // Qo'shish
