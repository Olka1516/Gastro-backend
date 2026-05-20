import mongoose, { Schema } from "mongoose";
import { IDish } from "../types/entities";

const DishSchema: Schema = new Schema<IDish>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    translations: { type: Schema.Types.Mixed, required: false },
    price: { type: Number, required: true, min: 0 },
    category: { type: String },
    isAvailable: { type: String, required: true, default: "available" },
    image: { type: String },
    ownerId: { type: String, required: true },
  },
  {
    timestamps: true, // This will automatically add createdAt and updatedAt fields
  }
);

export default mongoose.model<IDish & Document>("Dish", DishSchema);
