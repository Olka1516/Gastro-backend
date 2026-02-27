import { stripe } from "@/config/stripe";
import { NextFunction, Request, Response } from "express";
import { changeUserPlan } from "./user.controller";
import { EStatus } from "@/types/enums";

export const checkoutPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, price } = req.body;
    const email = req.user?.email;
    const id = req.user?.id || "";

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: name,
            },
            unit_amount: price * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: email,
      success_url: `${process.env.BASE_URL}/dashboard`,
      cancel_url: `${process.env.BASE_URL}`,
    });

    const changeData = await changeUserPlan(id, {
      planName: name,
      status: EStatus.pending,
    });

    if (!changeData.success) {
      res.status(401).json({ message: changeData.message });
    }

    res.status(200).json({
      id: session.id,
      user: changeData.updated,
    });
  } catch (error) {
    next(error);
  }
};

export const checkSession = async (email: string) => {
  const session = await stripe.checkout.sessions.list({
    customer_details: {
      email,
    },
    limit: 1,
  });
  //TODO: check if array exist
  return session.data[0].payment_status;
};
