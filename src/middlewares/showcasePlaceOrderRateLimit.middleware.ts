import { SHOWCASE_PLACE_ORDER_RATE_LIMIT } from "@/types/constants";
import { EResponseMessage } from "@/types/enums";
import rateLimit from "express-rate-limit";

export const showcasePlaceOrderRateLimiter = rateLimit({
  windowMs: SHOWCASE_PLACE_ORDER_RATE_LIMIT.windowMs,
  max: SHOWCASE_PLACE_ORDER_RATE_LIMIT.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ message: EResponseMessage.SHOWCASE_ORDER_RATE_LIMIT });
  },
});
