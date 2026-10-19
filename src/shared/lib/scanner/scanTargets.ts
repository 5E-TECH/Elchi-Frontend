import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import type { ScanSource } from "./feedback";

export type { ScanSource } from "./feedback";

/**
 * SKAN MAQSADLARI REYESTRI (Trello v1eLN2tV, 1-bosqich; ega qarori 2026-10-19).
 *
 * Skan kutayotgan sahifa (qabul qilish, pochta, paket, biriktirish …) o'zini shu yerda «skan maqsadi» sifatida
 * ro'yxatdan o'tkazadi. Pastki menyuning markaziy «Skaner» tugmasi va yuqori paneldagi «Skanerlash» faol maqsad
 * bo'lsa kamerani SHU sahifa ustida, shu maqsad rejimida ochadi (`ScannerHost`); aks holda universal `/scan`.
 * Kamera o'qigan har kod `target.onScan(raw, "camera")` ga tushadi — USB skaner bilan aynan bir xil handler.
 *
 * Redux EMAS: bu UI holati, sahifa almashganda o'zi tozalanadi (komponent o'chdi → maqsad olindi).
 * Stack: avval qatlam (`layer: "dialog"` — oyna ichidagi maqsad doim sahifanikidan ustun, hatto ikkalasi bir
 * commit'da o'rnatilsa yoki sahifa maqsadi oyna ochiq turganda qayta yoqilsa ham), qatlam ichida — oxirgi
 * ro'yxatdan o'tgan ustun.
 *
 *   useScanTarget(enabled ? { id: "new-orders:market:7", title: "Qabul qilish", onScan } : null);
 *   const target = useActiveScanTarget();
 */

export type ScanTargetTone = "success" | "warning" | "danger" | "neutral";

export type ScanTargetListItem = {
  key: string;
  title: string;
  subtitle?: string;
  tone?: ScanTargetTone;
  /** Berilsa — qatorda «Bekor qilish» (tanlovdan chiqarish; server amali emas). */
  onUndo?: () => void;
};

export type ScanTargetMode = { value: string; label: string };

export type ScanTargetSwitcherOption = { value: string; label: string; meta?: string };

/**
 * Kameradan chiqmasdan kontekstni almashtirish (ega, 2026-10-19 — «F»): masalan qabul qilishda market.
 * Kamera sarlavhasida chip «<label> ▾»; bosilsa qidiruvli ro'yxat varag'i; tanlansa `onSelect` (kamera YOPILMAYDI —
 * `onSelect` boshqa sahifaga o'tsa, yangi sahifaning maqsadi bilan davom etadi, `ScannerHost`).
 */
export type ScanTargetSwitcher = {
  /** Chipdagi joriy qiymat nomi («Urgut Savdo»). */
  label: string;
  /** Joriy qiymat (ro'yxatda belgilanadi). */
  value: string;
  /** Varaq sarlavhasi («Marketni tanlang»). */
  title: string;
  /** Variantlar yoki ularni yuklovchi funksiya (varaq ochilganda chaqiriladi). */
  options: ReadonlyArray<ScanTargetSwitcherOption> | (() => Promise<ReadonlyArray<ScanTargetSwitcherOption>>);
  onSelect: (value: string) => void;
};

/** Hisoblagich kengaytmasi: «Qabul qilindi 3 · Qoldi 3 · Topilmadi 1». */
export type ScanTargetStat = { key: string; label: string; value: number; tone?: ScanTargetTone };

export type ScanTargetLayer = "page" | "dialog";

