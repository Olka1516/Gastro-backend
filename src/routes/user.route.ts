import { checkAuth, login, register } from "@/controllers/user.controller";
import authMiddleware from "@/middlewares/auth.middleware";
import { Router } from "express";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/check", authMiddleware, checkAuth);

export default router;
