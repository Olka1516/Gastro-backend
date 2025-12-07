import {
  getCategories,
  getDishes,
  getPlanStatus,
} from "@/controllers/showcase.controller";
import authMiddleware from "@/middlewares/auth.middleware";
import { Router } from "express";

const router = Router();

router.get("/get-plan-status/:placeName", getPlanStatus);
router.get("/get-dishes/:placeName", getDishes);
router.get("/get-categories/:placeName", getCategories);

export default router;
