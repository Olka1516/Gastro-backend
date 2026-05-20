import { IDish } from "@/types/entities";
import { EPlan, EResponseMessage } from "@/types/enums";
import {
  DISH_PRIMARY_LANG,
  DishLangCode,
  DishTranslationEntry,
  DishTranslations,
} from "@/types/dishTranslations";
import {
  isMenuLangCode,
  migrateArToPt,
  parseJsonField,
} from "@/utils/menuTranslationLang";

export const hasDishTranslationsInBody = (body: {
  translations?: unknown;
}): boolean => body.translations !== undefined && body.translations !== null;

type ParseDishTranslationsResult =
  | { ok: true; translations: DishTranslations }
  | { ok: false; reason: "invalidShape" | "empty" };

export const parseDishTranslations = (
  raw: unknown,
): ParseDishTranslationsResult => {
  const parsed = parseJsonField(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "invalidShape" };
  }

  const translations: DishTranslations = {};

  for (const [lang, entry] of Object.entries(parsed)) {
    if (!isMenuLangCode(lang)) {
      continue;
    }

    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, reason: "invalidShape" };
    }

    const record = entry as DishTranslationEntry;
    const name = record.name;
    if (typeof name !== "string") {
      return { ok: false, reason: "invalidShape" };
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      continue;
    }

    const item: DishTranslationEntry = { name: trimmedName };

    if (record.description !== undefined && record.description !== null) {
      if (typeof record.description !== "string") {
        return { ok: false, reason: "invalidShape" };
      }
      const trimmedDesc = record.description.trim();
      if (trimmedDesc) {
        item.description = trimmedDesc;
      }
    }

    translations[lang] = item;
  }

  if (Object.keys(translations).length === 0) {
    return { ok: false, reason: "empty" };
  }

  return { ok: true, translations: migrateArToPt(translations) };
};

export const resolveDishPrimaryFields = (
  body: { name?: unknown; description?: unknown },
  translations?: DishTranslations,
): { name: string | null; description: string | undefined } => {
  const uk = translations?.[DISH_PRIMARY_LANG];
  const nameFromUk = uk?.name?.trim();
  const descFromUk = uk?.description?.trim();

  let name: string | null = nameFromUk ?? null;
  if (!name && translations) {
    for (const lang of Object.keys(translations) as DishLangCode[]) {
      const value = translations[lang]?.name?.trim();
      if (value) {
        name = value;
        break;
      }
    }
  }
  if (!name && typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (trimmed) {
      name = trimmed;
    }
  }

  let description: string | undefined = descFromUk;
  if (
    description === undefined &&
    typeof body.description === "string"
  ) {
    const trimmed = body.description.trim();
    description = trimmed || undefined;
  }

  return { name, description };
};

export const ensureDishUkFields = (
  translations: DishTranslations | undefined,
  name: string,
  description?: string,
): DishTranslations => {
  const migrated = migrateArToPt(translations ?? {});
  const uk: DishTranslationEntry = { name };
  if (description !== undefined && description !== "") {
    uk.description = description;
  }
  return {
    ...migrated,
    [DISH_PRIMARY_LANG]: uk,
  };
};

export const mergeDishTranslations = (
  existing: DishTranslations | undefined,
  incoming: DishTranslations,
): DishTranslations => migrateArToPt({
  ...migrateArToPt(existing ?? {}),
  ...incoming,
});

export type DishApiItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  isAvailable: string;
  image?: string;
  ownerId: string;
  createdAt?: Date;
  updatedAt?: Date;
  translations: DishTranslations;
};

export type DishWritePayload = {
  name: string;
  description?: string;
  translations?: DishTranslations;
  persistTranslations: boolean;
};

export type DishWriteBuildResult =
  | { ok: true; payload: DishWritePayload }
  | { ok: false; status: 403 | 400; message: EResponseMessage };

export const buildDishWritePayload = (
  planName: string,
  body: { name?: unknown; description?: unknown; translations?: unknown },
): DishWriteBuildResult => {
  if (hasDishTranslationsInBody(body) && planName !== EPlan.premium) {
    return {
      ok: false,
      status: 403,
      message: EResponseMessage.DISH_TRANSLATIONS_PREMIUM_ONLY,
    };
  }

  let translations: DishTranslations | undefined;
  let persistTranslations = false;

  if (hasDishTranslationsInBody(body) && planName === EPlan.premium) {
    const parsed = parseDishTranslations(body.translations);
    if (!parsed.ok) {
      if (parsed.reason === "empty") {
        return {
          ok: false,
          status: 400,
          message: EResponseMessage.DISH_NAME_REQUIRED,
        };
      }
      return {
        ok: false,
        status: 400,
        message: EResponseMessage.DISH_TRANSLATIONS_INVALID,
      };
    }
    translations = parsed.translations;
    persistTranslations = true;
  }

  const { name, description } = resolveDishPrimaryFields(body, translations);
  if (!name) {
    return {
      ok: false,
      status: 400,
      message: EResponseMessage.DISH_NAME_REQUIRED,
    };
  }

  return {
    ok: true,
    payload: {
      name,
      description,
      translations,
      persistTranslations,
    },
  };
};

export const dishItemToApi = (item: IDish): DishApiItem => {
  const stored = migrateArToPt(item.translations ?? {});
  const translations: DishTranslations = { ...stored };

  const uk = translations[DISH_PRIMARY_LANG];
  if (!uk?.name?.trim()) {
    const ukEntry: DishTranslationEntry = { name: item.name };
    if (item.description?.trim()) {
      ukEntry.description = item.description.trim();
    }
    translations[DISH_PRIMARY_LANG] = ukEntry;
  } else if (
    item.description?.trim() &&
    !uk.description?.trim()
  ) {
    translations[DISH_PRIMARY_LANG] = {
      ...uk,
      description: item.description.trim(),
    };
  }

  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    category: item.category,
    isAvailable: item.isAvailable,
    image: item.image,
    ownerId: item.ownerId,
    translations,
  };
};
