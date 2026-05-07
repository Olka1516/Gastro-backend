import TableReservationEntity from "@/entities/TableReservation.entity";
import UserEntity from "@/entities/User.entity";
import {
  notifyTableReservationReceived,
  notifyTableReservationStatusChange,
  type TableReservationEmailCtx,
} from "@/services/tableReservation.notifications";
import { TABLE_RESERVATION } from "@/types/constants";
import { ITableReservation } from "@/types/entities";
import {
  EPlan,
  EResponseMessage,
  ETableReservationStatus,
} from "@/types/enums";
import { normalizeShowcasePlaceName } from "@/utils/showcasePlaceName";
import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

const TABLE_RESERVATION_STATUS_LIST = Object.values(ETableReservationStatus);

const isTableReservationStatus = (
  v: string,
): v is ETableReservationStatus =>
  (TABLE_RESERVATION_STATUS_LIST as string[]).includes(v);

const trimStr = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") {
    return null;
  }
  const t = v.trim();
  if (t.length === 0 || t.length > max) {
    return null;
  }
  return t;
};

const parseComment = (v: unknown): string | null => {
  if (v === undefined || v === null) {
    return "";
  }
  if (typeof v !== "string" || v.length > TABLE_RESERVATION.COMMENT_MAX) {
    return null;
  }
  return v.trim();
};

const isSimpleEmail = (s: string): boolean => {
  if (s.length > TABLE_RESERVATION.EMAIL_MAX) {
    return false;
  }
  const at = s.indexOf("@");
  if (at <= 0 || at === s.length - 1) {
    return false;
  }
  return !/\s/.test(s);
};

const parseCalendarDate = (raw: string): string | null => {
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return null;
  }
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return s;
};

const normalizeVisitTime = (raw: string): string | null => {
  const s = raw.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    return null;
  }
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (
    !Number.isInteger(hh) ||
    !Number.isInteger(mm) ||
    hh < 0 ||
    hh > 23 ||
    mm < 0 ||
    mm > 59
  ) {
    return null;
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

const todayUtcYmd = (): string => new Date().toISOString().slice(0, 10);

const emailCtxFromDoc = (doc: {
  placeName: string;
  visitDate: string;
  visitTime: string;
  partySize: number;
  firstName: string;
  id: string;
}): TableReservationEmailCtx => ({
  placeName: doc.placeName,
  visitDate: doc.visitDate,
  visitTime: doc.visitTime,
  partySize: doc.partySize,
  firstName: doc.firstName,
  reservationId: doc.id,
});

const tableReservationDocToApi = (doc: {
  id: string;
  status?: string;
  visitDate: string;
  visitTime: string;
  partySize: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  comment?: string;
  createdAt?: Date;
}): ITableReservation => {
  const createdAtRaw = doc.createdAt;
  const createdAt =
    createdAtRaw instanceof Date
      ? createdAtRaw.toISOString()
      : new Date().toISOString();
  const statusVal = doc.status ?? "";
  const status = isTableReservationStatus(statusVal)
    ? statusVal
    : ETableReservationStatus.pending;

  return {
    id: doc.id,
    createdAt,
    status,
    visitDate: doc.visitDate,
    visitTime: doc.visitTime,
    partySize: doc.partySize,
    firstName: doc.firstName,
    lastName: doc.lastName,
    phone: doc.phone,
    email: doc.email,
    comment: doc.comment ?? "",
  };
};

export const createTableReservation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const placeName = normalizeShowcasePlaceName(req.params.placeSlug);
    if (!placeName) {
      res.status(400).json({ message: EResponseMessage.IS_REQUIRED });
      return;
    }

    const userInfo = await UserEntity.findOne({ placeName });
    if (!userInfo) {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    if (userInfo.planName !== EPlan.premium) {
      res
        .status(403)
        .json({ message: EResponseMessage.TABLE_RESERVATION_NOT_AVAILABLE });
      return;
    }

    const idempotencyHeader = req.get("idempotency-key");
    const idempotencyKey =
      typeof idempotencyHeader === "string" &&
      idempotencyHeader.trim().length > 0
        ? idempotencyHeader.trim().slice(0, TABLE_RESERVATION.IDEMPOTENCY_KEY_MAX)
        : undefined;

    if (idempotencyKey) {
      const existing = await TableReservationEntity.findOne({
        placeName: userInfo.placeName,
        idempotencyKey,
      })
        .lean()
        .exec();
      if (existing) {
        res.status(201).json({ id: existing.id });
        return;
      }
    }

    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== "object") {
      res
        .status(400)
        .json({ message: EResponseMessage.TABLE_RESERVATION_INVALID_BODY });
      return;
    }

    const visitDateRaw = body.visitDate;
    const visitTimeRaw = body.visitTime;
    if (typeof visitDateRaw !== "string" || typeof visitTimeRaw !== "string") {
      res
        .status(400)
        .json({ message: EResponseMessage.TABLE_RESERVATION_INVALID_BODY });
      return;
    }

    const visitDate = parseCalendarDate(visitDateRaw);
    const visitTime = normalizeVisitTime(visitTimeRaw);
    if (!visitDate || !visitTime) {
      res
        .status(400)
        .json({ message: EResponseMessage.TABLE_RESERVATION_INVALID_SLOT });
      return;
    }

    if (visitDate < todayUtcYmd()) {
      res
        .status(400)
        .json({ message: EResponseMessage.TABLE_RESERVATION_INVALID_SLOT });
      return;
    }

    const partySizeRaw = body.partySize;
    if (
      typeof partySizeRaw !== "number" ||
      !Number.isInteger(partySizeRaw) ||
      partySizeRaw < TABLE_RESERVATION.PARTY_MIN ||
      partySizeRaw > TABLE_RESERVATION.PARTY_MAX
    ) {
      res
        .status(400)
        .json({ message: EResponseMessage.TABLE_RESERVATION_INVALID_BODY });
      return;
    }

    const firstName = trimStr(body.firstName, TABLE_RESERVATION.NAME_MAX);
    const lastName = trimStr(body.lastName, TABLE_RESERVATION.NAME_MAX);
    const phone = trimStr(body.phone, TABLE_RESERVATION.PHONE_MAX);
    const emailRaw = trimStr(body.email, TABLE_RESERVATION.EMAIL_MAX);
    const comment = parseComment(body.comment);

    if (
      firstName === null ||
      lastName === null ||
      phone === null ||
      emailRaw === null ||
      comment === null ||
      !isSimpleEmail(emailRaw)
    ) {
      res
        .status(400)
        .json({ message: EResponseMessage.TABLE_RESERVATION_INVALID_BODY });
      return;
    }

    const reservationId = uuidv4();

    try {
      await TableReservationEntity.create({
        id: reservationId,
        ownerId: userInfo.id,
        placeName: userInfo.placeName,
        status: ETableReservationStatus.pending,
        visitDate,
        visitTime,
        partySize: partySizeRaw,
        firstName,
        lastName,
        phone,
        email: emailRaw,
        comment,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 11000 && idempotencyKey) {
        const dup = await TableReservationEntity.findOne({
          placeName: userInfo.placeName,
          idempotencyKey,
        })
          .lean()
          .exec();
        if (dup) {
          res.status(201).json({ id: dup.id });
          return;
        }
      }
      throw err;
    }

    void notifyTableReservationReceived(emailRaw, {
      placeName: userInfo.placeName,
      visitDate,
      visitTime,
      partySize: partySizeRaw,
      firstName,
      reservationId,
    }).catch((e) => console.error("[tableReservation] receipt email:", e));

    res.status(201).json({ id: reservationId });
  } catch (error) {
    next(error);
  }
};

