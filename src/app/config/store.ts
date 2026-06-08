import { configureStore, createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import sidebarSlice, {
  closeSidebar,
  openSidebar,
  setSidebar,
  toggleSidebar,
} from "../../widgets/Sidebar/model/sidebarSlice";
import userReducer from "../../entities/user/model/slice";
import filterslice from "../../features/Select/model/FilterSlice";
import searchSlice from "../../features/search/model/searchSlice";
import roleReducer from "../../features/auth/model/loginSlice";
import paginationReducer from "../../features/pagination/model/paginationSlice";
import { writeStoredSidebar } from "../../shared/lib/preferencesStorage";

const sidebarStorageListener = createListenerMiddleware();

sidebarStorageListener.startListening({
  matcher: isAnyOf(openSidebar, closeSidebar, toggleSidebar, setSidebar),
  effect: (_action, listenerApi) => {
    const state = listenerApi.getState() as { sidebar: { isOpen: boolean } };
    writeStoredSidebar(state.sidebar.isOpen);
  },
});

export const store = configureStore({
  reducer: {
    sidebar: sidebarSlice,
    user: userReducer,
    filter: filterslice,
    search: searchSlice,
    role: roleReducer,
    pagination: paginationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(sidebarStorageListener.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store; // Qo'shish
