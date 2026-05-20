import { MENU_LANG_CODES, MENU_PRIMARY_LANG, MenuLangCode } from "./menuLang";

export const DISH_LANG_CODES = MENU_LANG_CODES;

export type DishLangCode = MenuLangCode;

export const DISH_PRIMARY_LANG = MENU_PRIMARY_LANG;

export type DishTranslationEntry = {
  name: string;
  description?: string;
};

export type DishTranslations = Partial<
  Record<DishLangCode, DishTranslationEntry>
>;