export const getTableReservationsForOwner = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const statusRaw = req.query.status;
    const statusParam =
      typeof statusRaw === "string"
        ? statusRaw.trim()
        : Array.isArray(statusRaw) && typeof statusRaw[0] === "string"
          ? statusRaw[0].trim()
          : "";

    let statusFilter: ETableReservationStatus | undefined;
    if (statusParam !== "" && statusParam !== "all") {
      if (!isTableReservationStatus(statusParam)) {
        res
          .status(400)
          .json({ message: EResponseMessage.TABLE_RESERVATION_INVALID_STATUS });
        return;
      }
      statusFilter = statusParam;
    }

    const query: { ownerId: string; status?: ETableReservationStatus } = {
      ownerId,
    };
    if (statusFilter !== undefined) {
      query.status = statusFilter;
    }

    const docs = await TableReservationEntity.find(query)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const reservations = docs.map((doc) =>
      tableReservationDocToApi({
        id: doc.id as string,
        status: doc.status as string | undefined,
        visitDate: doc.visitDate as string,
        visitTime: doc.visitTime as string,
        partySize: doc.partySize as number,
        firstName: doc.firstName as string,
        lastName: doc.lastName as string,
        phone: doc.phone as string,
        email: doc.email as string,
        comment: doc.comment as string | undefined,
        createdAt: (doc as { createdAt?: Date }).createdAt,
      }),
    );

    res.status(200).json({ reservations });
  } catch (error) {
    next(error);
  }
};

