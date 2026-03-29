import { EPlan, EStatus } from "@/types/enums";
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
    default: EStatus.pending,
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
});

export default mongoose.model<IUser & Document>("User", UserSchema);
