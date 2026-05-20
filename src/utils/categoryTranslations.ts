import { ICategoryItem } from "@/types/entities";
import { EPlan, EResponseMessage } from "@/types/enums";
import {
  CATEGORY_PRIMARY_LANG,
  CategoryLangCode,
  CategoryTranslationEntry,
  CategoryTranslations,
} from "@/types/categoryTranslations";
import {
  isMenuLangCode,
  migrateArToPt,
  parseJsonField,
} from "@/utils/menuTranslationLang";

export const hasTranslationsInBody = (body: {
  translations?: unknown;
}): boolean => body.translations !== undefined && body.translations !== null;

type ParseTranslationsResult =
  | { ok: true; translations: CategoryTranslations }
  | { ok: false; reason: "invalidShape" | "empty" };

export const parseCategoryTranslations = (
  raw: unknown,
): ParseTranslationsResult => {
  const parsed = parseJsonField(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "invalidShape" };
  }

  const translations: CategoryTranslations = {};

  for (const [lang, entry] of Object.entries(parsed)) {
    if (!isMenuLangCode(lang)) {
      continue;
    }

    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, reason: "invalidShape" };
    }

    const name = (entry as CategoryTranslationEntry).name;
    if (typeof name !== "string") {
      return { ok: false, reason: "invalidShape" };
    }

    const trimmed = name.trim();
    if (trimmed) {
      translations[lang] = { name: trimmed };
    }
  }

  if (Object.keys(translations).length === 0) {
    return { ok: false, reason: "empty" };
  }

  return { ok: true, translations: migrateArToPt(translations) };
};

export const resolveCategoryPrimaryName = (
  name: unknown,
  translations?: CategoryTranslations,
): string | null => {
  const fromPrimary = translations?.[CATEGORY_PRIMARY_LANG]?.name?.trim();
  if (fromPrimary) {
    return fromPrimary;
  }

  if (translations) {
    for (const lang of Object.keys(translations) as CategoryLangCode[]) {
      const value = translations[lang]?.name?.trim();
      if (value) {
        return value;
      }
    }
  }

  if (typeof name === "string") {
    const trimmed = name.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
};

export const ensureCategoryUkName = (
  translations: CategoryTranslations | undefined,
  name: string,
): CategoryTranslations => {
  const migrated = migrateArToPt(translations ?? {});
  return {
    ...migrated,
    [CATEGORY_PRIMARY_LANG]: { name },
  };
};

export const mergeCategoryTranslations = (
  existing: CategoryTranslations | undefined,
  incoming: CategoryTranslations,
): CategoryTranslations => migrateArToPt({
  ...migrateArToPt(existing ?? {}),
  ...incoming,
});

export type CategoryApiItem = {
  id: string;
  name: string;
  translations: CategoryTranslations;
};

export type CategoryWritePayload = {
  name: string;
  translations?: CategoryTranslations;
  persistTranslations: boolean;
};

export type CategoryWriteBuildResult =
  | { ok: true; payload: CategoryWritePayload }
  | { ok: false; status: 403 | 400; message: EResponseMessage };

export const buildCategoryWritePayload = (
  planName: string,
  body: { name?: unknown; translations?: unknown },
): CategoryWriteBuildResult => {
  if (hasTranslationsInBody(body) && planName !== EPlan.premium) {
    return {
      ok: false,
      status: 403,
      message: EResponseMessage.CATEGORY_TRANSLATIONS_PREMIUM_ONLY,
    };
  }

  let translations: CategoryTranslations | undefined;
  let persistTranslations = false;

  if (hasTranslationsInBody(body) && planName === EPlan.premium) {
    const parsed = parseCategoryTranslations(body.translations);
    if (!parsed.ok) {
      if (parsed.reason === "empty") {
        return {
          ok: false,
          status: 400,
          message: EResponseMessage.CATEGORY_NAME_REQUIRED,
        };
      }
      return {
        ok: false,
        status: 400,
        message: EResponseMessage.CATEGORY_TRANSLATIONS_INVALID,
      };
    }
    translations = parsed.translations;
    persistTranslations = true;
  }

  const name = resolveCategoryPrimaryName(body.name, translations);
  if (!name) {
    return {
      ok: false,
      status: 400,
      message: EResponseMessage.CATEGORY_NAME_REQUIRED,
    };
  }

  return {
    ok: true,
    payload: {
      name,
      translations,
      persistTranslations,
    },
  };
};

export const categoryItemToApi = (item: ICategoryItem): CategoryApiItem => {
  const stored = migrateArToPt(item.translations ?? {});
  const translations: CategoryTranslations = { ...stored };

  if (!translations[CATEGORY_PRIMARY_LANG]?.name?.trim()) {
    translations[CATEGORY_PRIMARY_LANG] = { name: item.name };
  }

  return {
    id: item.id,
    name: item.name,
    translations,
  };
};
