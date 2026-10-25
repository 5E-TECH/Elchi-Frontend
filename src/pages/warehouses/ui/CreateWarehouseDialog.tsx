// dizayn-v2: superadmin-warehouse-create-dialog, admin-warehouse-create-dialog
import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Lock, User, Warehouse as WarehouseIcon } from "lucide-react";
import { getDispatchDestinations, getHqBranch, useBranchEmployees, type Branch } from "../../../entities/branch";
import { useCreateWarehouse, useWarehouseList, type Warehouse } from "../../../entities/warehouse";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, Field, Select, TextInput, type SelectOption } from "../../../shared/ui/primitives";
import { useWarehouseText } from "../model/useWarehouseText";
import { NoteAlert } from "./NoteAlert";

/** Backend chegaralari (`CreateWarehouseRequestDto`). */
const NAME_MAX = 160;
const ADDRESS_MAX = 255;
const NOTE_MAX = 1000;
const THRESHOLD_MAX = 100_000;
const DEFAULT_THRESHOLD = "5";

/** Ombor ochiladigan filiallar: faol REGIONAL/HYBRID (`GET /branches/dispatch-destinations`, menejeri bilan). */
const DESTINATIONS_KEY = ["branches", "dispatch-destinations", "warehouse-create"] as const;
/** Markaziy ombor (Pa1KaXmj): HQ filiali — `GET /branches/hq` (404 / xato — ro'yxatda HQ yo'q, oyna eski xulqda). */
const HQ_KEY = ["branches", "hq", "warehouse-create"] as const;

const managerName = (branch: Branch | null) => branch?.manager?.fullName ?? branch?.manager?.name ?? null;
const isHqBranch = (branch: Branch | null | undefined) => branch?.type === "HQ";

type Errors = Partial<Record<"branch" | "name" | "threshold", string>>;

export type CreateWarehouseDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Ochilgan ombor (javobda bo'lmasa `null`). */
  onCreated: (warehouse: Warehouse | null) => void;
};

/**
 * OMBOR OCHISH (maket `superadmin-warehouse-create-dialog` = admin): «Filial *» — faqat ombori yo'q faol filiallar:
 * birinchi HQ — «Markaziy ombor · <HQ nomi>» (Pa1KaXmj, `GET /branches/hq`; maket yo'q — eng yaqini shu oyna), so'ng
 * viloyat filiallari (REGIONAL, HYBRID; `GET /branches/dispatch-destinations`), ikkalasidan `GET /warehouses` dagi
 * `branch_id` chiqariladi; «Ombor nomi *» (filial tanlanganda «<filial> ombori» taklif qilinadi, qo'lda
 * o'zgartirilgan bo'lsa — tegilmaydi), «Mas'ul xodim» (XtcEyQjb: ixtiyoriy tanlov — filial menejerlari
 * `GET /branches/:id/users`, rol MANAGER; tanlanmasa `manager_user_id` yuborilmaydi va backend filialning birinchi faol
 * menejerini o'zi biriktiradi; maketda faqat o'qiladigan maydon edi), «Kam qoldiq chegarasi *» (sukut 5, dona),
 * «Manzil» (bo'sh — filial manzili), «Izoh», «Ombor qanday ishlaydi» izohi. `POST /warehouses`; 409 — filialda ombor bor
 * («Filial» ostida), 400 — umumiy izoh.
 * HQ tanlansa: nom taklifi «Markaziy ombor», «Mas'ul xodim» — faqat o'qiladigan «Belgilanmaydi» (maketdagi qulf
 * maydoni) + «Markaziy omborda menejer yo'q — mas'ul belgilanmaydi», `manager_user_id` yuborilmaydi (backend uni 400
 * bilan rad etadi); «Ombor qanday ishlaydi» ning 2-bandi — buyurtmalarga keyingi bosqichda ulanishi.
 */
