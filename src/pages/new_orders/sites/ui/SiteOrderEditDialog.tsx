// dizayn-v2: (maket yo'q) superadmin-orders-detail-edit-customer-dialog
import { memo, useMemo, useRef, useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isCompleteUzbekistanPhone, toUzbekistanPhoneValue } from "../../../../shared/lib/phone";
import { Button, Dialog, Field, Select, TextInput, type SelectOption } from "../../../../shared/ui/primitives";
import { findSiteDistrict, normalizeSitePhone, siteRegionConflicts, type SiteDistrict, type SiteOrderEdit } from "../model/siteEdit";
import type { SiteOrderPreview } from "../model/siteOrder";
import { siteOrderLabel } from "./siteOrderLabel";

type Props = {
  row: SiteOrderPreview;
  /** `null` — tumanlar ro'yxati kelmagan: viloyat/tuman maydonlari chizilmaydi. */
  districts: readonly SiteDistrict[] | null;
  onClose: () => void;
  onSave: (edit: SiteOrderEdit) => void;
};

type Errors = Partial<Record<"phone" | "region" | "district" | "amount", string>>;

/**
 * Boshlang'ich telefon. ⚠️ 9 raqamdan uzun xato raqam KESILMAYDI (kesilsa boshqa odamning to'g'ri ko'rinadigan raqami
 * chiqardi) — maydon bo'sh ochiladi, saytdan kelgani izohda ko'rinadi.
 */
const seedPhone = (raw: string): string => {
  const normalized = normalizeSitePhone(raw);
  if (normalized) return normalized;
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("998") && digits.length > 9 ? digits.slice(3) : digits;
  return local.length > 9 ? toUzbekistanPhoneValue("") : toUzbekistanPhoneValue(local);
};

/**
 * SAYTDAN XATO KELGAN BUYURTMANI TUZATISH (ega 2026-11-25) — skanerlangan ro'yxatning o'zida, qabuldan oldin.
 *
 * Maket yo'q — eng yaqini `superadmin-orders-detail-edit-customer-dialog` (460 px; telefonda pastki varaqa). Hech narsa
 * serverga yuborilmaydi: tuzatilgan qiymat qatorga yoziladi va «Qabul qilish» da saytdan kelgan o'rniga ketadi.
 */
const SiteOrderEditDialog = ({ row, districts, onClose, onSave }: Props) => {
  const { t } = useTranslation(["newOrders", "common"]);
  const current = useMemo(() => (districts ? findSiteDistrict(districts, row.districtCode) : null), [districts, row.districtCode]);
  const conflict = Boolean(current && siteRegionConflicts(row.regionCode, current));
  const initial = useMemo(
    () => ({
      name: row.name,
      phone: seedPhone(row.phone),
      regionId: current?.regionId ?? "",
      districtId: current?.id ?? "",
      address: row.address,
    }),
    [current, row],
  );
  const [form, setForm] = useState({ ...initial, amount: "" });
  const [errors, setErrors] = useState<Errors>({});
  const phoneRef = useRef<HTMLInputElement>(null);
  const amountEditable = row.amount === null;

  const set = (patch: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors({});
  };

  const regionOptions = useMemo<SelectOption[]>(() => {
    const byId = new Map<string, string>();
    for (const item of districts ?? []) {
      if (item.regionId && item.regionName) byId.set(item.regionId, item.regionName);
    }
    return [...byId].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [districts]);

  const districtOptions = useMemo<SelectOption[]>(
    () =>
      (districts ?? [])
        .filter((item) => item.regionId === form.regionId)
        .map((item) => ({ value: item.id, label: item.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [districts, form.regionId],
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(form.amount);
    const next: Errors = {};
    if (!isCompleteUzbekistanPhone(form.phone)) next.phone = t("sites.edit.phoneError");
    if (districts && !form.regionId) next.region = t("sites.edit.regionError");
    else if (districts && !form.districtId) next.district = t("sites.edit.districtError");
    if (amountEditable && (!form.amount || !Number.isFinite(amount) || amount < 0)) next.amount = t("sites.edit.amountError");
    setErrors(next);
    if (next.phone) phoneRef.current?.focus();
    if (Object.keys(next).length) return;

    const district = districts?.find((item) => item.id === form.districtId);
    const phone = normalizeSitePhone(form.phone);
    const name = form.name.trim();
    const address = form.address.trim();
    onSave({
      ...(phone && phone !== normalizeSitePhone(row.phone) ? { phone } : {}),
      ...(name !== row.name ? { name } : {}),
      ...(address !== row.address ? { address } : {}),
      // Viloyat zid bo'lsa, o'sha tuman qayta tasdiqlangani ham yoziladi (saytning viloyati bo'shatiladi).
      ...(district && (district.id !== current?.id || conflict) ? { districtCode: district.sato ?? district.id } : {}),
      ...(amountEditable ? { amount } : {}),
    });
  };

  /** Xato kelgan raqam — solishtirish uchun saytdagicha ko'rsatiladi. */
  const phoneHint =
    row.phone && !normalizeSitePhone(row.phone) ? t("sites.edit.fromSite", { value: row.phone }) : undefined;

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      className="md:max-w-[460px]"
      title={t("sites.edit.title")}
      description={siteOrderLabel(row)}
      icon={Pencil}
      onSubmit={submit}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel", { ns: "common" })}
          </Button>
          <Button type="submit">{t("save", { ns: "common" })}</Button>
        </>
      }
    >
      <Field label={t("sites.edit.phone")} required error={errors.phone} hint={phoneHint}>
        <TextInput ref={phoneRef} mode="phone" value={form.phone} onValueChange={(phone) => set({ phone })} />
      </Field>
      <Field label={t("sites.edit.name")}>
        <TextInput personName value={form.name} onValueChange={(name) => set({ name })} autoComplete="off" />
      </Field>
      {districts ? (
        <>
          <Field
            label={t("region")}
            labelAs="span"
            required
            error={errors.region}
            hint={
              conflict
                ? t("sites.edit.regionConflict", { region: row.regionCode, district: row.districtCode })
                : !current && row.districtCode
                  ? t("sites.edit.districtUnknown", { value: row.districtCode })
                  : undefined
            }
          >
            <Select
              searchable
              options={regionOptions}
              value={form.regionId || null}
              onChange={(value) => set({ regionId: value ?? "", districtId: "" })}
              placeholder={t("selectRegion")}
            />
          </Field>
          <Field label={t("district")} labelAs="span" required error={errors.district}>
            <Select
              searchable
              options={districtOptions}
              value={form.districtId || null}
              onChange={(value) => set({ districtId: value ?? "" })}
              placeholder={form.regionId ? t("selectDistrict") : t("selectRegionFirst")}
              noOptionsText={form.regionId ? undefined : t("selectRegionFirst")}
            />
          </Field>
        </>
      ) : null}
      <Field label={t("sites.edit.address")}>
        <TextInput value={form.address} onValueChange={(address) => set({ address })} autoComplete="off" />
      </Field>
      {amountEditable ? (
        <Field label={t("sites.edit.amount")} required error={errors.amount} hint={t("sites.edit.amountHint")}>
          <TextInput mode="money" value={form.amount} onValueChange={(amount) => set({ amount })} />
        </Field>
      ) : null}
    </Dialog>
  );
};

export default memo(SiteOrderEditDialog);
