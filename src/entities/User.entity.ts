import { EPlan, EStatus } from "@/types/enums";
import {
  DEFAULT_MENU_DISH_LAYOUT,
  MENU_DISH_LAYOUT_VALUES,
} from "@/types/constants";
import mongoose, { Schema } from "mongoose";
import { IUser } from "../types/entities";

const UserSchema: Schema = new Schema<IUser>({
  placeName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  id: { type: String, required: true },
  status: {
    type: String,
    enum: Object.values(EStatus),
    required: true,
    default: EStatus.complete,
  },
  planName: {
    type: String,
    enum: Object.values(EPlan),
    required: true,
    default: EPlan.free,
  },
  planDate: { type: Date, required: true, default: Date.now },
  menuIconColor: { type: String, default: "" },
  logo: { type: String, default: "" },
  menuBackgroundColor: { type: String, default: "" },
  menuDishLayout: {
    type: String,
    enum: [...MENU_DISH_LAYOUT_VALUES],
    default: DEFAULT_MENU_DISH_LAYOUT,
  },
});

UserSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const plain = ret as Record<string, unknown>;
    if (plain.menuDishLayout == null || plain.menuDishLayout === "") {
      plain.menuDishLayout = DEFAULT_MENU_DISH_LAYOUT;
    }
    return plain;
  },
});

export default mongoose.model<IUser & Document>("User", UserSchema);
