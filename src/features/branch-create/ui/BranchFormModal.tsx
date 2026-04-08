import { yupResolver } from "@hookform/resolvers/yup";
import { Form, Input, Select, message } from "antd";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect, useMemo } from "react";
import { Building2 } from "lucide-react";
import { useUsers } from "../../../entities/user";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { branchSchema } from "../model/schema";
import type { CreateBranchDto } from "../model/types";
import { useCreateBranch } from "../api/useCreateBranch";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import FormPopup, { popupLabelClassName } from "../../../shared/ui/FormPopup";

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

const BranchFormModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const createBranch = useCreateBranch();
  const { data: regions = [] } = useRegionOptions();
  const { data: managers = [] } = useUsers({
    status: "active",
    role: ["admin", "operator"],
    page: 1,
    limit: 100,
    enabled: open,
  });
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateBranchDto>({
    resolver: yupResolver(branchSchema),
    defaultValues: {
      name: "",
      phone_number: "",
      region_id: "",
      district_id: "",
      address: "",
      status: "active",
      manager_id: "",
    },
  });

  const selectedRegionId = useWatch({ control, name: "region_id" });
  const districts = useMemo(
    () => regions.find((region) => String(region.id) === selectedRegionId)?.districts ?? [],
    [regions, selectedRegionId],
  );

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await createBranch.mutateAsync(values);
    message.success("Filial yaratildi");
    onClose();
    reset();
  });

  return (
    <FormPopup
      isOpen={open}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
      title="Yangi filial"
      description="Filial ma'lumotlarini kiriting va uni tizimga qo'shing."
      icon={<Building2 size={22} />}
      submitLabel="Saqlash"
      isLoading={createBranch.isPending}
    >
      <Form layout="vertical" component={false}>
        <Form.Item label={<span className={popupLabelClassName}>Filial nomi</span>} validateStatus={errors.name ? "error" : ""} help={errors.name?.message}>
          <Controller control={control} name="name" render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>Telefon raqami</span>} validateStatus={errors.phone_number ? "error" : ""} help={errors.phone_number?.message}>
          <Controller control={control} name="phone_number" render={({ field }) => <Input {...field} placeholder="+998901234567" />} />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>Viloyat</span>} validateStatus={errors.region_id ? "error" : ""} help={errors.region_id?.message}>
          <Controller
            control={control}
            name="region_id"
            render={({ field }) => (
              <Select
                {...field}
                showSearch
                optionFilterProp="label"
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
        <Form.Item label={<span className={popupLabelClassName}>Mas'ul xodim</span>} validateStatus={errors.manager_id ? "error" : ""} help={errors.manager_id?.message}>
          <Controller
            control={control}
            name="manager_id"
            render={({ field }) => (
              <Select
                {...field}
                showSearch
                optionFilterProp="label"
                options={managers.map((user) => ({
                  value: user.id,
                  label: `${user.fullName} (${user.username})`,
                }))}
                placeholder="Mas'ul xodimni tanlang"
              />
            )}
          />
        </Form.Item>
      </Form>
    </FormPopup>
  );
};

export default BranchFormModal;
