#!/usr/bin/env node
/**
 * KESH KALITI ILDIZI QO'RIQCHISI (sUjPxTzJ) — bitta API endpoint faqat bitta queryKey ildizi ostida keshlanadi.
 *
 * Bir endpoint ikki ildizda saqlansa (`["batches", …]` va `["return-batches", …]`), mutatsiya bittasini yangilaydi,
 * ikkinchisi jimgina eski qoladi (partiya qabul qilingach /returns ro'yxati eskirgan edi). Skript `src` dagi har
 * `useQuery` / `queryOptions` / `fetchQuery` … chaqiruvining `queryKey` ildizini (birinchi element, TypeScript turi
 * orqali — `queryKeys.*` va konstantalar ham) va `queryFn` ichidagi `API_ENDPOINTS.*` ni (yordamchi funksiyalar
 * ichiga 3 qavatgacha kirib) yig'adi.
 *
 * `SHARED_ROOTS_RATCHET` — qo'riqchi qo'shilganda bor bo'lgan takrorlar: ro'yxat FAQAT qisqaradi. Yangi takror —
 * xato; ro'yxatdagi takror yo'qolsa (tuzatilsa) — yozuvni olib tashlash shart (xato).
 *
 * CLI: `npm run query-keys:check` (CI'da — `src/test/queryKeyRoots.test.ts`, `npm test`).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const QUERY_CALLS = new Set([
  "useQuery",
  "useInfiniteQuery",
  "useSuspenseQuery",
  "queryOptions",
  "infiniteQueryOptions",
  "fetchQuery",
  "prefetchQuery",
  "ensureQueryData",
  "fetchInfiniteQuery",
  "prefetchInfiniteQuery",
]);
const HELPER_DEPTH = 3;
const ENDPOINT = /^API_ENDPOINTS\.([A-Z_]+)\.([A-Z_0-9]+)$/;

/**
 * Qo'riqchi qo'shilganda (2026-10-25) bor bo'lgan takrorlar — endpoint → ildizlar. Faqat qisqaradi: ildizni
 * birlashtirgan PR yozuvni ham olib tashlaydi. Yangi yozuv qo'shilmaydi.
 */
export const SHARED_ROOTS_RATCHET = {
  "ANALYTICS.KPI": ["kpi", "misc-cov"],
  "BRANCHES.DISPATCH_DESTINATIONS": ["branches", "courier-transfer"],
  "COURIERS.BY_REGION": ["identity-cov", "mails"],
  "DISTRICTS.BASE": ["district-sato", "region-district-catalog"],
  "INTEGRATIONS.RECEIVABLES": ["integ-cov", "integration-settlement"],
  "MANAGERS.BASE": ["identity-cov", "managers"],
  "ORDERS.EXTERNAL": ["incoming-external-orders", "orders"],
  "POSTS.RETURN_REQUESTS_LIST": ["logi-cov", "mails"],
  "REGIONS.BASE": ["region-district-catalog", "region-districts-admin", "regions"],
  "SCAN.BY_TOKEN": ["misc-cov", "scan-detail"],
  "USERS.BASE": ["notification-dispatch", "user", "users"],
  "USERS.BY_ID": ["markets", "user"],
};

const calleeName = (expr) =>
  ts.isIdentifier(expr) ? expr.text : ts.isPropertyAccessExpression(expr) ? expr.name.text : null;

const property = (object, name) =>
  object.properties.find((p) => p.name && ts.isIdentifier(p.name) && p.name.text === name);

const unalias = (checker, symbol) =>
  symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

const unwrap = (expr) => {
  while (ts.isAsExpression(expr) || ts.isParenthesizedExpression(expr) || ts.isSatisfiesExpression(expr)) {
    expr = expr.expression;
  }
  return expr;
};

/** `queryKey` ning birinchi elementi: matn (ildiz) yoki aniqlanmasa `null`. Shartli kalit — ikkala tarmoq ham. */
const keyRoots = (checker, expr) => {
  expr = unwrap(expr);
  if (ts.isConditionalExpression(expr)) {
    return [...keyRoots(checker, expr.whenTrue), ...keyRoots(checker, expr.whenFalse)];
  }
  const root = keyRoot(checker, expr);
  return root === null ? [] : [root];
};

const keyRoot = (checker, expr, depth = 0) => {
  expr = unwrap(expr);
  if (depth > 4) return null;
  if (ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr)) {
    const symbol = unalias(checker, checker.getSymbolAtLocation(ts.isPropertyAccessExpression(expr) ? expr.name : expr));
    const declaration = symbol?.valueDeclaration;
    const initializer =
      declaration && (ts.isVariableDeclaration(declaration) || ts.isPropertyAssignment(declaration))
        ? declaration.initializer
        : undefined;
    if (initializer && ts.isArrayLiteralExpression(unwrap(initializer))) return keyRoot(checker, initializer, depth + 1);
  }
  if (ts.isArrayLiteralExpression(expr)) {
    const [first] = expr.elements;
    if (!first) return null;
    if (ts.isSpreadElement(first)) return keyRoot(checker, first.expression, depth + 1);
    if (ts.isStringLiteralLike(first)) return first.text;
    const type = checker.getTypeAtLocation(first);
    return type.isStringLiteral() ? type.value : null;
  }
  const type = checker.getTypeAtLocation(expr);
  if (checker.isTupleType(type)) {
    const [head] = checker.getTypeArguments(type);
    if (head?.isStringLiteral()) return head.value;
  }
  return null;
};

const functionBody = (declaration) => {
  if (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)) return declaration.body;
  const initializer =
    ts.isVariableDeclaration(declaration) || ts.isPropertyAssignment(declaration) ? declaration.initializer : undefined;
  return initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
    ? initializer.body
    : undefined;
};

