import { yupResolver } from "@hookform/resolvers/yup";
import { Form, Input, message } from "antd";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect, useMemo } from "react";
import { Building2, Phone } from "lucide-react";
import { useUsers } from "../../../entities/user";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { branchSchema } from "../model/schema";
import type { CreateBranchDto } from "../model/types";
import { useCreateBranch } from "../api/useCreateBranch";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import FormPopup, { popupLabelClassName } from "../../../shared/ui/FormPopup";
import Select from "../../../shared/ui/Select";
import { GlobalSearchInput } from "../../search";

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
  const regionOptions = useMemo(
    () => regions.map((region) => ({ value: String(region.id), label: region.name })),
    [regions],
  );
  const districtOptions = useMemo(
    () => districts.map((district) => ({ value: String(district.id), label: district.name })),
    [districts],
  );
  const statusOptions = useMemo(
    () => [
      { value: "active", label: "Faol" },
      { value: "inactive", label: "Nofaol" },
    ],
    [],
  );
  const managerOptions = useMemo(
    () =>
      managers.map((user) => ({
        value: String(user.id),
        label: `${user.fullName} (${user.username})`,
      })),
    [managers],
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
      theme="branch"
    >
      <Form layout="vertical" component={false}>
        <Form.Item label={<span className={popupLabelClassName}>Filial nomi</span>} validateStatus={errors.name ? "error" : ""} help={errors.name?.message}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <GlobalSearchInput
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Filial nomini kiriting"
                icon={Building2}
                error={Boolean(errors.name)}
                syncWithRedux={false}
                syncWithUrl={false}
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>Telefon raqami</span>} validateStatus={errors.phone_number ? "error" : ""} help={errors.phone_number?.message}>
          <Controller
            control={control}
            name="phone_number"
            render={({ field }) => (
              <GlobalSearchInput
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="+998901234567"
                icon={Phone}
                error={Boolean(errors.phone_number)}
                syncWithRedux={false}
                syncWithUrl={false}
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>Viloyat</span>} validateStatus={errors.region_id ? "error" : ""} help={errors.region_id?.message}>
          <Controller
            control={control}
            name="region_id"
            render={({ field }) => (
              <Select
                name={field.name}
                value={field.value}
                options={regionOptions}
                placeholder="Viloyatni tanlang"
                onChange={(event) => {
                  field.onChange(event.target.value);
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
                name={field.name}
                value={field.value}
                disabled={!selectedRegionId}
                options={districtOptions}
                placeholder="Tumanni tanlang"
                onChange={(event) => field.onChange(event.target.value)}
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>Manzil</span>} validateStatus={errors.address ? "error" : ""} help={errors.address?.message}>
          <Controller
            control={control}
            name="address"
            render={({ field }) => (
              <Input.TextArea
                {...field}
                rows={3}
                placeholder="Filial manzilini kiriting"
              />
            )}
          />
        </Form.Item>
        <Form.Item label={<span className={popupLabelClassName}>Holat</span>} validateStatus={errors.status ? "error" : ""} help={errors.status?.message}>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                name={field.name}
                value={field.value}
                options={statusOptions}
                placeholder="Holatni tanlang"
                onChange={(event) => field.onChange(event.target.value)}
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
                name={field.name}
                value={field.value}
                options={managerOptions}
                placeholder="Mas'ul xodimni tanlang"
                onChange={(event) => field.onChange(event.target.value)}
              />
            )}
          />
        </Form.Item>
      </Form>
    </FormPopup>
  );
};

export default BranchFormModal;
