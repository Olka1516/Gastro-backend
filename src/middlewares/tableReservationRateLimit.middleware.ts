import { TABLE_RESERVATION_RATE_LIMIT } from "@/types/constants";
import { EResponseMessage } from "@/types/enums";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const tableReservationRateLimiter = rateLimit({
  windowMs: TABLE_RESERVATION_RATE_LIMIT.windowMs,
  max: TABLE_RESERVATION_RATE_LIMIT.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const slug =
      typeof req.params.placeSlug === "string" ? req.params.placeSlug : "";
    const ipPart = ipKeyGenerator(req.ip ?? "0.0.0.0");
    return `${ipPart}:${slug}`;
  },
  handler: (_req, res) => {
    res
      .status(429)
      .json({ message: EResponseMessage.TABLE_RESERVATION_RATE_LIMIT });
  },
});
