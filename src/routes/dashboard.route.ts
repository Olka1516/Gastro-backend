import { getDetails } from "@/controllers/dashboard.controller";
import authMiddleware from "@/middlewares/auth.middleware";
import { Router } from "express";

const router = Router();

router.get("/get-details", authMiddleware, getDetails);

export default router;