/** `queryFn` (va u chaqirgan yordamchilar) ichidagi `API_ENDPOINTS.GURUH.NOM` lar. */
const endpointsIn = (checker, node, depth = 0, seen = new Set()) => {
  const found = new Set();
  const visit = (current) => {
    if (depth < HELPER_DEPTH && ts.isCallExpression(current)) {
      const callee = ts.isPropertyAccessExpression(current.expression) ? current.expression.name : current.expression;
      for (const declaration of unalias(checker, checker.getSymbolAtLocation(callee))?.declarations ?? []) {
        if (seen.has(declaration) || declaration.getSourceFile().isDeclarationFile) continue;
        const body = functionBody(declaration);
        if (!body) continue;
        seen.add(declaration);
        for (const endpoint of endpointsIn(checker, body, depth + 1, seen)) found.add(endpoint);
      }
    }
    if (ts.isPropertyAccessExpression(current)) {
      const match = ENDPOINT.exec(current.getText());
      if (match) found.add(`${match[1]}.${match[2]}`);
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
};

/**
 * `src` ni skanerlaydi: endpoint → (ildiz → joylar). Ildizi aniqlanmagan kalitlar — `unresolved` da.
 * @returns {{ roots: Map<string, Map<string, string[]>>, unresolved: string[] }}
 */
export const scanQueryKeyRoots = (root = ROOT) => {
  const configPath = path.join(root, "tsconfig.app.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const files = parsed.fileNames.filter((file) => !/\.test\.tsx?$|[/\\]src[/\\]test[/\\]/.test(file));
  const program = ts.createProgram(files, { ...parsed.options, noEmit: true });
  const checker = program.getTypeChecker();
  const fileSet = new Set(files.map((file) => path.resolve(file)));

  const roots = new Map();
  const unresolved = [];
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || !fileSet.has(path.resolve(sourceFile.fileName))) continue;
    const visit = (node) => {
      if (ts.isCallExpression(node) && QUERY_CALLS.has(calleeName(node.expression) ?? "")) {
        const [options] = node.arguments;
        const objectLiteral = options && unwrap(options);
        const key = objectLiteral && ts.isObjectLiteralExpression(objectLiteral) && property(objectLiteral, "queryKey");
        const fn = key && property(objectLiteral, "queryFn");
        if (key && fn && ts.isPropertyAssignment(key)) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          const where = `${path.relative(root, sourceFile.fileName).split(path.sep).join("/")}:${line}`;
          const keyRootValues = new Set(keyRoots(checker, key.initializer));
          const endpoints = endpointsIn(checker, fn);
          if (!keyRootValues.size && endpoints.size) unresolved.push(where);
          for (const endpoint of endpoints) {
            if (!roots.has(endpoint)) roots.set(endpoint, new Map());
            const byRoot = roots.get(endpoint);
            for (const keyRootValue of keyRootValues) {
              if (!byRoot.has(keyRootValue)) byRoot.set(keyRootValue, []);
              byRoot.get(keyRootValue).push(where);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return { roots, unresolved };
};

/**
 * Qoidaga solishtirish: `violations` — ro'yxatda yo'q takror yoki ro'yxatdagisiga yangi ildiz qo'shilgan;
 * `stale` — ro'yxatda turgan, lekin endi takror emas (yozuv olib tashlanadi).
 */
export const checkQueryKeyRoots = ({ roots }, ratchet = SHARED_ROOTS_RATCHET) => {
  const violations = [];
  for (const [endpoint, byRoot] of [...roots].sort(([a], [b]) => a.localeCompare(b))) {
    if (byRoot.size < 2) continue;
    const allowed = new Set(ratchet[endpoint] ?? []);
    const extra = [...byRoot.keys()].filter((root) => !allowed.has(root));
    if (extra.length) violations.push({ endpoint, roots: Object.fromEntries(byRoot), extra });
  }
  const stale = Object.keys(ratchet)
    .filter((endpoint) => (roots.get(endpoint)?.size ?? 0) < 2)
    .sort();
  return { violations, stale };
};

export const formatReport = ({ violations, stale }) => {
  const lines = [];
  for (const { endpoint, roots, extra } of violations) {
    lines.push(`✗ ${endpoint} — ${Object.keys(roots).length} ta kesh ildizi ostida (yangi: ${extra.join(", ")}):`);
    for (const [root, places] of Object.entries(roots)) lines.push(`    ${JSON.stringify(root)}: ${places.join(", ")}`);
  }
  if (violations.length) {
    lines.push(
      "  Bitta endpoint — bitta ildiz: kalitni mavjud ildiz ostiga oling (masalan `queryKeys.*`), aks holda mutatsiya",
      "  bittasini yangilaydi, ikkinchisi eski qoladi.",
    );
  }
  for (const endpoint of stale) {
    lines.push(`✗ ${endpoint} — endi bitta ildizda: scripts/query-key-roots.mjs → SHARED_ROOTS_RATCHET dan olib tashlang.`);
  }
  return lines.join("\n");
};

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const scan = scanQueryKeyRoots();
  const result = checkQueryKeyRoots(scan);
  const shared = [...scan.roots.values()].filter((byRoot) => byRoot.size > 1).length;
  if (result.violations.length || result.stale.length) {
    console.error(formatReport(result));
    process.exit(1);
  }
  console.log(
    `OK: ${scan.roots.size} endpoint; ${shared} tasi bir nechta ildizda — barchasi SHARED_ROOTS_RATCHET da (faqat qisqaradi).`,
  );
}
