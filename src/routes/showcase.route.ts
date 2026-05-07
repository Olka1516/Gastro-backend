import {
  getCategories,
  getDishes,
  getPlaceBranding,
  getPlanStatus,
  placeShowcaseOrder,
} from "@/controllers/showcase.controller";
import { createTableReservation } from "@/controllers/tableReservation.controller";
import { showcasePlaceOrderRateLimiter } from "@/middlewares/showcasePlaceOrderRateLimit.middleware";
import { tableReservationRateLimiter } from "@/middlewares/tableReservationRateLimit.middleware";
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
router.post(
  "/table-reservation/:placeSlug",
  tableReservationRateLimiter,
  createTableReservation,
);

export default router;
