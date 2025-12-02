import mongoose, { Schema } from "mongoose";
import { ICategory, ICategoryItem } from "../types/entities";

const CategoryItemSchema: Schema = new Schema<ICategoryItem>({
  id: { type: String, required: true },
  name: { type: String, required: true },
});

const CategorySchema: Schema = new Schema<ICategory>(
  {
    id: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true, unique: true },
    categories: { type: [CategoryItemSchema], default: [] },
  },
  {
    timestamps: true, // This will automatically add createdAt and updatedAt fields
  }
);

export default mongoose.model<ICategory & Document>("Category", CategorySchema);
