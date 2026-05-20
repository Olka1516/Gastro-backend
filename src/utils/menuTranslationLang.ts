import {
  LEGACY_MENU_LANG_AR,
  MENU_LANG_CODES,
  MenuLangCode,
} from "@/types/menuLang";

const langCodeSet = new Set<string>(MENU_LANG_CODES);

export const isMenuLangCode = (lang: string): lang is MenuLangCode =>
  langCodeSet.has(lang);

/** Move legacy `ar` entries to `pt` when reading or before persisting. */
export const migrateArToPt = <T extends Record<string, unknown>>(
  translations: T,
): T => {
  const arEntry = translations[LEGACY_MENU_LANG_AR];
  if (arEntry === undefined) {
    return translations;
  }

  const { [LEGACY_MENU_LANG_AR]: _removed, ...rest } = translations;
  const result = { ...rest } as T;

  if (
    result.pt === undefined &&
    arEntry !== null &&
    typeof arEntry === "object" &&
    !Array.isArray(arEntry)
  ) {
    (result as Record<string, unknown>).pt = arEntry;
  }

  return result;
};

export const parseJsonField = (raw: unknown): unknown => {
  if (typeof raw !== "string") {
    return raw;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
};
