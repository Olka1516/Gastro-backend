import { CONTACT_FORM_RATE_LIMIT } from "@/types/constants";
import { EResponseMessage } from "@/types/enums";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const contactFormRateLimiter = rateLimit({
  windowMs: CONTACT_FORM_RATE_LIMIT.windowMs,
  max: CONTACT_FORM_RATE_LIMIT.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "0.0.0.0"),
  handler: (_req, res) => {
    res.status(429).json({ message: EResponseMessage.CONTACT_FORM_RATE_LIMIT });
  },
});
