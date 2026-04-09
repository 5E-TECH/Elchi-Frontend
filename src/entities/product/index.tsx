import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

export const products = "products";

export const useProducts = () => {
  const client = useQueryClient();

  const createProduct = useMutation({
    mutationFn: (data: FormData) =>
      api.post(API_ENDPOINTS.PRODUCTS.BASE, data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [products] });
      client.invalidateQueries({ queryKey: ["market"] });
    },
  });

  const getProducts = (params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [products, params],
      queryFn: () => api.get(API_ENDPOINTS.PRODUCTS.BASE, { params }).then((res) => res.data),
      enabled,
      placeholderData: (prev: any) => prev,
    });

  const updateProduct = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) =>
      api.patch(API_ENDPOINTS.PRODUCTS.BY_ID(id), data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [products] });
      client.invalidateQueries({ queryKey: ["market"] });
    },
  });

  // Inside useProducts.ts
  const getByMarketId = (id: string | undefined, enabled?: boolean) => {
    return useQuery({
      queryKey: ["market", id],
      queryFn: () => api.get(API_ENDPOINTS.PRODUCTS.BY_MARKET_ID(id as string)).then((res) => res.data), // or however you fetch
      enabled: !!id && enabled !== false, // Only fetch if ID exists
    });
  };

  const getMyProducts = (enabled: boolean = true) =>
    useQuery({
      queryKey: [products, "my-products"],
      queryFn: () => api.get(API_ENDPOINTS.PRODUCTS.MY_PRODUCTS).then((res) => res.data),
      enabled,
    });

  const deleteProduct = useMutation({
    mutationFn: (id: number) => api.delete(API_ENDPOINTS.PRODUCTS.BY_ID(id)),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [products] });
    },
  });

  return {
    createProduct,
    getProducts,
    updateProduct,
    deleteProduct,
    getByMarketId,
    getMyProducts,
  };
};
