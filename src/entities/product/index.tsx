import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";

export const products = "products";

export const useProducts = () => {
  const client = useQueryClient();

  const createProduct = useMutation({
    mutationFn: (data: FormData) =>
      api.post("product", data, {
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
      queryFn: () => api.get("product", { params }).then((res) => res.data),
      enabled,
    });

  const updateProduct = useMutation({
    mutationFn: ({
      id,
      data,
      isMarket,
    }: {
      id: string;
      data: any;
      isMarket?: boolean;
    }) => {
      if (isMarket) {
        return api.patch(`/product/my/${id}`, data); // market uchun
      } else {
        return api.patch(`/product/${id}`, data); // admin/registrator uchun
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["product"] });
    },
  });

  // Inside useProducts.ts
  const getByMarketId = (id: string | undefined, enabled?: boolean) => {
    return useQuery({
      queryKey: ["market", id],
      queryFn: () => api.get(`/product/market/${id}`).then((res) => res.data), // or however you fetch
      enabled: !!id && enabled !== false, // Only fetch if ID exists
    });
  };

  const deleteProduct = useMutation({
    mutationFn: (id: number) => api.delete(`product/${id}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [products] });
    },
  });

  return {
    createProduct,
    getProducts,
    updateProduct,
    deleteProduct,
    getByMarketId
  };
};
