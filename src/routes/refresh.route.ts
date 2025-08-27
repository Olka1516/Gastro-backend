import { refreshAccessToken } from "@/controllers/refresh.controller";
import { Router } from "express";

const router = Router();

router.post("/", refreshAccessToken);

export default router;
