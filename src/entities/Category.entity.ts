import mongoose, { Schema } from "mongoose";
import { ICategory, ICategoryItem } from "../types/entities";

const CategoryItemSchema: Schema = new Schema<ICategoryItem>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  translations: { type: Schema.Types.Mixed, required: false },
});

const CategorySchema: Schema = new Schema<ICategory>(
  {
    id: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true, unique: true },
    categories: { type: [CategoryItemSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ICategory & Document>("Category", CategorySchema);
