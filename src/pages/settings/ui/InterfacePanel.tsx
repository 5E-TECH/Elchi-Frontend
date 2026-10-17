// dizayn-v2: common-settings-interface
import { useId } from "react";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { ChoiceCard, FootNote, RadioDot, SectionHead } from "./settingsUi";

/**
 * Yon panel namunasi (maket `common-settings-interface`): chapda yon menyu (`nav` ranglari — joriy mavzuda),
 * o'ngda ish maydoni bloklari (`raised`). `collapsed` — faqat ikonkalar (nuqtalar).
 */
const SidebarPreview = ({ collapsed }: { collapsed: boolean }) => (
  <span aria-hidden="true" className="flex h-[104px] gap-1.5 rounded-lg bg-sunken p-2">
    {collapsed ? (
      <span className="flex w-7 flex-none flex-col items-center gap-2 rounded-md border border-nav-line bg-nav py-2">
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            key={index}
            className={cx("size-2.5 rounded-full", index === 0 ? "bg-nav-text" : "bg-nav-active")}
          />
        ))}
      </span>
    ) : (
      <span className="flex w-[32%] flex-none flex-col gap-1.5 rounded-md border border-nav-line bg-nav p-2">
        {["70%", "90%", "76%", "84%", "64%"].map((width, index) => (
          <span
            key={width}
            className={cx(
              "h-1.5 rounded-full",
              index === 0 ? "bg-nav-text" : "bg-nav-active",
              index === 1 && "mt-1",
            )}
            style={{ width }}
          />
        ))}
      </span>
    )}
    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="h-3.5 rounded-md bg-raised" />
      <span className="flex flex-1 gap-1.5">
        <span className="flex-1 rounded-md bg-raised" />
        <span className="flex-1 rounded-md bg-raised" />
      </span>
      <span className="flex-1 rounded-md bg-raised" />
    </span>
  </span>
);

/**
 * «INTERFEYS» — maket `common-settings-interface`: «Yon panel» radio — «Ochiq» / «Yig'ilgan»
 * (`setSidebar` + `persist({ interface: { sidebarOpen } })` — sahifada).
 */
export const InterfacePanel = ({
  sidebarOpen,
  onSidebar,
}: {
  sidebarOpen: boolean;
  onSidebar: (open: boolean) => void;
}) => {
  const { t } = useTranslation("settings");
  const headId = useId();
  const options = [
    { open: true, key: "open" },
    { open: false, key: "collapsed" },
  ] as const;

  return (
    <>
      <div
        role="radiogroup"
        aria-labelledby={headId}
        className="flex flex-col gap-4 p-5 max-md:p-4"
      >
        <SectionHead
          id={headId}
          title={t("interface.sidebar")}
          hint={t("interface.sidebar_hint")}
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
          {options.map(({ open, key }) => (
            <ChoiceCard
              key={key}
              name="settings-sidebar"
              value={key}
              checked={sidebarOpen === open}
              onSelect={() => onSidebar(open)}
              className="flex-col gap-3 p-3"
            >
              <SidebarPreview collapsed={!open} />
              <span className="flex min-h-6 items-center gap-2.5 px-1">
                <RadioDot />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold">{t(`interface.${key}`)}</span>
                  <span className="text-xs text-text-muted">{t(`interface.${key}_hint`)}</span>
                </span>
              </span>
            </ChoiceCard>
          ))}
        </div>
      </div>
      <div className="border-t border-border px-5 py-3 max-md:px-4">
        <FootNote icon={<Info size={16} />}>{t("interface.footer")}</FootNote>
      </div>
    </>
  );
};
