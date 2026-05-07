import {
  checkAuth,
  login,
  putFreePlan,
  register,
  sendMessage,
  updateUser,
} from "@/controllers/user.controller";
import authMiddleware from "@/middlewares/auth.middleware";
import { contactFormRateLimiter } from "@/middlewares/contactFormRateLimit.middleware";
import { Router } from "express";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/send-message", contactFormRateLimiter, sendMessage);
router.post("/check", authMiddleware, checkAuth);
router.put("/put-free-plan", authMiddleware, putFreePlan);
router.put("/update", authMiddleware, updateUser);

export default router;
