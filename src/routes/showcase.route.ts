import {
  getCategories,
  getDishes,
  getPlaceBranding,
  getPlanStatus,
  placeShowcaseOrder,
} from "@/controllers/showcase.controller";
import { showcasePlaceOrderRateLimiter } from "@/middlewares/showcasePlaceOrderRateLimit.middleware";
import { Router } from "express";

const router = Router();

router.get("/get-plan-status/:placeName", getPlanStatus);
router.get("/get-place-branding/:placeName", getPlaceBranding);
router.get("/get-dishes/:placeName", getDishes);
router.get("/get-categories/:placeName", getCategories);
router.post(
  "/place-order/:placeName",
  showcasePlaceOrderRateLimiter,
  placeShowcaseOrder,
);

export default router;
