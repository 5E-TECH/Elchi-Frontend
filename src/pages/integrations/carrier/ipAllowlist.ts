/**
 * IP RO'YXATINI QATORMA-QATOR TEKSHIRISH — Carrier API akkaunti (maket `*-carrier-create-dialog`,
 * `*-carrier-edit-dialog`: «Har qatorga bitta», har qator ostida natija).
 *
 * Qoidalar backend bilan BIR XIL (`libs/common/src/security/ip-allowlist-rule.ts` → `canonicalIpAllowlistRule`):
 *  - IPv4 (`203.0.113.10`), IPv4 diapazon (`203.0.113.0/24`, 0–32) — faqat haqiqiy TARMOQ manzili
 *    (`203.0.113.7/16` rad: `203.0.0.0/16` deb yozilsin);
 *  - IPv6 aniq manzil — kanonik qisqa shaklda saqlanadi (`2001:0DB8::0001` → `2001:db8::1`);
 *  - IPv4-mapped IPv6 (`::ffff:1.2.3.4`) → IPv4; eskirgan IPv4-compatible (`::1.2.3.4`) — rad;
 *  - IPv6 diapazon — rad (gateway moslovchisi qo'llamaydi);
 *  - qoida 64 belgidan uzun emas; takror bir marta saqlanadi; ko'pi bilan 50 ta.
 * Frontda xato bo'lsa forma yuborilmaydi — server 400 matni operatorga yetib kelmaydigan holat qolmaydi.
 */

export const IP_ALLOWLIST_MAX_ENTRIES = 50;
const MAX_RULE_LENGTH = 64;

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

const isIpv4 = (value: string) => IPV4.test(value);

/** Brauzer URL tahlilchisi — IPv6'ni tekshiradi va kanonik (RFC 5952) shaklga keltiradi; xato — `null`. */
const canonicalIpv6 = (value: string): string | null => {
  if (!value.includes(":") || /[^0-9a-f:.]/.test(value)) return null;
  try {
    return new URL(`http://[${value}]`).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return null;
  }
};

const stripMappedV4 = (value: string) =>
  value.startsWith("::ffff:") && isIpv4(value.slice(7)) ? value.slice(7) : value;

const ipv4ToInt = (value: string) =>
  value.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);

const intToIpv4 = (value: number) =>
  [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".");

/** `::ffff:cb00:710a` → `203.0.113.10`. */
const mappedHexToV4 = (canonical: string): string | null => {
  const match = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(canonical);
  if (!match) return null;
  const hi = parseInt(match[1], 16);
  const lo = parseInt(match[2], 16);
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
};

export type IpRuleError = "invalid" | "hostBits" | "ipv6Range" | "tooLong";

export type IpRuleResult =
  { ok: true; rule: string } | { ok: false; error: IpRuleError; suggestion?: string };

/** Bitta qoida: kanonik shakl yoki rad sababi (`hostBits` da — to'g'ri tarmoq manzili taklifi). */
export const checkIpRule = (raw: string): IpRuleResult => {
  const value = raw.trim().toLowerCase();
  if (!value) return { ok: false, error: "invalid" };
  if (value.length > MAX_RULE_LENGTH) return { ok: false, error: "tooLong" };

  if (value.includes("/")) {
    const parts = value.split("/");
    if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1])) return { ok: false, error: "invalid" };
    const bits = Number(parts[1]);
    const network = stripMappedV4(parts[0]);
    if (!isIpv4(network)) {
      return canonicalIpv6(parts[0])
        ? { ok: false, error: "ipv6Range" }
        : { ok: false, error: "invalid" };
    }
    if (bits > 32) return { ok: false, error: "invalid" };
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    const address = ipv4ToInt(network);
    const aligned = (address & mask) >>> 0;
    if (aligned !== address)
      return { ok: false, error: "hostBits", suggestion: `${intToIpv4(aligned)}/${bits}` };
    return { ok: true, rule: `${network}/${bits}` };
  }

  const ip = stripMappedV4(value);
  if (isIpv4(ip)) return { ok: true, rule: ip };
  const canonical = canonicalIpv6(ip);
  if (!canonical) return { ok: false, error: "invalid" };
  if (canonical.startsWith("::ffff:")) {
    const v4 = mappedHexToV4(canonical);
    return v4 ? { ok: true, rule: v4 } : { ok: false, error: "invalid" };
  }
  // Eskirgan IPv4-compatible (`::203.0.113.10`) — gateway'da hech qachon mos kelmaydi.
  if (/^::[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(canonical)) return { ok: false, error: "invalid" };
  return { ok: true, rule: canonical };
};

export type IpLineCheck = {
  /** Textarea'dagi qator raqami (1 dan; bo'sh qatorlar sanaladi — operator ko'rgan raqam). */
  line: number;
  value: string;
  /** `ok` — o'zgarishsiz · `normalized` — boshqa shaklda saqlanadi · `duplicate` — takror · `error`. */
  kind: "ok" | "normalized" | "duplicate" | "error";
  rule?: string;
  error?: IpRuleError;
  suggestion?: string;
};

export type IpAllowlistCheck = {
  lines: IpLineCheck[];
  /** Yuboriladigan kanonik qoidalar (takrorsiz, kiritilgan tartibda). */
  rules: string[];
  /** Bo'sh bo'lmagan qatorlar soni (maketdagi «4 / 50»). */
  count: number;
  errorCount: number;
  overLimit: boolean;
  /** Yuborish mumkinmi. */
  valid: boolean;
};

export const checkIpAllowlist = (text: string): IpAllowlistCheck => {
  const lines: IpLineCheck[] = [];
  const rules: string[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const value = raw.trim();
    if (!value) return;
    const result = checkIpRule(value);
    if (!result.ok) {
      lines.push({
        line: index + 1,
        value,
        kind: "error",
        error: result.error,
        suggestion: result.suggestion,
      });
      return;
    }
    if (rules.includes(result.rule)) {
      lines.push({ line: index + 1, value, kind: "duplicate", rule: result.rule });
      return;
    }
    rules.push(result.rule);
    lines.push({
      line: index + 1,
      value,
      kind: result.rule === value ? "ok" : "normalized",
      rule: result.rule,
    });
  });
  const errorCount = lines.filter((line) => line.kind === "error").length;
  const overLimit = lines.length > IP_ALLOWLIST_MAX_ENTRIES;
  return {
    lines,
    rules,
    count: lines.length,
    errorCount,
    overLimit,
    valid: errorCount === 0 && !overLimit,
  };
};

/** Saqlangan ro'yxat → textarea matni (har qatorga bitta). */
export const ipAllowlistToText = (rules: readonly string[] | null | undefined) =>
  (rules ?? []).join("\n");
