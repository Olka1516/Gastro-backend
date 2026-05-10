/**
 * One-time MongoDB backfill: set menuDishLayout to "grid" where missing.
 * Run: npx ts-node -r tsconfig-paths/register scripts/migrate-menu-dish-layout.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

import mongoose from "mongoose";
import UserEntity from "@/entities/User.entity";
import { DEFAULT_MENU_DISH_LAYOUT } from "@/types/constants";

async function migrate(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error("MONGO_URL is not set");
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  const result = await UserEntity.updateMany(
    { menuDishLayout: { $exists: false } },
    { $set: { menuDishLayout: DEFAULT_MENU_DISH_LAYOUT } },
  );
  console.log(
    `menuDishLayout migration: matched ${result.matchedCount}, modified ${result.modifiedCount}`,
  );
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
