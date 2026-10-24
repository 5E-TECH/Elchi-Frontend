import ts from "typescript";
import { describe, expect, it } from "vitest";
import { queryKeys } from "../shared/config/queryKeys";
import { investorMeKeys } from "../entities/investors/api/me";
import { marketOperatorKeys } from "../entities/market-operator/api/useMarketOperators";
import { logistKeys } from "../entities/logist/api/useLogists";
import { integrationKeys } from "../entities/integrations";
import { SMS_KEYS } from "../entities/sms";

/**
 * SO'ROV KALITLARI INVALIDATSIYASI QO'RIQCHISI (Trello SZTZ4HEU «837be6»).
 *
 * Xato sinfi: kesh bitta kalitda (`queryKeys.users` → `["users", …]`), mutatsiya esa boshqasini eskirtiradi
 * (`["user"]`) — ro'yxat 30 s (`staleTime`) eski qoladi va yangi yozuv «yo'qolgan» ko'rinadi.
 *
 * Qoida: so'rov kalitlari fabrikalaridagi har `all` (bo'lim prefiksi), `lists` va `list(…)` (ro'yxat prefiksi) —
 * `all` i yo'q fabrikada har statik kalit — `src` dagi kamida bitta MUTATSIYA kontekstidagi `invalidateQueries` /
 * `refetchQueries` / `resetQueries` chaqiruvi bilan QAMRALADI (chaqiruv kaliti uning prefiksi). «Yangilash» tugmasi
 * yoki real-vaqt effekti qamrov hisoblanmaydi (pastdagi «Chaqiruv mutatsiyadanmi?» bo'limi). Faqat o'qiladigan kalitlar —
 * `READ_ONLY` da, har biri yozma sabab bilan; ro'yxat eskirsa (kalit endi qamralsa) test shuni ham aytadi.
 *
 * Kalit TypeScript AST'dan aniqlanadi: massiv literali (satrlar, fayl/eksport `const` lari, `...spread`), fabrika
 * havolasi (`queryKeys.users.all`, `logistKeys.regions`, `queryKeys.branches.detail(id)` — argument noma'lum
 * bo'lgani uchun faqat undan oldingi qism), `const` massiv nomi va `[A, B].map((queryKey) => …)` qatori.
 * Oxirigacha aniqlanmagan kalit (masalan `[logiCov, x]`) hech narsani qamramaydi — qo'riqchi yumshamaydi.
 */

type KeyPart = string | number | boolean | null | Record<string, unknown>;
type Key = KeyPart[];

const SENTINEL = Symbol("arg");

/** Fabrika: kod ichidagi nomi (`queryKeys.users`, `logistKeys`) → obyekt. */
const FACTORIES: Record<string, Record<string, unknown>> = {
  ...Object.fromEntries(Object.entries(queryKeys).map(([group, value]) => [`queryKeys.${group}`, value as Record<string, unknown>])),
  investorMeKeys,
  marketOperatorKeys,
  logistKeys,
  integrationKeys,
  SMS_KEYS,
};

/**
 * `src` dagi `export const …Keys = {` / `…_KEYS = {` lardan so'rov kaliti BO'LMAGANLARI (sabab bilan). Yangi
 * so'rov kalitlari fabrikasi `FACTORIES` ga qo'shiladi — aks holda «ro'yxatda yo'q fabrika» testi yiqiladi.
 */
const NON_QUERY_KEY_OBJECTS: Record<string, string> = {
  RETURN_FILTER_KEYS: "URL qidiruv parametrlari nomlari (`?status=`), so'rov keshi emas",
  OLD_MAILS_FILTER_KEYS: "URL qidiruv parametrlari nomlari, so'rov keshi emas",
  ORDER_FILTER_KEYS: "URL qidiruv parametrlari nomlari, so'rov keshi emas",
  PREFERENCE_STORAGE_KEYS: "localStorage kalitlari, so'rov keshi emas",
};

/**
 * Faqat o'qiladigan kalitlar — ilovada ularni o'zgartiradigan mutatsiya YO'Q (ma'lumotni server yoki boshqa tizim
 * yozadi), shuning uchun invalidatsiya talab qilinmaydi. Har yozuvda sabab majburiy.
 */
