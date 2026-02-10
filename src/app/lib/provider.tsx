import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { memo, Suspense, type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";

const queryClient = new QueryClient();

const AppProvider = ({children}: {children: ReactNode}) => {
  return (
    <div>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
            <Suspense>{children}</Suspense>
        </QueryClientProvider>
      </BrowserRouter>
    </div>
  );
};

export default memo(AppProvider);
