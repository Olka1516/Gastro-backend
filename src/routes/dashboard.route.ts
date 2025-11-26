import {
  createDish,
  getDetails,
  updateDish,
} from "@/controllers/dashboard.controller";
import authMiddleware from "@/middlewares/auth.middleware";
import { Router } from "express";

const router = Router();

router.get("/get-details", authMiddleware, getDetails);
router.post("/dishes", authMiddleware, createDish);
router.put("/dishes/:dishId", authMiddleware, updateDish);

export default router;
