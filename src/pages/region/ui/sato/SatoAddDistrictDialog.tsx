// dizayn-v2: superadmin-regions-sato-codes-add-dialog
import { useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { Info, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../shared/api/api";
import { API_ENDPOINTS } from "../../../../shared/api";
import { notify } from "../../../../shared/lib/notify";
import { Button, Dialog, Field, Select, TextInput } from "../../../../shared/ui/primitives";
import { httpStatusOf } from "../../model/districtMerge";
import {
  findSimilarSatoDistrict,
  isValidSatoCode,
  normalizeSatoOwner,
  type SatoDistrict,
  type SatoMissingRow,
  type SatoTab,
} from "../../model/satoModel";
import { useSatoEditorErrorText, type SatoEditorError } from "./useSatoCodeEditor";

type Errors = { name?: string; region?: string; code?: string };

type Props = {
  /** «Bazada yo'q» qatori (`null` — oyna yopiq). */
  row: SatoMissingRow | null;
  districts: readonly SatoDistrict[];
  regionOptions: readonly { value: string; label: string }[];
  /** O'xshash tuman qaysi tabda (ogohlantirishdagi «… tabida unga kodni kiriting»). */
  tabOf: (districtId: string) => SatoTab | null;
  onClose: () => void;
  /** Qo'shilgach: preview, `/district` va viloyatlar taxtasi qayta yuklanadi. */
  onAdded: () => Promise<unknown>;
  /** Qator tugmasi yo'qolgan bo'lsa (qo'shilgach «Bazada yo'q» dan chiqadi) — fokus shu yerga (qidiruv maydoni). */
  fallbackFocus: RefObject<HTMLElement | null>;
};

/**
 * «TUMAN QO'SHISH» (superadmin, «Bazada yo'q» qatoridan): nom, viloyat (`sato_code` prefiksidan, zaxira — nomi) va
 * kod rasmiy ro'yxatdan to'ldiriladi. Shu viloyatda o'xshash nomli tuman bo'lsa — ogohlantirish. `POST district
 * {name, region_id, sato_code}`; 409 — maydon xatolari (kod band: egasi `GET district/sato/:code`; aks holda — shu
 * nomli tuman bor), 404 — viloyat topilmadi. Server matni ko'rsatilmaydi.
 */
export const SatoAddDistrictDialog = (props: Props) =>
  props.row ? <AddDistrictForm key={props.row.satoCode} {...props} row={props.row} /> : null;

const AddDistrictForm = ({
  row,
  districts,
  regionOptions,
  tabOf,
  onClose,
  onAdded,
  fallbackFocus,
}: Props & { row: SatoMissingRow }) => {
  const { t } = useTranslation("region");
  const codeErrorText = useSatoEditorErrorText();
  const [open, setOpen] = useState(true);
  const [name, setName] = useState(row.satoName);
  const [regionId, setRegionId] = useState<string | null>(row.regionId);
  const [code, setCode] = useState(row.satoCode);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  // Ochgan tugma (qator «+»): bekor qilinsa — unga. Qo'shilgach qator ro'yxatdan chiqadi (qayta yuklash oyna
  // yopilgandan keyin tugashi mumkin) — fokus darhol zaxira elementga (qidiruv), body ga tushib qolmaydi.
  const [origin] = useState(() =>
    typeof document === "undefined" ? null : document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const addedRef = useRef(false);
  const returnFocus = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return !addedRef.current && origin?.isConnected ? origin : fallbackFocus.current;
      },
    }),
    [fallbackFocus, origin],
  );

  const similar = findSimilarSatoDistrict(districts, { name, regionId });
  const similarTab = similar ? tabOf(similar.id) : null;
  const regionName = regionOptions.find((option) => option.value === regionId)?.label ?? row.regionName;

  const close = () => {
    if (!saving) setOpen(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    const next: Errors = {};
    if (!trimmedName) next.name = t("v2.sato.add.nameRequired");
    if (!regionId) next.region = t("v2.sato.add.regionRequired");
    if (trimmedCode && !isValidSatoCode(trimmedCode)) next.code = t("v2.sato.add.codeInvalid");
    setErrors(next);
    if (Object.keys(next).length > 0 || !regionId) return;

    setSaving(true);
    try {
      await api.post(API_ENDPOINTS.DISTRICTS.BASE, {
        name: trimmedName,
        region_id: regionId,
        ...(trimmedCode ? { sato_code: trimmedCode } : {}),
      });
    } catch (cause) {
      const status = httpStatusOf(cause);
      if (status === 409) {
        // Backend 409 ikki xil: shu viloyatda shu nom bor yoki kod band — kod egasi so'raladi, server matni o'qilmaydi.
        let codeError: SatoEditorError | null = null;
        let ownerUnknown = false;
        if (trimmedCode) {
          try {
            const owner = normalizeSatoOwner((await api.get(API_ENDPOINTS.DISTRICTS.SATO_BY_CODE(trimmedCode))).data);
            if (owner) codeError = { kind: "taken", district: owner.name, region: owner.regionName };
          } catch (lookupError) {
            // 404 — kod egasi yo'q, demak nom band. Boshqa xato (5xx, aloqa) — sabab noma'lum.
            if (httpStatusOf(lookupError) !== 404) ownerUnknown = true;
          }
        }
        // Backend: shu viloyatda aynan shu nom (trim) — o'xshash nom emas.
        const key = trimmedName.toLocaleLowerCase("uz");
        const nameTaken = districts.some(
          (district) => district.region?.id === regionId && district.name.trim().toLocaleLowerCase("uz") === key,
        );
        if (ownerUnknown && !nameTaken) {
          // Kod egasini bilib bo'lmadi — «nom band» deb noto'g'ri aytilmaydi.
          notify.error(t("v2.sato.add.failed"), { description: t("v2.sato.add.failedText") });
          setSaving(false);
          return;
        }
        setErrors({
          code: codeError ? (codeErrorText(codeError) ?? undefined) : undefined,
          name: nameTaken || !codeError ? t("v2.sato.add.nameTaken") : undefined,
        });
      } else if (status === 404) {
        setErrors({ region: t("v2.sato.add.regionMissing") });
      } else {
        notify.error(t("v2.sato.add.failed"), { description: t("v2.sato.add.failedText") });
      }
      setSaving(false);
      return;
    }
    addedRef.current = true;
    notify.success(t("v2.sato.add.done"), {
      description: t("v2.sato.add.doneText", { name: trimmedName, region: regionName }),
    });
    setSaving(false);
    setOpen(false);
    await onAdded().catch(() => undefined);
  };

  const setField = (field: keyof Errors, setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      onExited={onClose}
      returnFocus={returnFocus}
      size="md"
      className="md:w-[460px]"
      busy={saving}
      title={t("v2.sato.add.title")}
      description={t("v2.sato.add.text")}
      icon={Plus}
      onSubmit={(event) => void submit(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={close}>
            {t("v2.sato.add.cancel")}
          </Button>
          <Button type="submit" variant="primary" leftIcon={Plus} loading={saving} loadingText={t("v2.sato.add.saving")}>
            {t("v2.sato.add.submit")}
          </Button>
        </>
      }
    >
      <Field label={t("v2.sato.add.name")} required error={errors.name}>
        <TextInput
          value={name}
          onValueChange={setField("name", setName)}
          placeholder={t("v2.sato.add.namePlaceholder")}
          autoComplete="off"
        />
      </Field>
      <Field label={t("v2.sato.add.region")} required labelAs="span" error={errors.region}>
        <Select
          options={regionOptions}
          value={regionId}
          onChange={(value) => {
            setRegionId(value || null);
            if (errors.region) setErrors((current) => ({ ...current, region: undefined }));
          }}
          placeholder={t("v2.sato.add.regionPlaceholder")}
          searchable={regionOptions.length > 8}
        />
      </Field>
      <Field label={t("v2.sato.add.code")} hint={t("v2.sato.add.codeHint")} error={errors.code}>
        <TextInput
          value={code}
          onValueChange={setField("code", setCode)}
          inputMode="numeric"
          autoComplete="off"
          className="tabular-nums"
        />
      </Field>
      {similar ? (
        <p
          role="note"
          className="m-0 flex items-start gap-2 rounded-[10px] bg-sunken px-3 py-2.5 text-[13px] text-text-muted"
        >
          <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span className="min-w-0">
            {similar.satoCode && (similarTab === "hasCode" || !similarTab)
              ? t("v2.sato.add.similarWithCode", { name: similar.name, code: similar.satoCode })
              : t("v2.sato.add.similar", {
                  name: similar.name,
                  tab: t(`v2.sato.tabs.${similarTab ?? "notFound"}`),
                })}
          </span>
        </p>
      ) : null}
    </Dialog>
  );
};
