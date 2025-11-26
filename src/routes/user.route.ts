import {
  checkAuth,
  login,
  putFreePlan,
  register,
} from "@/controllers/user.controller";
import authMiddleware from "@/middlewares/auth.middleware";
import { Router } from "express";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/check", authMiddleware, checkAuth);
router.put("/put-free-plan", authMiddleware, putFreePlan);

export default router;
