import {
  createDish,
  deleteDish,
  getDetails,
  getDishes,
  updateDish,
} from "@/controllers/dashboard.controller";
import authMiddleware from "@/middlewares/auth.middleware";
import { Router } from "express";

const router = Router();

router.get("/get-details", authMiddleware, getDetails);
router.get("/dishes", authMiddleware, getDishes);
router.post("/dishes", authMiddleware, createDish);
router.put("/dishes/:dishId", authMiddleware, updateDish);
router.delete("/dishes/:dishId", authMiddleware, deleteDish);

export default router;