const READ_ONLY: Record<string, string> = {
  "queryKeys.activityLogs.all":
    "Amallar jurnali — faqat o'qiladi; yozuvlarni backend har amalda o'zi qo'shadi, ilovada jurnalni o'zgartiruvchi mutatsiya yo'q.",
  "queryKeys.activityLogs.list":
    "Amallar jurnali ro'yxati — faqat o'qiladi (yuqoridagi sabab); filtr/sahifa almashganda yangi kalit bilan so'raladi.",
  "SMS_KEYS.tariffs": "SMS tariflari — faqat o'qiladi (provayder narxlari), ilovada o'zgartiruvchi mutatsiya yo'q.",
  "queryKeys.deliveryPricing.all":
    "Yetkazish narxi — hozircha faqat o'qiladi (mahsulot formasidagi taxmin va sozlama, 6FLyjO6j); tarif va qoidalarni o'zgartiruvchi mutatsiyalar «Yetkazish tariflari» sahifasi (47WFHzlx) bilan keladi.",
};

// ── Manba fayllar ──────────────────────────────────────────────────────────────────────────────────────────

const sources = import.meta.glob(["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}", "!../test/**"], {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const parsed = Object.entries(sources).map(([path, text]) => ({
  path: path.replace(/^\.\.\//, "src/"),
  source: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS),
}));

const unwrap = (node: ts.Expression): ts.Expression => {
  let current = node;
  while (ts.isAsExpression(current) || ts.isParenthesizedExpression(current) || ts.isSatisfiesExpression(current)) {
    current = current.expression;
  }
  return current;
};

/** Fayldagi `const NAME = <init>` lari (yuqori darajadagi va ichki — nom bo'yicha birinchisi). */
const localConsts = (source: ts.SourceFile) => {
  const map = new Map<string, ts.Expression>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const list = node.parent;
      if (ts.isVariableDeclarationList(list) && list.flags & ts.NodeFlags.Const && !map.has(node.name.text)) {
        map.set(node.name.text, node.initializer);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return map;
};

const localsByFile = new Map(parsed.map(({ path, source }) => [path, localConsts(source)]));

/** Eksport qilingan `const` lar: nom → [fayl, init]. Bir nechta faylda bir xil nom bo'lsa — noaniq (aniqlanmaydi). */
const exportedConsts = new Map<string, Array<{ path: string; init: ts.Expression }>>();
for (const { path, source } of parsed) {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const list = exportedConsts.get(declaration.name.text) ?? [];
      list.push({ path, init: declaration.initializer });
      exportedConsts.set(declaration.name.text, list);
    }
  }
}

/** Fabrika havolasi (`queryKeys.users.all`, `logistKeys.regions`) → qiymat; `(…)` chaqiruvi — sentinel bilan. */
const resolveFactoryRef = (node: ts.Expression): unknown => {
  const target = ts.isCallExpression(node) ? unwrap(node.expression) : node;
  if (!ts.isPropertyAccessExpression(target)) return undefined;
  const owner = target.expression.getText();
  const factory = FACTORIES[owner];
  if (!factory || !(target.name.text in factory)) return undefined;
  const value = factory[target.name.text];
  if (ts.isCallExpression(node)) {
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown)(...node.arguments.map(() => SENTINEL)) : undefined;
  }
  return typeof value === "function" ? undefined : value;
};

type Resolved = { key: Key; complete: boolean };

const fromRuntime = (value: unknown): Resolved | undefined => {
  if (!Array.isArray(value)) return undefined;
  const index = value.findIndex((part) => part === SENTINEL);
  return index === -1 ? { key: value as Key, complete: true } : { key: value.slice(0, index) as Key, complete: false };
};

/** Identifikator → fayl ichidagi yoki yagona eksport `const` ning ifodasi. */
const resolveIdentifier = (name: string, path: string): { init: ts.Expression; path: string } | undefined => {
  const local = localsByFile.get(path)?.get(name);
  if (local) return { init: local, path };
  const exported = exportedConsts.get(name);
  return exported && exported.length === 1 ? exported[0] : undefined;
};

/** Ifoda → bitta yoki bir nechta kalit (massiv literali, fabrika, `const`, shartli ifoda). */
const resolveKeys = (expression: ts.Expression, path: string, depth = 0): Resolved[] => {
  if (depth > 6) return [];
  const node = unwrap(expression);

  if (ts.isConditionalExpression(node)) {
    return [...resolveKeys(node.whenTrue, path, depth + 1), ...resolveKeys(node.whenFalse, path, depth + 1)];
  }

  const factoryValue = fromRuntime(resolveFactoryRef(node));
  if (factoryValue) return [factoryValue];

  if (ts.isIdentifier(node)) {
    const found = resolveIdentifier(node.text, path);
    return found ? resolveKeys(found.init, found.path, depth + 1) : [];
  }

  if (ts.isArrayLiteralExpression(node)) {
    const key: Key = [];
    for (const element of node.elements) {
      if (ts.isSpreadElement(element)) {
        const spread = resolveKeys(element.expression, path, depth + 1);
        if (spread.length !== 1) return [{ key, complete: false }];
        key.push(...spread[0].key);
        if (!spread[0].complete) return [{ key, complete: false }];
        continue;
      }
      const part = resolvePart(element, path, depth + 1);
      if (part === undefined) return [{ key, complete: false }];
      key.push(part);
    }
    return [{ key, complete: true }];
  }

  return [];
};

