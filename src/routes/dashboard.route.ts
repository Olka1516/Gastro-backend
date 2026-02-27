import {
  addCategory,
  createDish,
  deleteCategory,
  deleteDish,
  editCategory,
  getCategories,
  getDetails,
  getDishes,
  updateDish,
} from "@/controllers/dashboard.controller";
import { getDetails } from "@/controllers/dashboard.controller";
import authMiddleware from "@/middlewares/auth.middleware";
import { Router } from "express";

const router = Router();

router.get("/get-details", authMiddleware, getDetails);
router.get("/dishes", authMiddleware, getDishes);
router.post("/dishes", authMiddleware, createDish);
router.put("/dishes/:dishId", authMiddleware, updateDish);
router.delete("/dishes/:dishId", authMiddleware, deleteDish);

router.get("/categories", authMiddleware, getCategories);
router.post("/categories", authMiddleware, addCategory);
router.put("/categories/:id", authMiddleware, editCategory);
router.delete("/categories/:id", authMiddleware, deleteCategory);

export default router;
