import { checkoutPlan } from "@/controllers/stripe.controller";
import { Router } from "express";

const router = Router();

router.get("/getCheckoutId", checkoutPlan);

export default router;
