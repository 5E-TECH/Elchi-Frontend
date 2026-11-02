// dizayn-v2: superadmin-regions-sato-codes-add-dialog
import { useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { Info, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { DISTRICT_KEY } from "../../../../entities/logistics/api/logisticsApi";
import { api } from "../../../../shared/api/api";
import { API_ENDPOINTS } from "../../../../shared/api";
import { notify } from "../../../../shared/lib/notify";
import { Button, Dialog, Field, Select, TextInput } from "../../../../shared/ui/primitives";
import { classifyDistrictSatoError, validateDistrictSatoCode } from "../../model/districtSatoCode";
import {
  findSimilarSatoDistrict,
  type SatoDistrict,
  type SatoMissingRow,
  type SatoRegionOption,
  type SatoTab,
} from "../../model/satoModel";
import { useSatoCodeOwner } from "../useSatoCodeOwner";
import { satoClientError, useSatoEditorErrorText, type SatoEditorError } from "./useSatoCodeEditor";

type Errors = { name?: string; region?: string; code?: SatoEditorError };

type Props = {
  /** «Bazada yo'q» qatori (`null` — oyna yopiq). */
  row: SatoMissingRow | null;
  districts: readonly SatoDistrict[];
  /** Viloyatlar (`satoCode` — kod prefiksi tekshiruvi; yo'q bo'lsa prefiks tekshirilmaydi). */
  regionOptions: readonly SatoRegionOption[];
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
 * {name, region_id, sato_code}` — kod MAJBURIY (ExK28CiS): 7 raqam, TANLANGAN viloyat kodi bilan boshlanadi (klientda
 * so'rovdan oldin; 400 `region_prefix_mismatch` — kod maydonida); 409 — maydon xatolari (kod band: egasi
 * `GET district/sato/:code`; aks holda — shu nomli tuman bor), 404 — viloyat topilmadi. Server matni ko'rsatilmaydi.
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
  const queryClient = useQueryClient();
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

  const lookupOwner = useSatoCodeOwner();
  const similar = findSimilarSatoDistrict(districts, { name, regionId });
  const similarTab = similar ? tabOf(similar.id) : null;
  const region = regionOptions.find((option) => option.value === regionId);
  const regionName = region?.label ?? row.regionName;
  const regionPrefix = region?.satoCode ?? null;

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
    // Kod majburiy: 7 raqam va tanlangan viloyat prefiksi (viloyat tanlanmagan bo'lsa — faqat format).
    const codeError = validateDistrictSatoCode(trimmedCode, regionId ? regionPrefix : null);
    if (codeError) next.code = satoClientError(codeError, regionName);
    setErrors(next);
    if (Object.keys(next).length > 0 || !regionId) return;

    setSaving(true);
    try {
      await api.post(API_ENDPOINTS.DISTRICTS.BASE, {
        name: trimmedName,
        region_id: regionId,
        sato_code: trimmedCode,
      });
    } catch (cause) {
      const server = classifyDistrictSatoError(cause);
      if (server.kind === "conflict") {
        // Backend 409 ikki xil: shu viloyatda shu nom bor yoki kod band — kod egasi so'raladi, server matni o'qilmaydi.
        // 200 — kod band (egasi o'qilmasa ham «Bu kod boshqa tumanga yozilgan»), 404 — kod bo'sh, demak nom band.
        const owner = await lookupOwner(trimmedCode);
        const taken: SatoEditorError | undefined =
          owner.kind === "owner"
            ? { kind: "taken", district: owner.name, region: owner.regionName }
            : owner.kind === "taken"
              ? { kind: "takenUnknown" }
              : undefined;
        // Backend: shu viloyatda aynan shu nom (trim) — o'xshash nom emas.
        const key = trimmedName.toLocaleLowerCase("uz");
        const nameTaken = districts.some(
          (district) => district.region?.id === regionId && district.name.trim().toLocaleLowerCase("uz") === key,
        );
        if (owner.kind === "unknown" && !nameTaken) {
          // Kod egasini so'rab bo'lmadi (5xx, aloqa) — «nom band» deb noto'g'ri aytilmaydi.
          notify.error(t("v2.sato.add.failed"), { description: t("v2.sato.add.failedText") });
        } else {
          setErrors({
            code: taken,
            name: nameTaken || owner.kind === "none" ? t("v2.sato.add.nameTaken") : undefined,
          });
        }
      } else if (server.kind === "regionMissing") {
        setErrors({ region: t("v2.sato.add.regionMissing") });
      } else if (server.kind === "prefix" || server.kind === "format") {
        // Prefiks — serverdagi `details.expected_prefix` ustun (klient bilgani zaxira).
        const prefix = server.kind === "prefix" ? (server.expectedPrefix ?? regionPrefix) : null;
        setErrors({ code: prefix ? { kind: "prefix", prefix, region: regionName } : { kind: "format" } });
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
    // Yangi tuman geografik tuman ro'yxatlarida ham (`useGetDistricts` — buyurtma yaratish, manzil, filtrlar) chiqsin.
    await Promise.all([
      onAdded().catch(() => undefined),
      queryClient.invalidateQueries({ queryKey: [DISTRICT_KEY] }),
    ]);
  };

  const setField = (field: keyof Errors, setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const codeHint = regionPrefix
    ? t("v2.sato.add.codeHint", { region: regionName, prefix: regionPrefix })
    : t("v2.sato.add.codeHintNoPrefix");

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
            const nextId = value || null;
            setRegionId(nextId);
            // Viloyat almashsa — kod yangi viloyat prefiksiga darhol tekshiriladi (so'rovsiz, maket «…-add-dialog»).
            const nextRegion = regionOptions.find((option) => option.value === nextId);
            const prefix = nextRegion?.satoCode ?? null;
            const mismatch = code.trim() ? validateDistrictSatoCode(code, prefix) : null;
            setErrors((current) => ({
              ...current,
              region: undefined,
              code:
                mismatch?.kind === "prefix"
                  ? satoClientError(mismatch, nextRegion?.label ?? null)
                  : current.code?.kind === "prefix"
                    ? undefined
                    : current.code,
            }));
          }}
          placeholder={t("v2.sato.add.regionPlaceholder")}
          searchable={regionOptions.length > 8}
        />
      </Field>
      <Field label={t("v2.sato.add.code")} required hint={codeHint} error={codeErrorText(errors.code ?? null) ?? undefined}>
        <TextInput
          mode="number"
          maxLength={7}
          value={code}
          onValueChange={setField("code", setCode)}
          autoComplete="off"
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