export interface ScanTarget {
  /** Barqaror kalit (masalan `"new-orders:market:7"`). */
  id: string;
  /** Qatlam (sukut `"page"`): oyna (`Dialog`) ichidagi maqsad `"dialog"` — u sahifanikidan doim ustun. */
  layer?: ScanTargetLayer;
  /** Kamera sarlavhasi — maketdagi matn: «Qabul qilish». */
  title: string;
  /** Sarlavha ostidagi kontekst: «Urgut Savdo · 6 ta buyurtma». */
  context?: string;
  /** Ramka ostidagi yo'riqnoma (sukut: «QR kodni ramka ichiga olib keling»). */
  hint?: string;
  /** Yon paneldagi qoida (desktop/planshet, maket `.el-alert.el-tone-info`): «Skanerlangan buyurtma darhol qabul qilinadi». */
  note?: { title: string; text?: string };
  /** Yon panel sarlavhasi yonidagi ikonka (sukut `ScanLine`). */
  icon?: LucideIcon;
  /** Hisoblagich: «3 / 6» yoki «3 ta»; `label` — yonidagi matn (sukut «ta skanerlandi»). */
  progress?: { done: number; total?: number; label?: string };
  /** Hisoblagich qatori: «Qabul qilindi 3 · Qoldi 3 · Topilmadi 1». */
  stats?: ReadonlyArray<ScanTargetStat>;
  /** Kameradan chiqmasdan kontekstni almashtirish (market …). */
  switcher?: ScanTargetSwitcher;
  onScan: (raw: string, source: ScanSource) => void | Promise<void>;
  /** Kamera ichidagi rejim segmenti (2-bosqich, masalan «Bekor / Ertaga»). */
  modes?: ScanTargetMode[];
  mode?: string;
  onModeChange?: (value: string) => void;
  /** Skanerlanganlar (yangisi birinchi). «Ro'yxat» va oxirgi skan qatori shundan. */
  list?: ReadonlyArray<ScanTargetListItem>;
  /** Ro'yxat sarlavhasi (sukut «Skanerlanganlar»). */
  listTitle?: string;
  /** Asosiy amal («Tugatish»). Berilmasa — «Yopish». */
  finish?: { label: string; onFinish: () => void };
}

type Entry = {
  key: number;
  /** Eng oxirgi berilgan maqsad (funksiyalar shu orqali chaqiriladi). */
  latest: ScanTarget;
  /** Tashqariga beriladigan barqaror ko'rinish: funksiyalar `latest` ga yo'naltiradi. */
  view: ScanTarget;
};

let stack: Entry[] = [];
let nextKey = 1;
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const sameSwitcher = (a: ScanTargetSwitcher | undefined, b: ScanTargetSwitcher | undefined) => {
  if (!a || !b) return a === b;
  if (a.label !== b.label || a.value !== b.value || a.title !== b.title) return false;
  // Yuklovchi funksiya har renderda yangi bo'lishi mumkin — u `latest` orqali chaqiriladi, teng hisoblanadi.
  if (typeof a.options === "function" || typeof b.options === "function") {
    return typeof a.options === typeof b.options;
  }
  return (
    a.options.length === b.options.length &&
    a.options.every((option, index) => {
      const other = (b.options as ReadonlyArray<ScanTargetSwitcherOption>)[index];
      return option.value === other.value && option.label === other.label && option.meta === other.meta;
    })
  );
};

/** Funksiyasiz «ma'lumot» qismi teng bo'lsa — ko'rinish yangilanmaydi (har render yangi obyekt keladi). */
const sameData = (a: ScanTarget, b: ScanTarget) =>
  a.id === b.id &&
  (a.layer ?? "page") === (b.layer ?? "page") &&
  a.title === b.title &&
  a.context === b.context &&
  a.hint === b.hint &&
  a.icon === b.icon &&
  a.note?.title === b.note?.title &&
  a.note?.text === b.note?.text &&
  a.progress?.done === b.progress?.done &&
  a.progress?.total === b.progress?.total &&
  a.progress?.label === b.progress?.label &&
  a.mode === b.mode &&
  Boolean(a.onModeChange) === Boolean(b.onModeChange) &&
  a.listTitle === b.listTitle &&
  sameSwitcher(a.switcher, b.switcher) &&
  (a.stats ?? []).length === (b.stats ?? []).length &&
  (a.stats ?? []).every((stat, index) => {
    const other = b.stats?.[index];
    return other !== undefined && stat.key === other.key && stat.label === other.label && stat.value === other.value && stat.tone === other.tone;
  }) &&
  a.finish?.label === b.finish?.label &&
  Boolean(a.finish) === Boolean(b.finish) &&
  (a.modes ?? []).length === (b.modes ?? []).length &&
  (a.modes ?? []).every((mode, index) => mode.value === b.modes?.[index]?.value && mode.label === b.modes?.[index]?.label) &&
  (a.list ?? []).length === (b.list ?? []).length &&
  (a.list ?? []).every((item, index) => {
    const other = b.list?.[index];
    return (
      other !== undefined &&
      item.key === other.key &&
      item.title === other.title &&
      item.subtitle === other.subtitle &&
      item.tone === other.tone &&
      Boolean(item.onUndo) === Boolean(other.onUndo)
    );
  });

