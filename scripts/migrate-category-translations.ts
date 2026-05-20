/**
 * One-time migration: copy legacy category/dish `ar` translations to `pt`.
 *
 * Usage: npm run migrate:category-translations
 */
import "dotenv/config";
import mongoose from "mongoose";
import CategoryEntity from "../src/entities/Category.entity";
import DishEntity from "../src/entities/Dish.entity";
import { LEGACY_MENU_LANG_AR } from "../src/types/menuLang";
import { migrateArToPt } from "../src/utils/menuTranslationLang";

const migrateRecordTranslations = (
  translations: Record<string, unknown> | undefined,
): { changed: boolean; next?: Record<string, unknown> } => {
  if (!translations || typeof translations !== "object") {
    return { changed: false };
  }
  if (!(LEGACY_MENU_LANG_AR in translations)) {
    return { changed: false, next: translations };
  }
  return { changed: true, next: migrateArToPt(translations) };
};

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  await mongoose.connect(uri);

  let categoryDocsUpdated = 0;
  let categoryItemsUpdated = 0;
  const categoryDocs = await CategoryEntity.find({});
  for (const doc of categoryDocs) {
    let docChanged = false;
    for (const item of doc.categories) {
      const raw = item.translations as Record<string, unknown> | undefined;
      const { changed, next } = migrateRecordTranslations(raw);
      if (changed && next) {
        item.translations = next as typeof item.translations;
        categoryItemsUpdated += 1;
        docChanged = true;
      }
    }
    if (docChanged) {
      await doc.save();
      categoryDocsUpdated += 1;
    }
  }

  let dishDocsUpdated = 0;
  const dishes = await DishEntity.find({});
  for (const dish of dishes) {
    const raw = dish.translations as Record<string, unknown> | undefined;
    const { changed, next } = migrateRecordTranslations(raw);
    if (changed && next) {
      dish.translations = next as typeof dish.translations;
      await dish.save();
      dishDocsUpdated += 1;
    }
  }

  console.log(
    `Done. Categories: ${categoryDocsUpdated} docs, ${categoryItemsUpdated} items. Dishes: ${dishDocsUpdated} docs.`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
