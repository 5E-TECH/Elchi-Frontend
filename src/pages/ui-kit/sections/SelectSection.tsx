import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { Field } from "../../../shared/ui/primitives/Field";
import { Select, type SelectOption } from "../../../shared/ui/primitives/Select";
import { KitSection } from "../KitSection";
import { ThemePair } from "../ThemePair";

/**
 * «Tanlash ro'yxatlari» bo'limi (`?section=select`) — 3-bosqich: `Select` (oddiy, qidiruvli, ko'p tanlovli).
 *
 * Namunalar taxtadan: `tizim-states-forms` 03 «Tanlash ro'yxatlari» — yopiq holat (tanlanmagan, tanlangan,
 * xato, o'chirilgan), ochiq holat (ochiq, qidiruv bilan, topilmadi, yuklanmoqda), ko'p tanlov (tanlanmagan,
 * yopiq · 3 ta tanlangan, ochiq); ikkinchi qatorli variantlar — `superadmin-branches-add-employee-dialog`;
 * yopiq + yuklanmoqda (chevron o'rnida spinner) — `tizim-loading` 9 «Tanlov ichida spinner».
 * «Ochiq» namunalar doim ochiq (statik kadr — maket bilan solishtirish uchun), qolganlari ishlaydi.
 *
 * Ro'yxat namunada portalga chiqmaydi (`portal={false}`): tungi panel mavzusi faqat panel ichida
 * amal qiladi, portaldagi ro'yxat esa ilova mavzusida chiziladi. Haqiqiy sahifada — portal (sukut).
 * Viloyat, market va ism — maketdagi namuna ma'lumot (atoqli otlar, tarjima qilinmaydi).
 */

const REGIONS = [
  "Toshkent sh.",
  "Toshkent viloyati",
  "Samarqand",
  "Farg'ona",
  "Andijon",
  "Namangan",
  "Buxoro",
  "Qashqadaryo",
  "Surxondaryo",
  "Xorazm",
  "Navoiy",
  "Jizzax",
  "Sirdaryo",
  "Qoraqalpog'iston",
];

const MARKETS = ["Baraka Shop", "Barhayot Market", "Anbar Savdo", "Nur Elektronika", "Chilonzor Market", "Oila Market"];

/** Maketdagi holatlar tartibi (`tizim-states-forms` 03 «Ko'p tanlov», ochiq ro'yxat). */
const STATUS_KEYS = ["new", "created", "received", "on_the_road", "waiting", "sold"] as const;

const DemoBlock = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 flex-col gap-0.5">
      <h3 className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{title}</h3>
      {note ? <p className="text-[13px] text-text-muted">{note}</p> : null}
    </div>
    {children}
  </div>
);

/** Bitta holat: ustida holat nomi (maketdagi `.el-overline`), ostida maydon. `className` — ochiq ro'yxat joyi. */
const State = ({ name, className, children }: { name: string; className?: string; children: ReactNode }) => (
  <div className={cx("flex min-w-0 flex-col gap-2.5", className)}>
    <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{name}</span>
    {children}
  </div>
);

const GRID = "grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-x-6 gap-y-5";

