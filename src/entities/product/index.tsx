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
    onSuccess: () => client.invalidateQueries({ queryKey: [products] }),
  });

  const getProducts = (params?: any, enabled: boolean = true) =>
    useQuery({
      queryKey: [products, params],
      queryFn: () => api.get("product", { params }).then((res) => res.data),
      enabled,
    });

  return {
    createProduct,
    getProducts,
  };
};
