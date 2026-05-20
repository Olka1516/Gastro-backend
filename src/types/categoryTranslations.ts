import {
  MENU_LANG_CODES,
  MENU_PRIMARY_LANG,
  MenuLangCode,
} from "./menuLang";

export const CATEGORY_LANG_CODES = MENU_LANG_CODES;

export type CategoryLangCode = MenuLangCode;

export const CATEGORY_PRIMARY_LANG = MENU_PRIMARY_LANG;

export type CategoryTranslationEntry = { name: string };

export type CategoryTranslations = Partial<
  Record<CategoryLangCode, CategoryTranslationEntry>
>;
