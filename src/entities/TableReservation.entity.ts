import mongoose, { Schema } from "mongoose";
import { ITableReservationDoc } from "../types/entities";
import { ETableReservationStatus } from "../types/enums";

const TableReservationSchema: Schema = new Schema<ITableReservationDoc>(
  {
    id: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    placeName: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(ETableReservationStatus),
      required: true,
      default: ETableReservationStatus.pending,
    },
    visitDate: { type: String, required: true },
    visitTime: { type: String, required: true },
    partySize: { type: Number, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    comment: { type: String, required: false, default: "" },
    idempotencyKey: { type: String, required: false },
    venueTimeZone: { type: String, required: false },
  },
  { timestamps: true },
);

TableReservationSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
/** Унікальність лише коли є ключ (без idempotency — необмежена кількість заявок на заклад). */
TableReservationSchema.index(
  { placeName: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $exists: true, $type: "string", $gt: "" },
    },
  },
);

export default mongoose.model<ITableReservationDoc & mongoose.Document>(
  "TableReservation",
  TableReservationSchema,
);
