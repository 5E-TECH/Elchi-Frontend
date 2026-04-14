import { yupResolver } from "@hookform/resolvers/yup";
import { Form, Input, message } from "antd";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, SquarePen } from "lucide-react";
import { api } from "../../../shared/api/instance";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { Branch } from "../../../entities/branch";
import FormPopup, { popupLabelClassName } from "../../../shared/ui/FormPopup";
import { branchEditSchema } from "../model/schema";
import type { UpdateBranchDto } from "../model/types";
import { useUpdateBranch } from "../api/useUpdateBranch";
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
  const regionOptions = useMemo(
    () => regions.map((region) => ({ value: String(region.id), label: region.name })),
    [regions],
  );
  const districtOptions = useMemo(
    () => {
      const options = districts.map((district) => ({
        value: String(district.id),
        label: district.name,
      }));

      if (!initialData || String(initialData.region.id) !== selectedRegionId) {
        return options;
      }

      const currentDistrictOption = {
        value: String(initialData.district.id),
        label: initialData.district.name,
      };

      const hasCurrentDistrict = options.some(
        (option) => option.value === currentDistrictOption.value,
      );

      return hasCurrentDistrict ? options : [currentDistrictOption, ...options];
    },
    [districts, initialData, selectedRegionId],
  );
  const statusOptions = useMemo(
    () => [
      { value: "active", label: "Faol" },
      { value: "inactive", label: "Nofaol" },
    ],
    [],
  );

  useEffect(() => {
    if (open && initialData) {
      reset({
        name: initialData.name,
        region_id: String(initialData.region.id),
        district_id: String(initialData.district.id),
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
      </Form>
    </FormPopup>
  );
};

export default BranchEditModal;
