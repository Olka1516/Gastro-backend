import CategoryEntity from "@/entities/Category.entity";
import DishEntity from "@/entities/Dish.entity";
import ShowcaseOrderEntity from "@/entities/ShowcaseOrder.entity";
import UserEntity from "@/entities/User.entity";
import {
  DEFAULT_MENU_DISH_LAYOUT,
  FREE_PLAN_SHOWCASE_ITEMS_LIMIT,
  SHOWCASE_PLACE_ORDER,
} from "@/types/constants";
import {
  IShowcaseOrderCustomer,
  IShowcaseOrderLine,
} from "@/types/entities";
import {
  EPlan,
  EResponseMessage,
  EShowcaseOrderStatus,
  EStatus,
} from "@/types/enums";
import { categoryItemToApi } from "@/utils/categoryTranslations";
import { dishItemToApi } from "@/utils/dishTranslations";
import { normalizeShowcasePlaceName } from "@/utils/showcasePlaceName";
import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { checkSession, isCheckoutSessionInvalidated } from "./stripe.controller";

const trimStr = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") {
    return null;
  }
  const t = v.trim();
  if (t.length > max) {
    return null;
  }
  return t;
};

const trimStrAllowEmpty = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") {
    return null;
  }
  if (v.length > max) {
    return null;
  }
  return v.trim();
};

/** Optional customer fields: may be omitted, null, or "" in JSON. */
const optionalCustomerString = (v: unknown, max: number): string | null => {
  if (v === undefined || v === null) {
    return "";
  }
  return trimStrAllowEmpty(v, max);
};

const parseCustomer = (
  raw: unknown,
):
  | { ok: true; customer: IShowcaseOrderCustomer }
  | { ok: false } => {
  if (!raw || typeof raw !== "object") {
    return { ok: false };
  }
  const c = raw as Record<string, unknown>;
  const firstName = trimStr(c.firstName, SHOWCASE_PLACE_ORDER.NAME_MAX);
  const lastName = trimStr(c.lastName, SHOWCASE_PLACE_ORDER.NAME_MAX);
  const phone = trimStr(c.phone, SHOWCASE_PLACE_ORDER.PHONE_MAX);
  const email = optionalCustomerString(
    c.email,
    SHOWCASE_PLACE_ORDER.EMAIL_MAX,
  );
  const address = trimStr(c.address, SHOWCASE_PLACE_ORDER.ADDRESS_MAX);
  const deliveryTime = optionalCustomerString(
    c.deliveryTime,
    SHOWCASE_PLACE_ORDER.DELIVERY_TIME_MAX,
  );
  const comment = optionalCustomerString(
    c.comment,
    SHOWCASE_PLACE_ORDER.COMMENT_MAX,
  );
  if (
    firstName === null ||
    lastName === null ||
    phone === null ||
    email === null ||
    address === null ||
    deliveryTime === null ||
    comment === null
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    customer: {
      firstName,
      lastName,
      phone,
      email,
      address,
      deliveryTime,
      comment,
    },
  };
};

const parseLines = (
  raw: unknown,
):
  | { ok: true; lines: IShowcaseOrderLine[] }
  | { ok: false } => {
  if (!Array.isArray(raw)) {
    return { ok: false };
  }
  if (
    raw.length === 0 ||
    raw.length > SHOWCASE_PLACE_ORDER.MAX_LINES
  ) {
    return { ok: false };
  }
  const lines: IShowcaseOrderLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      return { ok: false };
    }
    const o = item as Record<string, unknown>;
    if (typeof o.dishId !== "string" || !o.dishId.trim()) {
      return { ok: false };
    }
    const dishId = o.dishId.trim();
    const quantity = o.quantity;
    const unitPrice = o.unitPrice;
    if (
      typeof quantity !== "number" ||
      !Number.isFinite(quantity) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > SHOWCASE_PLACE_ORDER.MAX_QUANTITY
    ) {
      return { ok: false };
    }
    if (
      typeof unitPrice !== "number" ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      return { ok: false };
    }
    const name = trimStr(o.name, SHOWCASE_PLACE_ORDER.DISH_NAME_MAX);
    const categoryName = trimStr(
      o.categoryName,
      SHOWCASE_PLACE_ORDER.CATEGORY_NAME_MAX,
    );
    if (name === null || categoryName === null) {
      return { ok: false };
    }
    lines.push({
      dishId,
      quantity,
      unitPrice,
      name,
      categoryName,
    });
  }
  return { ok: true, lines };
};

const sumLinesTotal = (lines: IShowcaseOrderLine[]): number => {
  let sum = 0;
  for (const line of lines) {
    const lineSum =
      Math.round(line.quantity * line.unitPrice * 100) / 100;
    sum = Math.round((sum + lineSum) * 100) / 100;
  }
  return sum;
};