export const SelectSection = () => {
  const { t } = useTranslation(["ui", "status"]);

  const regions = useMemo<SelectOption[]>(
    () => REGIONS.map((label, index) => ({ value: `r${index}`, label })),
    [],
  );
  const markets = useMemo<SelectOption[]>(() => MARKETS.map((label, index) => ({ value: `m${index}`, label })), []);
  const statuses = useMemo<SelectOption[]>(
    () => STATUS_KEYS.map((key) => ({ value: key, label: t(`status:order.${key}`) })),
    [t],
  );
  const users = useMemo<SelectOption[]>(
    () => [
      { value: "u1", label: "Dilshod Karimov", description: `dilshod.k · ${t("selectKit.roles.courier")}` },
      { value: "u2", label: "Doniyor Rasulov", description: `doniyor.r · ${t("selectKit.roles.courier")}` },
      { value: "u3", label: "Kamola Yusupova", description: `kamola.y · ${t("selectKit.roles.registrator")}` },
      { value: "u4", label: "Sardor Mirzayev", description: `sardor.m · ${t("selectKit.roles.courier")}` },
      { value: "u5", label: "Umid Haydarov", description: `umid.h · ${t("selectKit.roles.manager")}` },
    ],
    [t],
  );

  const [region, setRegion] = useState<string | null>(null);
  const [regionFilled, setRegionFilled] = useState<string | null>("r0");
  const [district, setDistrict] = useState<string | null>(null);
  const [market, setMarket] = useState<string | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [statusEmpty, setStatusEmpty] = useState<string[]>([]);
  const [statusFilled, setStatusFilled] = useState<string[]>(["new", "on_the_road", "waiting"]);
  const [statusOpen, setStatusOpen] = useState<string[]>(["new", "on_the_road", "waiting"]);
  const [statusCount, setStatusCount] = useState<string[]>(["new", "sold"]);

  const removeStatus = (label: string) => t("selectKit.demo.statusRemove", { label });

  return (
    <KitSection id="select" title={t("kit.sections.select.title")} description={t("kit.sections.select.description")}>
      <ThemePair layout="stack">
        {() => (
          <div className="flex min-w-0 flex-col gap-8">
            <DemoBlock title={t("selectKit.groups.closed")} note={t("selectKit.notes.closed")}>
              <div className={GRID}>
                <State name={t("selectKit.states.unselected")}>
                  <Field label={t("selectKit.demo.regionLabel")} required labelAs="span">
                    <Select
                      portal={false}
                      options={regions}
                      value={region}
                      onChange={setRegion}
                      placeholder={t("selectKit.demo.regionPlaceholder")}
                    />
                  </Field>
                </State>
                <State name={t("selectKit.states.selected")}>
                  <Field label={t("selectKit.demo.regionLabel")} required labelAs="span">
                    <Select
                      portal={false}
                      options={regions}
                      value={regionFilled}
                      onChange={setRegionFilled}
                      placeholder={t("selectKit.demo.regionPlaceholder")}
                    />
                  </Field>
                </State>
                <State name={t("selectKit.states.invalid")}>
                  <Field
                    label={t("selectKit.demo.districtLabel")}
                    required
                    labelAs="span"
                    error={district ? undefined : t("selectKit.demo.districtError")}
                  >
                    <Select
                      portal={false}
                      options={regions}
                      value={district}
                      onChange={setDistrict}
                      placeholder={t("selectKit.demo.districtPlaceholder")}
                    />
                  </Field>
                </State>
                <State name={t("selectKit.states.disabled")}>
                  <Field
                    label={t("selectKit.demo.districtLabel")}
                    required
                    labelAs="span"
                    disabled
                    hint={t("selectKit.demo.districtDisabledHint")}
                  >
                    <Select portal={false} options={[]} placeholder={t("selectKit.demo.districtDisabled")} />
                  </Field>
                </State>
              </div>
            </DemoBlock>

            <DemoBlock title={t("selectKit.groups.open")} note={t("selectKit.notes.open")}>
              <div className={GRID}>
                <State name={t("selectKit.states.open")} className="min-h-[290px] max-md:min-h-[330px]">
                  <Field label={t("selectKit.demo.regionLabel")} required labelAs="span">
                    <Select portal={false} open options={regions.slice(0, 5)} defaultValue="r0" />
                  </Field>
                </State>
                <State name={t("selectKit.states.search")} className="min-h-[220px] max-md:min-h-[250px]">
                  <Field label={t("selectKit.demo.marketLabel")} required>
                    <Select
                      portal={false}
                      open
                      searchable
                      options={markets}
                      defaultSearchValue="bar"
                      listLabel={t("selectKit.demo.marketsList")}
                    />
                  </Field>
                </State>
                <State name={t("selectKit.states.notFound")} className="min-h-[170px] max-md:min-h-[190px]">
                  <Field label={t("selectKit.demo.marketLabel")} required>
                    <Select
                      portal={false}
                      open
                      searchable
                      options={markets}
                      defaultSearchValue="Zarafshon"
                      emptyHint={(query) => t("selectKit.demo.marketNotFound", { query })}
                    />
                  </Field>
                </State>
                <State name={t("selectKit.states.loading")} className="min-h-[150px]">
                  <Field label={t("selectKit.demo.districtLabel")} required labelAs="span">
                    <Select
                      portal={false}
                      open
                      loading
                      options={[]}
                      placeholder={t("selectKit.demo.districtPlaceholder")}
                    />
                  </Field>
                </State>
              </div>
            </DemoBlock>

            <DemoBlock title={t("selectKit.groups.multi")} note={t("selectKit.notes.multi")}>
              <div className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-5 max-md:grid-cols-1">
                <div className="flex min-w-0 flex-col gap-5">
                  <State name={t("selectKit.states.unselected")}>
                    <Field label={t("selectKit.demo.statusLabel")} labelAs="span" hint={t("selectKit.demo.statusHint")}>
                      <Select
                        portal={false}
                        multiple
                        clearable
                        options={statuses}
                        value={statusEmpty}
                        onChange={setStatusEmpty}
                        placeholder={t("selectKit.demo.statusPlaceholder")}
                        clearLabel={t("selectKit.demo.statusClear")}
                        removeLabel={removeStatus}
                      />
                    </Field>
                  </State>
                  <State name={t("selectKit.states.closedMulti")}>
                    <Field
                      label={t("selectKit.demo.statusLabel")}
                      labelAs="span"
                      hint={t("selectKit.demo.statusChipsHint")}
                    >
                      <Select
                        portal={false}
                        multiple
                        clearable
                        options={statuses}
                        value={statusFilled}
                        onChange={setStatusFilled}
                        placeholder={t("selectKit.demo.statusPlaceholder")}
                        clearLabel={t("selectKit.demo.statusClear")}
                        removeLabel={removeStatus}
                      />
                    </Field>
                  </State>
                  <State name={t("selectKit.states.count")}>
                    <Field label={t("selectKit.demo.statusLabel")} labelAs="span">
                      <Select
                        portal={false}
                        multiple
                        clearable
                        multiDisplay="count"
                        options={statuses}
                        value={statusCount}
                        onChange={setStatusCount}
                        placeholder={t("selectKit.demo.statusPlaceholder")}
                        clearLabel={t("selectKit.demo.statusClear")}
                      />
                    </Field>
                  </State>
                </div>
                <State name={t("selectKit.states.open")} className="min-h-[400px]">
                  <Field label={t("selectKit.demo.statusLabel")} labelAs="span">
                    <Select
                      portal={false}
                      open
                      multiple
                      clearable
                      options={statuses}
                      value={statusOpen}
                      onChange={setStatusOpen}
                      placeholder={t("selectKit.demo.statusPlaceholder")}
                      clearLabel={t("selectKit.demo.statusClear")}
                      removeLabel={removeStatus}
                    />
                  </Field>
                </State>
              </div>
            </DemoBlock>

            <DemoBlock title={t("selectKit.groups.rich")} note={t("selectKit.notes.rich")}>
              <div className={GRID}>
                <State name={t("selectKit.states.interactive")}>
                  <Field label={t("selectKit.demo.userLabel")} required hint={t("selectKit.demo.userHint")}>
                    <Select
                      portal={false}
                      searchable
                      options={users}
                      value={user}
                      onChange={setUser}
                      placeholder={t("selectKit.demo.userPlaceholder")}
                      listLabel={t("selectKit.demo.usersList")}
                    />
                  </Field>
                </State>
                <State name={t("selectKit.states.searchInteractive")}>
                  <Field label={t("selectKit.demo.marketLabel")} required>
                    <Select
                      portal={false}
                      searchable
                      clearable
                      options={markets}
                      value={market}
                      onChange={setMarket}
                      placeholder={t("selectKit.demo.marketPlaceholder")}
                      emptyHint={(query) => t("selectKit.demo.marketNotFound", { query })}
                    />
                  </Field>
                </State>
                {/* `tizim-loading` 9: bog'liq maydon yangilanmoqda — chevron o'rnida spinner, maydon bloklanmaydi. */}
                <State name={t("selectKit.states.loadingClosed")}>
                  <Field label={t("selectKit.demo.districtLabel")} labelAs="span">
                    <Select
                      portal={false}
                      loading
                      options={[]}
                      placeholder={t("selectKit.demo.districtLoading")}
                      loadingText={t("selectKit.demo.districtLoading")}
                    />
                  </Field>
                </State>
              </div>
            </DemoBlock>
          </div>
        )}
      </ThemePair>
    </KitSection>
  );
};
