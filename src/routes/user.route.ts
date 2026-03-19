import {
  checkAuth,
  login,
  putFreePlan,
  register,
  updateUser,
} from "@/controllers/user.controller";
import authMiddleware from "@/middlewares/auth.middleware";
import { Router } from "express";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/check", authMiddleware, checkAuth);
router.put("/put-free-plan", authMiddleware, putFreePlan);
router.put("/update", authMiddleware, updateUser);

export default router;