export const getPlanStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const placeName = normalizeShowcasePlaceName(req.params.placeName);

    if (!placeName) {
      res.status(400).json({ message: EResponseMessage.IS_REQUIRED });
      return;
    }

    const userInfo = await UserEntity.findOne({ placeName });
    if (!userInfo) {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    if (
      userInfo.planName === EPlan.free ||
      userInfo.status === EStatus.complete
    ) {
      res.status(200).json({
        status: true,
        planName: userInfo.planName,
        placeName,
      });
      return;
    }

    const session = await checkSession(userInfo.email, userInfo.planDate);

    if (!session) {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    if (isCheckoutSessionInvalidated(session)) {
      res.status(200).json({
        status: true,
        planName: EPlan.free,
        placeName,
      });
      return;
    }

    if (session.payment_status === "unpaid") {
      res.status(200).json({
        status: true,
        planName: userInfo.planName,
        placeName,
        checkoutSession: {
          id: session.id,
          url: session.url ?? undefined,
          status: session.status,
          payment_status: session.payment_status,
        },
      });
      return;
    }

    if (session.payment_status !== "paid") {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    res.status(200).json({
      status: true,
      planName: userInfo.planName,
      placeName,
    });
  } catch (error) {
    next(error);
  }
};

export const getPlaceBranding = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const placeName = normalizeShowcasePlaceName(req.params.placeName);

    if (!placeName) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const userInfo = await UserEntity.findOne({ placeName });
    if (!userInfo) {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    res.status(200).json({
      menuBackgroundColor: userInfo.menuBackgroundColor ?? "",
      menuIconColor: userInfo.menuIconColor ?? "",
      logo: userInfo.logo ?? "",
      menuDishLayout: userInfo.menuDishLayout ?? DEFAULT_MENU_DISH_LAYOUT,
    });
  } catch (error) {
    next(error);
  }
};

export const getDishes = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const placeName = normalizeShowcasePlaceName(req.params.placeName);
    if (!placeName) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const userInfo = await UserEntity.findOne({ placeName });
    if (!userInfo) {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const dishesQuery = DishEntity.find({
      ownerId: userInfo.id,
      isAvailable: "available",
    }).sort({
      createdAt: -1,
    });

    if (userInfo.planName === EPlan.free) {
      dishesQuery.limit(FREE_PLAN_SHOWCASE_ITEMS_LIMIT);
    }

    const dishes = await dishesQuery;

    res.status(200).json({
      dishes: dishes.map((dish) => dishItemToApi(dish)),
      orderingEnabled: userInfo.planName === EPlan.premium,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const placeName = normalizeShowcasePlaceName(req.params.placeName);
    if (!placeName) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const userInfo = await UserEntity.findOne({ placeName });
    if (!userInfo) {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const categoryDoc = await CategoryEntity.findOne({ ownerId: userInfo.id });

    if (!categoryDoc) {
      res.status(200).json({ categories: [] });
      return;
    }

    const slicedCategories =
      userInfo.planName === EPlan.free
        ? categoryDoc.categories.slice(0, FREE_PLAN_SHOWCASE_ITEMS_LIMIT)
        : categoryDoc.categories;

    res.status(200).json({
      categories: slicedCategories.map((cat) => categoryItemToApi(cat)),
    });
  } catch (error) {
    next(error);
  }
};

export const placeShowcaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const placeName = normalizeShowcasePlaceName(req.params.placeName);
    if (!placeName) {
      res.status(400).json({ message: EResponseMessage.IS_REQUIRED });
      return;
    }

    const userInfo = await UserEntity.findOne({ placeName });
    if (!userInfo) {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    if (userInfo.planName !== EPlan.premium) {
      res
        .status(403)
        .json({ message: EResponseMessage.SHOWCASE_ORDERING_NOT_AVAILABLE });
      return;
    }

    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== "object") {
      res
        .status(400)
        .json({ message: EResponseMessage.SHOWCASE_ORDER_INVALID_BODY });
      return;
    }

    const parsedCustomer = parseCustomer(body.customer);
    if (!parsedCustomer.ok) {
      res
        .status(400)
        .json({ message: EResponseMessage.SHOWCASE_ORDER_INVALID_BODY });
      return;
    }

    const parsedLines = parseLines(body.lines);
    if (!parsedLines.ok) {
      res
        .status(400)
        .json({ message: EResponseMessage.SHOWCASE_ORDER_INVALID_BODY });
      return;
    }

    const { lines } = parsedLines;
    const totalRaw = body.total;
    if (typeof totalRaw !== "number" || !Number.isFinite(totalRaw)) {
      res
        .status(400)
        .json({ message: EResponseMessage.SHOWCASE_ORDER_INVALID_BODY });
      return;
    }

    const computedTotal = sumLinesTotal(lines);
    if (
      Math.abs(computedTotal - totalRaw) >
      SHOWCASE_PLACE_ORDER.TOTAL_EPSILON
    ) {
      res
        .status(400)
        .json({ message: EResponseMessage.SHOWCASE_ORDER_TOTAL_MISMATCH });
      return;
    }

    const dishIds = [...new Set(lines.map((l) => l.dishId))];
    const dishes = await DishEntity.find({
      id: { $in: dishIds },
      ownerId: userInfo.id,
    });
    const dishById = new Map(dishes.map((d) => [d.id, d]));

    for (const line of lines) {
      const dish = dishById.get(line.dishId);
      if (!dish) {
        res
          .status(400)
          .json({ message: EResponseMessage.SHOWCASE_ORDER_DISH_INVALID });
        return;
      }
      if (dish.isAvailable !== "available") {
        res
          .status(400)
          .json({ message: EResponseMessage.SHOWCASE_ORDER_DISH_INVALID });
        return;
      }
      if (
        Math.abs(line.unitPrice - dish.price) >
        SHOWCASE_PLACE_ORDER.PRICE_EPSILON
      ) {
        res
          .status(400)
          .json({ message: EResponseMessage.SHOWCASE_ORDER_PRICE_MISMATCH });
        return;
      }
    }

    const orderId = uuidv4();
    await ShowcaseOrderEntity.create({
      id: orderId,
      ownerId: userInfo.id,
      placeName: userInfo.placeName,
      status: EShowcaseOrderStatus.pending,
      customer: parsedCustomer.customer,
      lines,
      total: computedTotal,
    });

    res.status(201).json({ id: orderId });
  } catch (error) {
    next(error);
  }
};
