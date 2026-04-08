import { yupResolver } from "@hookform/resolvers/yup";
import { Form, Input, Select, message } from "antd";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SquarePen } from "lucide-react";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { Branch } from "../../../entities/branch";
import FormPopup, { popupLabelClassName } from "../../../shared/ui/FormPopup";
import { branchEditSchema } from "../model/schema";
import type { UpdateBranchDto } from "../model/types";
import { useUpdateBranch } from "../api/useUpdateBranch";

type RegionOption = {
  id: string;
  name: string;
  districts?: Array<{ id: string; name: string }>;
};

const useRegionOptions = () =>
  useQuery({
    queryKey: queryKeys.regions.all,
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.REGIONS.BASE);
      const raw = response.data as { data?: RegionOption[] } | RegionOption[];
      return Array.isArray(raw) ? raw : raw.data ?? [];
    },
  });

const BranchEditModal = ({
  open,
  initialData,
  onClose,
}: {
  open: boolean;
  initialData: Branch | null;
  onClose: () => void;
}) => {
  const { data: regions = [] } = useRegionOptions();
  const updateBranch = useUpdateBranch();
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<UpdateBranchDto>({
    resolver: yupResolver(branchEditSchema),
    defaultValues: {
      name: "",
      region_id: "",
      district_id: "",
      address: "",
      status: "active",
    },
  });

  const selectedRegionId = useWatch({ control, name: "region_id" });
  const districts = useMemo(
    () => regions.find((region) => String(region.id) === selectedRegionId)?.districts ?? [],
    [regions, selectedRegionId],
  );

  useEffect(() => {
    if (open && initialData) {
      reset({
        name: initialData.name,
        region_id: initialData.region.id,
        district_id: initialData.district.id,
        address: initialData.address,
        status: initialData.status,
      });
    }
  }, [initialData, open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!initialData) return;
    await updateBranch.mutateAsync({ id: initialData.id, payload: values });
    message.success("Filial yangilandi");
    onClose();
  });

  return (
    <FormPopup
      isOpen={open}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
      title="Filialni tahrirlash"
      description="Filial ma'lumotlarini yangilang va o'zgarishlarni saqlang."
      icon={<SquarePen size={22} />}
      submitLabel="Yangilash"
      isLoading={updateBranch.isPending}
    >
      <Form layout="vertical" component={false}>
        <Form.Item label={<span className={popupLabelClassName}>Filial nomi</span>} validateStatus={errors.name ? "error" : ""} help={errors.name?.message}>
          <Controller control={control} name="name" render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>Viloyat</span>} validateStatus={errors.region_id ? "error" : ""} help={errors.region_id?.message}>
          <Controller
            control={control}
            name="region_id"
            render={({ field }) => (
              <Select
                {...field}
                options={regions.map((region) => ({ value: String(region.id), label: region.name }))}
                onChange={(value) => {
                  field.onChange(value);
                  setValue("district_id", "");
                }}
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>Tuman</span>} validateStatus={errors.district_id ? "error" : ""} help={errors.district_id?.message}>
          <Controller
            control={control}
            name="district_id"
            render={({ field }) => (
              <Select
                {...field}
                disabled={!selectedRegionId}
                options={districts.map((district) => ({ value: String(district.id), label: district.name }))}
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>Manzil</span>} validateStatus={errors.address ? "error" : ""} help={errors.address?.message}>
          <Controller control={control} name="address" render={({ field }) => <Input.TextArea {...field} rows={3} />} />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>Holat</span>} validateStatus={errors.status ? "error" : ""} help={errors.status?.message}>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                {...field}
                options={[
                  { value: "active", label: "Faol" },
                  { value: "inactive", label: "Nofaol" },
                ]}
              />
            )}
          />
        </Form.Item>
      </Form>
    </FormPopup>
  );
};

export default BranchEditModal;