export const patchTableReservation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const reservationId = req.params.reservationId?.trim();
    if (!reservationId) {
      res.status(400).json({ message: EResponseMessage.IS_REQUIRED });
      return;
    }

    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== "object") {
      res
        .status(400)
        .json({ message: EResponseMessage.TABLE_RESERVATION_INVALID_BODY });
      return;
    }

    const rawStatus = body.status;
    if (typeof rawStatus !== "string") {
      res
        .status(400)
        .json({ message: EResponseMessage.TABLE_RESERVATION_INVALID_BODY });
      return;
    }

    const nextStatus = rawStatus.trim();
    if (!isTableReservationStatus(nextStatus)) {
      res
        .status(400)
        .json({ message: EResponseMessage.TABLE_RESERVATION_INVALID_STATUS });
      return;
    }

    const existing = await TableReservationEntity.findOne({
      id: reservationId,
      ownerId,
    })
      .lean()
      .exec();

    if (!existing) {
      res
        .status(404)
        .json({ message: EResponseMessage.TABLE_RESERVATION_NOT_FOUND });
      return;
    }

    const previousStatus = isTableReservationStatus(
      String(existing.status ?? ""),
    )
      ? (existing.status as ETableReservationStatus)
      : ETableReservationStatus.pending;

    const prevVisitDate = String(existing.visitDate ?? "").trim();
    const prevVisitTime = String(existing.visitTime ?? "").trim();

    const hasSlotPatch =
      body.visitDate !== undefined || body.visitTime !== undefined;
    if (hasSlotPatch && nextStatus !== ETableReservationStatus.rescheduled) {
      res
        .status(400)
        .json({ message: EResponseMessage.TABLE_RESERVATION_INVALID_BODY });
      return;
    }

    const update: Record<string, unknown> = { status: nextStatus };

    if (nextStatus === ETableReservationStatus.rescheduled) {
      const vdRaw = body.visitDate;
      const vtRaw = body.visitTime;
      if (
        vdRaw === undefined ||
        vtRaw === undefined ||
        typeof vdRaw !== "string" ||
        typeof vtRaw !== "string" ||
        !vdRaw.trim() ||
        !vtRaw.trim()
      ) {
        res.status(400).json({
          message: EResponseMessage.TABLE_RESERVATION_RESCHEDULE_INCOMPLETE,
        });
        return;
      }
      const vd = parseCalendarDate(vdRaw);
      const vt = normalizeVisitTime(vtRaw);
      if (!vd || !vt) {
        res
          .status(400)
          .json({ message: EResponseMessage.TABLE_RESERVATION_INVALID_SLOT });
        return;
      }
      if (vd < todayUtcYmd()) {
        res
          .status(400)
          .json({ message: EResponseMessage.TABLE_RESERVATION_INVALID_SLOT });
        return;
      }
      update.visitDate = vd;
      update.visitTime = vt;
    }

    const updated = await TableReservationEntity.findOneAndUpdate(
      { id: reservationId, ownerId },
      { $set: update },
      { new: true },
    )
      .lean()
      .exec();

    if (!updated) {
      res
        .status(404)
        .json({ message: EResponseMessage.TABLE_RESERVATION_NOT_FOUND });
      return;
    }

    const newVisitDate = String(updated.visitDate ?? "").trim();
    const newVisitTime = String(updated.visitTime ?? "").trim();
    const visitSlotChanged =
      newVisitDate !== prevVisitDate || newVisitTime !== prevVisitTime;

    const notifyConfirmedOrDeclined =
      previousStatus !== nextStatus &&
      (nextStatus === ETableReservationStatus.confirmed ||
        nextStatus === ETableReservationStatus.declined);

    const notifyRescheduled =
      nextStatus === ETableReservationStatus.rescheduled &&
      (previousStatus !== ETableReservationStatus.rescheduled ||
        visitSlotChanged);

    const to = String(updated.email ?? "").trim();
    if (to) {
      if (notifyConfirmedOrDeclined) {
        void notifyTableReservationStatusChange(
          to,
          nextStatus,
          emailCtxFromDoc({
            placeName: updated.placeName as string,
            visitDate: updated.visitDate as string,
            visitTime: updated.visitTime as string,
            partySize: updated.partySize as number,
            firstName: updated.firstName as string,
            id: updated.id as string,
          }),
        ).catch((e) => console.error("[tableReservation] status email:", e));
      } else if (notifyRescheduled) {
        void notifyTableReservationStatusChange(
          to,
          ETableReservationStatus.rescheduled,
          emailCtxFromDoc({
            placeName: updated.placeName as string,
            visitDate: updated.visitDate as string,
            visitTime: updated.visitTime as string,
            partySize: updated.partySize as number,
            firstName: updated.firstName as string,
            id: updated.id as string,
          }),
        ).catch((e) =>
          console.error("[tableReservation] reschedule email:", e),
        );
      }
    }

    res.status(200).json(
      tableReservationDocToApi({
        id: updated.id as string,
        status: updated.status as string | undefined,
        visitDate: updated.visitDate as string,
        visitTime: updated.visitTime as string,
        partySize: updated.partySize as number,
        firstName: updated.firstName as string,
        lastName: updated.lastName as string,
        phone: updated.phone as string,
        email: updated.email as string,
        comment: updated.comment as string | undefined,
        createdAt: (updated as { createdAt?: Date }).createdAt,
      }),
    );
  } catch (error) {
    next(error);
  }
};