export const CreateWarehouseDialog = ({ open, onClose, onCreated }: CreateWarehouseDialogProps) => {
  const text = useWarehouseText();
  const { t } = text;
  const create = useCreateWarehouse();
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const destinations = useQuery({
    queryKey: DESTINATIONS_KEY,
    queryFn: () => getDispatchDestinations(),
    enabled: open,
    staleTime: 60_000,
    meta: { silentError: true },
  });
  // Xato ham (403, 5xx) — «HQ yo'q»: viloyat filiallari odatdagidek tanlanadi.
  const hqQuery = useQuery({
    queryKey: HQ_KEY,
    queryFn: getHqBranch,
    enabled: open,
    staleTime: 60_000,
    retry: false,
    meta: { silentError: true },
  });
  const hqBranch = hqQuery.data ?? null;
  // Ombori bor filiallar — tanlov ro'yxatidan chiqariladi (bitta filial — bitta ombor).
  const existing = useWarehouseList({ limit: 100 }, { enabled: open });
  const takenBranchIds = useMemo(
    () => new Set((existing.data?.items ?? []).map((warehouse) => warehouse.branchId)),
    [existing.data],
  );
  const branches = useMemo(() => {
    const free = (branch: Branch) => branch.status !== "inactive" && !takenBranchIds.has(String(branch.id));
    const hq = hqBranch && free(hqBranch) ? [hqBranch] : [];
    const regional = (destinations.data?.data ?? []).filter(
      (branch) =>
        (branch.type === "REGIONAL" || branch.type === "HYBRID" || branch.type === undefined) &&
        String(branch.id) !== String(hqBranch?.id ?? "") &&
        free(branch),
    );
    // Markaziy ombor — birinchi.
    return [...hq, ...regional];
  }, [destinations.data, hqBranch, takenBranchIds]);
  const branchOptions = useMemo<SelectOption[]>(
    () =>
      // Maket: «Qarshi filiali · Qashqadaryo viloyati» — tanlangan qiymatda ham viloyat ko'rinadi; HQ — «Markaziy
      // ombor · <HQ nomi>».
      branches.map((branch) => ({
        value: String(branch.id),
        label: isHqBranch(branch)
          ? t("create.hqOption", { branch: branch.name })
          : branch.region?.name
            ? `${branch.name} · ${branch.region.name}`
            : branch.name,
        icon: isHqBranch(branch) ? WarehouseIcon : Building2,
      })),
    [branches, t],
  );
  const selectedBranch = branches.find((branch) => String(branch.id) === branchId) ?? null;
  const hqSelected = isHqBranch(selectedBranch);
  const manager = managerName(selectedBranch);
  // Mas'ul tanlovi — faqat filial MENEJERLARI (backend boshqa xodimni 400 bilan rad etadi); HQ — so'ralmaydi.
  const employees = useBranchEmployees(branchId || undefined, open && Boolean(branchId) && !hqSelected, {
    silentError: true,
  });
  const managerOptions = useMemo<SelectOption[]>(
    () =>
      (employees.data ?? [])
        .filter((employee) => String(employee.position ?? "").toUpperCase() === "MANAGER" && employee.user.id)
        .map((employee) => ({
          value: String(employee.user.id),
          label: employee.user.fullName,
          icon: User,
          ...(employee.user.phone && employee.user.phone !== "—" ? { searchText: employee.user.phone } : {}),
        })),
    [employees.data],
  );

  const reset = () => {
    setBranchId("");
    setName("");
    setNameEdited(false);
    setThreshold(DEFAULT_THRESHOLD);
    setAddress("");
    setNote("");
    setManagerUserId("");
    setErrors({});
    create.reset();
  };

  const selectBranch = (value: string | null) => {
    const next = value ?? "";
    if (next !== branchId) setManagerUserId("");
    setBranchId(next);
    setErrors((previous) => ({ ...previous, branch: undefined }));
    const branch = branches.find((item) => String(item.id) === next);
    if (branch && !nameEdited) {
      setName(isHqBranch(branch) ? t("kind.hqWarehouse") : t("create.suggestedName", { branch: branch.name }));
    }
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!branchId) next.branch = t("create.errors.branchRequired");
    if (!name.trim()) next.name = t("create.errors.nameRequired");
    else if (name.trim().length > NAME_MAX) next.name = t("create.errors.nameTooLong", { max: NAME_MAX });
    const value = Number(threshold);
    if (threshold === "" || !Number.isInteger(value) || value < 0 || value > THRESHOLD_MAX) {
      next.threshold = t("create.errors.threshold", { max: text.number(THRESHOLD_MAX) });
    }
    return next;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (create.isPending) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    try {
      const warehouse = await create.mutateAsync({
        branch_id: branchId,
        name: name.trim(),
        low_stock_default: Number(threshold),
        // Tanlanmasa — yuborilmaydi: backend filialning birinchi faol menejerini o'zi biriktiradi (XtcEyQjb).
        // Markaziy ombor — hech qachon (Pa1KaXmj: backend 400 «Markaziy omborga mas'ul menejer biriktirilmaydi»).
        ...(managerUserId && !hqSelected ? { manager_user_id: managerUserId } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      notify.success(t("create.success"), { description: warehouse?.name ?? name.trim() });
      reset();
      onCreated(warehouse);
    } catch (error) {
      if (getErrorStatus(error) === 409) {
        setErrors({ branch: t("create.errors.branchTaken") });
        return;
      }
      notify.error(t("create.failed"), { description: text.writeError(error) });
    }
  };

  const close = () => {
    if (create.isPending) return;
    reset();
    onClose();
  };

  const busy = create.isPending;
  // HQ so'rovi kutiladi (ro'yxat birinchi bandi), lekin uning xatosi «HQ yo'q» — viloyat filiallari yetadi.
  const branchesLoading = destinations.isLoading || hqQuery.isLoading || existing.isLoading;
  const branchHint = destinations.isError
    ? t("create.branchLoadFailed")
    : !branchesLoading && branchOptions.length === 0
      ? t("create.noBranches")
      : t("create.branchHint");

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={busy}
      size="lg"
      className="md:max-w-[600px]"
      icon={WarehouseIcon}
      title={t("create.title")}
      description={t("create.description")}
      onSubmit={(event) => void submit(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            {t("actions.cancel")}
          </Button>
          <Button type="submit" loading={busy} loadingText={t("create.submitting")}>
            {t("create.submit")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
        <Field label={t("create.branch")} required labelAs="span" hint={branchHint} error={errors.branch} className="col-span-full">
          <Select
            options={branchOptions}
            value={branchId || null}
            onChange={selectBranch}
            searchable
            icon={Building2}
            placeholder={t("create.branchPlaceholder")}
            loading={branchesLoading}
            noOptionsText={t("create.noBranches")}
            disabled={busy}
          />
        </Field>
        <Field label={t("create.name")} required hint={t("create.nameHint")} error={errors.name} className="col-span-full">
          <TextInput
            value={name}
            onValueChange={(value) => {
              setName(value);
              setNameEdited(true);
              setErrors((previous) => ({ ...previous, name: undefined }));
            }}
            placeholder={t("create.namePlaceholder")}
            maxLength={NAME_MAX}
            autoComplete="off"
            readOnly={busy}
          />
        </Field>
        {hqSelected ? (
          // Maketdagi faqat o'qiladigan «Mas'ul xodim» (qulf) — Markaziy omborda menejer yo'q.
          <Field label={t("create.manager")} hint={t("create.hqManagerHint")}>
            <TextInput
              value={t("create.hqManagerValue")}
              readOnly
              suffix={<Lock size={16} aria-hidden="true" className="text-text-subtle" />}
            />
          </Field>
        ) : (
          <Field
            label={t("create.manager")}
            labelAs="span"
            optional
            hint={employees.isError ? t("create.managersLoadFailed") : t("create.managerHint")}
          >
            <Select
              options={managerOptions}
              value={managerUserId || null}
              onChange={(next) => setManagerUserId(next ?? "")}
              clearable
              icon={User}
              placeholder={
                selectedBranch
                  ? manager
                    ? t("create.managerAuto", { name: manager })
                    : t("create.managerAutoNone")
                  : t("create.managerPlaceholder")
              }
              loading={employees.isLoading && Boolean(branchId)}
              noOptionsText={t("create.noManager")}
              disabled={busy || !selectedBranch}
            />
          </Field>
        )}
        <Field label={t("create.threshold")} required hint={t("create.thresholdHint")} error={errors.threshold}>
          <TextInput
            mode="number"
            value={threshold}
            onValueChange={(value) => {
              setThreshold(value);
              setErrors((previous) => ({ ...previous, threshold: undefined }));
            }}
            suffix={t("units.pcsWord", { count: Number(threshold) || 0 })}
            autoComplete="off"
            readOnly={busy}
          />
        </Field>
        <Field label={t("create.address")} hint={t("create.addressHint")} className="col-span-full">
          <TextInput
            value={address}
            onValueChange={setAddress}
            placeholder={
              selectedBranch?.address && selectedBranch.address.trim().length > 2
                ? selectedBranch.address
                : t("create.addressPlaceholder")
            }
            maxLength={ADDRESS_MAX}
            autoComplete="off"
            readOnly={busy}
          />
        </Field>
        <Field label={t("create.note")} className="col-span-full">
          <TextInput
            multiline
            rows={2}
            value={note}
            onValueChange={setNote}
            placeholder={t("create.notePlaceholder")}
            maxLength={NOTE_MAX}
            readOnly={busy}
          />
        </Field>
        <NoteAlert title={t("create.howTitle")} className="col-span-full">
          <ol className="m-0 flex list-decimal flex-col gap-0.5 pl-5">
            <li>{t("create.how1")}</li>
            <li>{t(hqSelected ? "create.how2Hq" : "create.how2")}</li>
            <li>{t("create.how3")}</li>
          </ol>
        </NoteAlert>
      </div>
    </Dialog>
  );
};
