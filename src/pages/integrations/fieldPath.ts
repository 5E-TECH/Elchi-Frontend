/**
 * ICHMA-ICH MAYDON KALITLARI — `dispatch_config.endpoint` kabi.
 *
 * NEGA KERAK BO'LDI. Turlarni farqlaydigan konfiguratsiya backendda ICHMA-ICH
 * JSON: `dispatch_config` = { endpoint, method, body_template, response_paths }.
 * Forma registri esa tekis kalitlar bilan ishlardi, ya'ni bu maydonlarni
 * so'rashning yo'li yo'q edi.
 *
 * Yechim: registrda nuqtali kalit (`dispatch_config.endpoint`), saqlashda esa
 * ichma-ich obyekt yig'iladi.
 *
 * ⚠️ XOM JSON MAYDONI EMAS va bu ataylab: operator `{ "endpoint": "/v1" }`
 * yozishi shart bo'lmasligi kerak. Bitta qavs xatosi butun sozlamani buzardi
 * va xato faqat posilka jo'natilganda chiqardi.
 */

/** `a.b.c` yo'li bo'yicha qiymatni o'qiydi. */
export const getPath = (obj: unknown, path: string): unknown => {
  if (!path.includes('.')) {
    return (obj as Record<string, unknown> | null)?.[path];
  }
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) => (acc as Record<string, unknown> | null)?.[key],
      obj,
    );
};

/**
 * `a.b.c` yo'li bo'yicha qiymatni yozadi (yo'lni yo'q bo'lsa yaratadi).
 *
 * ⚠️ MAVJUD QIYMATLAR SAQLANADI: `dispatch_config.endpoint` yozilganda
 * `dispatch_config.body_template` YO'QOLMASLIGI kerak. Shu bois har
 * darajada nusxa olinadi, ustiga yozilmaydi.
 */
export const setPath = (
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> => {
  if (!path.includes('.')) {
    return { ...target, [path]: value };
  }
  const [head, ...rest] = path.split('.');
  const existing = target[head];
  const branch =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...target, [head]: setPath(branch, rest.join('.'), value) };
};

/**
 * Nuqtali kalitlarni ichma-ich obyektga yig'adi.
 *
 * Kirish:  { 'dispatch_config.endpoint': '/v1', name: 'LDG' }
 * Chiqish: { dispatch_config: { endpoint: '/v1' }, name: 'LDG' }
 */
export const nestPayload = (
  flat: Record<string, unknown>,
): Record<string, unknown> => {
  let out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    out = setPath(out, key, value);
  }
  return out;
};