const resolvePart = (expression: ts.Expression, path: string, depth: number): KeyPart | undefined => {
  const node = unwrap(expression);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isIdentifier(node) && depth < 6) {
    const found = resolveIdentifier(node.text, path);
    return found ? resolvePart(found.init, found.path, depth + 1) : undefined;
  }
  return undefined;
};

/** `[A, B, ...C].map((queryKey) => …)` — `queryKey` parametri ro'yxatning har elementi. */
const resolveIterated = (identifier: ts.Identifier, path: string): Resolved[] | undefined => {
  let fn: ts.Node | undefined = identifier.parent;
  while (fn && !ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) fn = fn.parent;
  if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return undefined;
  const param = fn.parameters.find((p) => ts.isIdentifier(p.name) && p.name.text === identifier.text);
  if (!param) return undefined;
  const call = fn.parent;
  if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression)) return undefined;
  if (!["map", "forEach"].includes(call.expression.name.text)) return undefined;
  const list = unwrap(call.expression.expression);
  const elements: Resolved[] = [];
  const collect = (expression: ts.Expression, depth = 0): void => {
    const node = unwrap(expression);
    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) {
        if (ts.isSpreadElement(element)) collect(element.expression, depth + 1);
        else elements.push(...resolveKeys(element, path));
      }
    } else if (ts.isIdentifier(node) && depth < 4) {
      const found = resolveIdentifier(node.text, path);
      if (found) collect(found.init, depth + 1);
    }
  };
  collect(list);
  return elements;
};

const INVALIDATING_CALLS = new Set(["invalidateQueries", "refetchQueries", "resetQueries"]);

// ── Chaqiruv mutatsiyadanmi? ───────────────────────────────────────────────────────────────────────────────
//
// Qamrov faqat MUTATSIYA invalidatsiyasidan hisoblanadi — «Yangilash» tugmasi yoki effekt ichidagi `refetchQueries`
// kalitni «yozuvdan keyin yangilanadi» qilmaydi. Mutatsiya konteksti:
//   1) `useMutation` parametrlari — `onSuccess` / `onSettled` / `onMutate` / `onError` xususiyati ichida;
//   2) eng yaqin ishlovchi funksiya (`then`/`map`/`Promise.all` ichki strelkalaridan yuqoriroq) o'zi yozadi —
//      `.mutate(` / `.mutateAsync(` yoki `api.post|put|patch|delete(` chaqiradi;
//   3) nomli yordamchi (`const refreshX = () => …invalidateQueries…`) — 1) yoki 2) kontekstda nomi bilan chaqirilsa
//      (zanjir bo'ylab, fiksatsiya nuqtasigacha).

const MUTATION_HOOK_PROPS = new Set(["onSuccess", "onSettled", "onMutate", "onError"]);
const WRITES = /\.(?:mutate|mutateAsync)\(|\bapi\s*\.\s*(?:post|put|patch|delete)\s*[<(]/;
const INNER_CALLS = new Set(["then", "catch", "finally", "map", "forEach", "all", "allSettled"]);

const isFunctionLike = (node: ts.Node): node is ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration | ts.MethodDeclaration =>
  ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node);

const propertyName = (node: ts.Node) =>
  (ts.isPropertyAssignment(node) || ts.isMethodDeclaration(node) || ts.isShorthandPropertyAssignment(node)) && ts.isIdentifier(node.name)
    ? node.name.text
    : undefined;

/** Ishlovchi funksiya: ichki `then`/`map`/`Promise.all` strelkalaridan o'tib, birinchi «haqiqiy» funksiya. */
const handlerOf = (node: ts.Node): ts.Node | undefined => {
  let fn: ts.Node | undefined = node.parent;
  while (fn && !isFunctionLike(fn)) fn = fn.parent;
  while (fn) {
    const call: ts.Node | undefined = fn.parent;
    const callee = call && ts.isCallExpression(call) ? call.expression : undefined;
    const name = callee && ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined;
    if (!name || !INNER_CALLS.has(name)) return fn;
    let up: ts.Node | undefined = call.parent;
    while (up && !isFunctionLike(up)) up = up.parent;
    if (!up) return fn;
    fn = up;
  }
  return fn;
};

/** Nomli yordamchi: chaqiruv joylashgan `const NAME = (…) => …` / `function NAME` nomi. */
const helperNameOf = (node: ts.Node): string | undefined => {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
    if (isFunctionLike(n) && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) return n.parent.name.text;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isCallExpression(unwrap(n.initializer))) {
      return n.name.text; // `const refresh = useCallback(() => …)`
    }
  }
  return undefined;
};

