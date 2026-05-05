import mongoose, { Schema } from "mongoose";
import {
  IShowcaseOrder,
  IShowcaseOrderCustomer,
  IShowcaseOrderLine,
} from "../types/entities";
import { EShowcaseOrderStatus } from "../types/enums";

const ShowcaseOrderLineSchema = new Schema<IShowcaseOrderLine>(
  {
    dishId: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    name: { type: String, required: true },
    categoryName: { type: String, required: true },
  },
  { _id: false },
);

const ShowcaseOrderCustomerSchema = new Schema<IShowcaseOrderCustomer>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: false, default: "" },
    address: { type: String, required: true },
    deliveryTime: { type: String, required: false, default: "" },
    comment: { type: String, required: false, default: "" },
  },
  { _id: false },
);

const ShowcaseOrderSchema: Schema = new Schema<IShowcaseOrder>(
  {
    id: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    placeName: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(EShowcaseOrderStatus),
      required: true,
      default: EShowcaseOrderStatus.pending,
    },
    customer: { type: ShowcaseOrderCustomerSchema, required: true },
    lines: { type: [ShowcaseOrderLineSchema], required: true },
    total: { type: Number, required: true },
  },
  { timestamps: true },
);

export default mongoose.model<IShowcaseOrder & mongoose.Document>(
  "ShowcaseOrder",
  ShowcaseOrderSchema,
);