const buildView = (entry: Entry): ScanTarget => {
  const target = entry.latest;
  return {
    ...target,
    onScan: (raw, source) => entry.latest.onScan(raw, source),
    onModeChange: target.onModeChange ? (value) => entry.latest.onModeChange?.(value) : undefined,
    finish: target.finish ? { label: target.finish.label, onFinish: () => entry.latest.finish?.onFinish() } : undefined,
    switcher: target.switcher
      ? {
          ...target.switcher,
          options:
            typeof target.switcher.options === "function"
              ? () => {
                  const options = entry.latest.switcher?.options;
                  return typeof options === "function" ? options() : Promise.resolve(options ?? []);
                }
              : target.switcher.options,
          onSelect: (value) => entry.latest.switcher?.onSelect(value),
        }
      : undefined,
    list: target.list?.map((item) => ({
      ...item,
      onUndo: item.onUndo ? () => entry.latest.list?.find((current) => current.key === item.key)?.onUndo?.() : undefined,
    })),
  };
};

/** Maqsadni stack tepasiga qo'yadi; qaytgan kalit bilan `updateScanTarget` / `unregisterScanTarget`. */
export const registerScanTarget = (target: ScanTarget): number => {
  const entry: Entry = { key: nextKey++, latest: target, view: target };
  entry.view = buildView(entry);
  stack = [...stack, entry];
  emit();
  return entry.key;
};

export const updateScanTarget = (key: number, target: ScanTarget) => {
  const entry = stack.find((item) => item.key === key);
  if (!entry) return;
  const changed = !sameData(entry.latest, target);
  entry.latest = target;
  if (!changed) return;
  entry.view = buildView(entry);
  stack = [...stack];
  emit();
};

export const unregisterScanTarget = (key: number) => {
  const next = stack.filter((item) => item.key !== key);
  if (next.length === stack.length) return;
  stack = next;
  emit();
};

const LAYER_RANK: Record<ScanTargetLayer, number> = { page: 0, dialog: 1 };
const rankOf = (entry: Entry) => LAYER_RANK[entry.view.layer ?? "page"];

/** Faol maqsad (eng yuqori qatlamning oxirgisi) yoki `null`. React'dan tashqarida ham (`openScanner`). */
export const getActiveScanTarget = (): ScanTarget | null => {
  let top: Entry | undefined;
  for (const entry of stack) if (!top || rankOf(entry) >= rankOf(top)) top = entry;
  return top?.view ?? null;
};

/** Faqat testlar uchun: reyestrni tozalaydi. */
export const resetScanTargets = () => {
  stack = [];
  emit();
};

/**
 * Sahifa/oyna skan maqsadini ro'yxatdan o'tkazadi: mount → stack'ka qo'shiladi, unmount (yoki `null`) → olinadi.
 * Maqsad har renderda yangi obyekt bo'lishi mumkin — u ref orqali yangilanadi (qayta ro'yxat emas, stack tartibi
 * saqlanadi); ko'rinish faqat matn/hisoblagich/ro'yxat o'zgarganda yangilanadi.
 */
export const useScanTarget = (target: ScanTarget | null): void => {
  const keyRef = useRef<number | null>(null);
  const targetRef = useRef(target);
  const enabled = target !== null;

  // Tartib muhim: avval eng oxirgi maqsad ref'ga yoziladi, keyin (kerak bo'lsa) ro'yxatdan o'tkaziladi.
  useLayoutEffect(() => {
    targetRef.current = target;
    if (keyRef.current !== null && target) updateScanTarget(keyRef.current, target);
  });

  useLayoutEffect(() => {
    if (!enabled || !targetRef.current) return undefined;
    const key = registerScanTarget(targetRef.current);
    keyRef.current = key;
    return () => {
      keyRef.current = null;
      unregisterScanTarget(key);
    };
  }, [enabled]);
};

/** Faol (stack tepasidagi) skan maqsadi; yo'q bo'lsa `null`. */
export const useActiveScanTarget = (): ScanTarget | null =>
  useSyncExternalStore(subscribe, getActiveScanTarget, getActiveScanTarget);

export const subscribeScanTargets = subscribe;
