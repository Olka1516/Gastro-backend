import { stripe } from "@/config/stripe";
import { NextFunction, Request, Response } from "express";

export const checkoutPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // console.log("here work?");
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Node.js and Express book",
            },
            unit_amount: 50 * 100,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "JavaScript T-Shirt",
            },
            unit_amount: 20 * 100,
          },
          quantity: 2,
        },
      ],
      mode: "payment",
      shipping_address_collection: {
        allowed_countries: ["US", "BR"],
      },
      success_url: `${process.env.BASE_URL}/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}`,
    });

    console.log(session);
    // res.redirect(session.url);
    res.status(200).json({
      id: session.id,
    });
  } catch (error) {
    next(error);
  }
};
