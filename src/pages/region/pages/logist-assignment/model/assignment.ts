import { shortRegionName } from "../../../../../entities/region";
import type { Logist, LogistRegion } from "../../../../../entities/logist";

/**
 * Viloyat kartasining 6 holati (maket `*-regions-logist-assignment`):
 *   free      — belgisiz, logist yo'q («Logist yo'q»);
 *   other     — belgisiz, boshqa logistda (uning ismi);
 *   assigned  — belgili, shu logistda («Biriktirilgan»);
 *   adding    — belgili, hozir logist yo'q → «Qo'shiladi» (info);
 *   transfer  — belgili, hozir boshqa logistda → «O'tkaziladi» (warning);
 *   removing  — belgisi olindi, shu logistda edi → «Olib tashlanadi» (danger), «Logistsiz qoladi».
 */
export type RegionCardKind = "free" | "other" | "assigned" | "adding" | "transfer" | "removing";

export const regionCardKind = (
  region: LogistRegion,
  logistId: string,
  checked: boolean,
): RegionCardKind => {
  const current = region.logistId;
  if (checked) {
    if (current === logistId) return "assigned";
    return current ? "transfer" : "adding";
  }
  if (current === logistId) return "removing";
  return current ? "other" : "free";
};

/** Viloyatlar tartibi (maket): Toshkent shahri, Toshkent viloyati, qolganlari alifbo bo'yicha. */
export const sortRegions = (regions: readonly LogistRegion[]): LogistRegion[] => {
  const rank = (name: string) => {
    const short = shortRegionName(name);
    return short === "Toshkent sh." ? 0 : short === "Toshkent vil." ? 1 : 2;
  };
  return [...regions].sort(
    (a, b) =>
      rank(a.name) - rank(b.name) ||
      shortRegionName(a.name).localeCompare(shortRegionName(b.name), "uz"),
  );
};

/** Logistlar tartibi: faollari avval, so'ng ism bo'yicha (maket: nofaol — oxirida). */
export const sortLogists = (logists: readonly Logist[]): Logist[] =>
  [...logists].sort(
    (a, b) =>
      Number(a.status === "inactive") - Number(b.status === "inactive") ||
      a.name.localeCompare(b.name, "uz"),
  );

/** Logistga hozir (serverda) biriktirilgan viloyatlar. */
export const assignedRegionIds = (
  regions: readonly LogistRegion[],
  logistId: string,
): Set<string> =>
  new Set(regions.filter((region) => region.logistId === logistId).map((region) => region.id));

/** Har logistdagi viloyatlar soni (ro'yxatdagi «4 viloyat» belgisi — server holati). */
export const regionCountByLogist = (regions: readonly LogistRegion[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const region of regions) {
    if (region.logistId) counts.set(region.logistId, (counts.get(region.logistId) ?? 0) + 1);
  }
  return counts;
};

export type AssignmentChange = { region: LogistRegion; kind: "adding" | "transfer" | "removing" };

export type AssignmentDiff = {
  added: AssignmentChange[];
  transferred: AssignmentChange[];
  removed: AssignmentChange[];
  total: number;
};

/** Saqlanmagan o'zgarishlar (viloyatlar sahifadagi tartibda). */
export const diffAssignment = (
  regions: readonly LogistRegion[],
  logistId: string,
  draft: ReadonlySet<string>,
): AssignmentDiff => {
  const added: AssignmentChange[] = [];
  const transferred: AssignmentChange[] = [];
  const removed: AssignmentChange[] = [];
  for (const region of regions) {
    const kind = regionCardKind(region, logistId, draft.has(region.id));
    if (kind === "adding") added.push({ region, kind });
    else if (kind === "transfer") transferred.push({ region, kind });
    else if (kind === "removing") removed.push({ region, kind });
  }
  return { added, transferred, removed, total: added.length + transferred.length + removed.length };
};

/** Faqat qo'shish — darhol saqlanadi; olib tashlash yoki o'tkazish bo'lsa — avval tasdiq oynasi. */
export const needsConfirmation = (diff: AssignmentDiff): boolean =>
  diff.removed.length > 0 || diff.transferred.length > 0;

export type RegionFilter = "all" | "checked" | "free";

/** Filtr: «Barchasi» · «Belgilangan» (joriy belgilar) · «Logistsiz» (serverda logisti yo'q). */
export const filterRegions = (
  regions: readonly LogistRegion[],
  filter: RegionFilter,
  draft: ReadonlySet<string>,
): LogistRegion[] => {
  if (filter === "checked") return regions.filter((region) => draft.has(region.id));
  if (filter === "free") return regions.filter((region) => !region.logistId);
  return [...regions];
};

/** Qidiruv: ism yoki telefon (raqamlar formatidan qat'i nazar). */
export const matchesLogist = (logist: Logist, query: string): boolean => {
  const text = query.trim().toLocaleLowerCase();
  if (!text) return true;
  if (logist.name.toLocaleLowerCase().includes(text)) return true;
  const digits = text.replace(/\D/g, "");
  return digits.length > 0 && logist.phone_number.replace(/\D/g, "").includes(digits);
};

/** Bosh harflar (maket `.el-avatar`: «AR»): ikki so'zning birinchi harflari, bitta so'z — ikki harf. */
export const logistInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toLocaleUpperCase();
  return (parts[0]?.slice(0, 2) ?? "").toLocaleUpperCase();
};

/** `?logist=<id>` dagi logist, bo'lmasa ro'yxatdagi birinchisi (faollari avval). */
export const resolveSelectedLogist = (
  logists: readonly Logist[],
  requestedId: string | null,
): Logist | null =>
  (requestedId ? logists.find((logist) => logist.id === requestedId) : undefined) ??
  logists[0] ??
  null;
