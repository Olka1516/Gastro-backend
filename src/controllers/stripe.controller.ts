import { stripe } from "@/config/stripe";
import { NextFunction, Request, Response } from "express";
import UserEntity from "@/entities/User.entity";
import { EResponseMessage, EStatus } from "@/types/enums";

export const CHECKOUT_SESSION_INVALIDATED_KEY = "gastro_invalidated";

export const isCheckoutSessionInvalidated = (s: {
  metadata?: Record<string, string> | null;
}): boolean => s.metadata?.[CHECKOUT_SESSION_INVALIDATED_KEY] === "true";

const metadataWithInvalidated = (
  meta: Record<string, string | null | undefined> | null | undefined,
): Record<string, string> => {
  const out: Record<string, string> = {};
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      if (v != null && v !== "") {
        out[k] = String(v);
      }
    }
  }
  out[CHECKOUT_SESSION_INVALIDATED_KEY] = "true";
  return out;
};

export const checkoutPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
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
      metadata: {
        plan: name,
        date: new Date().toISOString(),
      },
      mode: "payment",
      customer_email: email,
      success_url: `${process.env.BASE_URL}/dashboard`,
      cancel_url: `${process.env.BASE_URL}`,
    });

    const userInfo = await UserEntity.findOneAndUpdate(
      { id },
      {
        status: EStatus.pending,
        planDate: new Date(session.created * 1000),
      },
      { new: true },
    );
    if (!userInfo) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    res.status(200).json({
      id: session.id,
      user: userInfo,
    });
  } catch (error) {
    next(error);
  }
};

type CheckoutSessionListItem = Awaited<
  ReturnType<typeof stripe.checkout.sessions.list>
>["data"][number];

export const checkSession = async (email: string, planDate: Date) => {
  const trimmed = email?.trim();
  if (!trimmed) {
    return undefined;
  }

  const planCutoffSec = Math.floor(new Date(planDate).getTime() / 1000);
  if (!Number.isFinite(planCutoffSec)) {
    return undefined;
  }

  let startingAfter: string | undefined;
  let newestInvalidated: CheckoutSessionListItem | undefined;
  let firstNonInvalid: CheckoutSessionListItem | undefined;

  while (true) {
    const page = await stripe.checkout.sessions.list({
      customer_details: { email: trimmed },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    if (page.data.length === 0) {
      return firstNonInvalid ?? newestInvalidated;
    }

    for (const s of page.data) {
      if (isCheckoutSessionInvalidated(s)) {
        if (newestInvalidated === undefined) {
          newestInvalidated = s;
        }
        if (s.created >= planCutoffSec) {
          return s;
        }
        continue;
      }

      if (firstNonInvalid === undefined) {
        firstNonInvalid = s;
      }
      if (s.created < planCutoffSec) {
        return firstNonInvalid ?? newestInvalidated;
      }
      if (s.payment_status === "paid") {
        return s;
      }
    }

    if (!page.has_more) {
      return firstNonInvalid ?? newestInvalidated;
    }
    const lastId = page.data[page.data.length - 1]?.id;
    if (!lastId) {
      return firstNonInvalid ?? newestInvalidated;
    }
    startingAfter = lastId;
  }
};

export const invalidateCheckoutSessionsForEmail = async (
  email: string,
): Promise<void> => {
  const trimmedEmail = email?.trim();
  if (!trimmedEmail) return;

  let startingAfter: string | undefined;
  const maxPages = 50;
  for (let pageNum = 0; pageNum < maxPages; pageNum += 1) {
    const page = await stripe.checkout.sessions.list({
      customer_details: { email: trimmedEmail },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    if (page.data.length === 0) {
      break;
    }

    for (const s of page.data) {
      if (isCheckoutSessionInvalidated(s)) {
        continue;
      }
      try {
        await stripe.checkout.sessions.update(s.id, {
          metadata: metadataWithInvalidated(s.metadata ?? undefined),
        });
      } catch {
        continue;
      }
    }

    if (!page.has_more) {
      break;
    }
    const lastId = page.data[page.data.length - 1]?.id;
    if (!lastId) {
      break;
    }
    startingAfter = lastId;
  }
};