/** Tugun mutatsiya kontekstidami (1–2-band); `helpers` — mutatsiyaga bog'langan yordamchi nomlari (3-band). */
const inMutationContext = (node: ts.Node, helpers: Set<string>) => {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    const name = propertyName(n);
    if (name && MUTATION_HOOK_PROPS.has(name)) return true;
  }
  const handler = handlerOf(node);
  if (handler && WRITES.test(handler.getText())) return true;
  const helper = helperNameOf(node);
  return helper !== undefined && helpers.has(helper);
};

/** Yordamchi nomlari (fayl ichida yoki eksport) — ular mutatsiya kontekstida chaqiriladimi (fiksatsiya nuqtasigacha). */
const mutationHelpers = (() => {
  const helpers = new Set<string>();
  const calls: Array<{ name: string; node: ts.CallExpression }> = [];
  for (const { source } of parsed) {
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) calls.push({ name: node.expression.text, node });
      // `onSuccess: refreshX` — chaqiruvsiz havola ham.
      if ((ts.isPropertyAssignment(node) && MUTATION_HOOK_PROPS.has(propertyName(node) ?? "")) && ts.isIdentifier(unwrap(node.initializer))) {
        helpers.add((unwrap(node.initializer) as ts.Identifier).text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (let changed = true; changed; ) {
    changed = false;
    for (const { name, node } of calls) {
      if (helpers.has(name)) continue;
      if (inMutationContext(node, helpers)) {
        helpers.add(name);
        changed = true;
      }
    }
  }
  return helpers;
})();

/** `src` dagi barcha invalidatsiya chaqiruvlari kalitlari. */
const invalidatedKeys = (() => {
  const result: Array<Resolved & { at: string; mutation: boolean }> = [];
  for (const { path, source } of parsed) {
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        INVALIDATING_CALLS.has(node.expression.name.text) &&
        node.arguments.length > 0
      ) {
        const arg = unwrap(node.arguments[0]);
        const at = `${path}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
        let keyExpression: ts.Expression | undefined;
        if (ts.isObjectLiteralExpression(arg)) {
          for (const property of arg.properties) {
            if (ts.isPropertyAssignment(property) && property.name.getText() === "queryKey") keyExpression = property.initializer;
            if (ts.isShorthandPropertyAssignment(property) && property.name.text === "queryKey") keyExpression = property.name;
          }
        } else {
          keyExpression = arg;
        }
        if (keyExpression) {
          const target = unwrap(keyExpression);
          const iterated = ts.isIdentifier(target) ? resolveIterated(target, path) : undefined;
          const mutation = inMutationContext(node, mutationHelpers);
          for (const resolved of iterated ?? resolveKeys(target, path)) result.push({ ...resolved, at, mutation });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return result;
})();

// ── Nomzod kalitlar ────────────────────────────────────────────────────────────────────────────────────────

const candidates = (() => {
  const list: Array<{ id: string; key: Key }> = [];
  for (const [name, factory] of Object.entries(FACTORIES)) {
    const hasAll = Array.isArray(factory.all);
    for (const [member, value] of Object.entries(factory)) {
      if (Array.isArray(value)) {
        if (member === "all" || member === "lists" || !hasAll) list.push({ id: `${name}.${member}`, key: value as Key });
      } else if (typeof value === "function" && member === "list") {
        const resolved = fromRuntime((value as (...args: unknown[]) => unknown)(...Array.from({ length: Math.max(1, value.length) }, () => SENTINEL)));
        if (resolved) list.push({ id: `${name}.${member}`, key: resolved.key });
      }
    }
  }
  return list;
})();

const samePart = (a: KeyPart, b: KeyPart) => JSON.stringify(a) === JSON.stringify(b);
/** `prefix` kaliti `key` ni qamraydi (TanStack Query prefiks mosligi). */
const covers = (prefix: Key, key: Key) => prefix.length <= key.length && prefix.every((part, index) => samePart(part, key[index]));

const coveredBy = (key: Key) =>
  invalidatedKeys.filter((entry) => entry.mutation && entry.complete && entry.key.length > 0 && covers(entry.key, key));

describe("so'rov kalitlari fabrikalari ↔ invalidatsiya (SZTZ4HEU 837be6)", () => {
  it("AST tahlilchisi ishlaydi: ma'lum chaqiruvlar aniqlanadi (o'z-o'zini tekshirish)", () => {
    const keys = invalidatedKeys.filter((entry) => entry.complete).map((entry) => JSON.stringify(entry.key));
    // fabrika havolasi, fabrika chaqiruvi (argumentgacha), `[A, ...B].map((queryKey) => …)`, `const` massiv.
    expect(keys).toContain(JSON.stringify(["users"]));
    expect(keys).toContain(JSON.stringify(["regions"]));
    expect(keys).toContain(JSON.stringify(["region-logists"]));
    expect(keys).toContain(JSON.stringify(["finance-cov"]));
    expect(candidates.length).toBeGreaterThan(15);
  });

  it("har `all` / ro'yxat kaliti kamida bitta mutatsiya invalidatsiyasi bilan qamralgan (yoki READ_ONLY da sabab bilan)", () => {
    const uncovered = candidates
      .filter(({ id, key }) => !(id in READ_ONLY) && coveredBy(key).length === 0)
      .map(({ id, key }) => `${id} ${JSON.stringify(key)}`);
    expect(uncovered).toEqual([]);
  });

  it("READ_ONLY ro'yxati eskirmagan: har yozuv mavjud nomzod, hali qamralmagan va sababi yozilgan", () => {
    const ids = new Set(candidates.map(({ id }) => id));
    for (const [id, reason] of Object.entries(READ_ONLY)) {
      expect(ids.has(id), `${id} — fabrikada bunday kalit yo'q`).toBe(true);
      const candidate = candidates.find((entry) => entry.id === id)!;
      expect(coveredBy(candidate.key).map((entry) => entry.at), `${id} endi invalidatsiya qilinadi — READ_ONLY dan olib tashlang`).toEqual([]);
      expect(reason.length).toBeGreaterThan(30);
    }
  });

  it("faqat mutatsiya chaqiruvi qamraydi: «Yangilash» tugmasi hisoblanmaydi, onSuccess va yordamchi orqali — hisoblanadi", () => {
    const site = (file: string, key: unknown[]) =>
      invalidatedKeys.filter((entry) => entry.at.startsWith(`${file}:`) && JSON.stringify(entry.key) === JSON.stringify(key));
    // «Umumiy holat → Yangilash» (`useCallback` ichida, yozuv yo'q) — mutatsiya emas.
    const refresh = site("src/pages/integrations/ConnectionsPage.tsx", integrationKeys.all as unknown as unknown[]);
    expect(refresh.length).toBeGreaterThan(0);
    expect(refresh.every((entry) => !entry.mutation)).toBe(true);
    // `invalidateUserLists` — `onSuccess: invalidateUserLists` orqali bog'langan yordamchi.
    const users = site("src/entities/user/api/userApi.ts", queryKeys.users.all as unknown as unknown[]);
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((entry) => entry.mutation)).toBe(true);
    // Mutatsiyadan tashqari chaqiruvlar mavjud — tasnif hammasini «mutatsiya» deb belgilamaydi.
    expect(invalidatedKeys.filter((entry) => !entry.mutation).length).toBeGreaterThan(3);
  });

  it("queryKeys.users — foydalanuvchi mutatsiyalari (`entities/user/api/userApi.ts`) ham uni eskirtiradi", () => {
    const sites = coveredBy(queryKeys.users.all as unknown as Key).map((entry) => entry.at.replace(/:\d+$/, ""));
    expect(sites).toContain("src/entities/user/api/userApi.ts");
  });

  it("src dagi har so'rov kalitlari fabrikasi shu testda ro'yxatga olingan", () => {
    const declared = new Set<string>();
    for (const [path, text] of Object.entries(sources)) {
      if (path.includes("/test/")) continue;
      for (const match of text.matchAll(/export const (\w+(?:Keys|_KEYS)) = \{/g)) declared.add(match[1]);
    }
    const known = new Set([...Object.keys(FACTORIES).filter((name) => !name.startsWith("queryKeys.")), "queryKeys", ...Object.keys(NON_QUERY_KEY_OBJECTS)]);
    expect([...declared].filter((name) => !known.has(name)).sort()).toEqual([]);
    expect([...known].filter((name) => !declared.has(name)).sort()).toEqual([]);
  });
});
