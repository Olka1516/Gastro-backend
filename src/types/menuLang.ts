export const MENU_LANG_CODES = [
  "uk",
  "en",
  "pl",
  "de",
  "fr",
  "es",
  "it",
  "cs",
  "ro",
  "tr",
  "pt",
  "zh",
] as const;

export type MenuLangCode = (typeof MENU_LANG_CODES)[number];

export const MENU_PRIMARY_LANG: MenuLangCode = "uk";

/** Legacy code stored before pt replaced ar in the editor. */
export const LEGACY_MENU_LANG_AR = "ar";
