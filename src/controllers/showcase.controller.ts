import CategoryEntity from "@/entities/Category.entity";
import DishEntity from "@/entities/Dish.entity";
import UserEntity from "@/entities/User.entity";
import { FREE_PLAN_SHOWCASE_ITEMS_LIMIT } from "@/types/constants";
import { EPlan, EResponseMessage, EStatus } from "@/types/enums";
import { NextFunction, Request, Response } from "express";
import { checkSession } from "./stripe.controller";

export const getPlanStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawPlaceName = req.params.placeName;
    const placeName = rawPlaceName ? decodeURIComponent(rawPlaceName).trim() : "";


    if (!placeName) {
      res.status(400).json({ message: EResponseMessage.IS_REQUIRED });
      return;
    }

    const userInfo = await UserEntity.findOne({ placeName });
    if (!userInfo) {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    if (userInfo.planName === EPlan.free || userInfo.status === EStatus.complete) {
      res.status(200).json({
        status: true,
        planName: userInfo.planName,
        placeName,
      });
      return;
    }

    const session = await checkSession(userInfo.email);
    if (!session || session.payment_status === "unpaid") {
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

export const getDishes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawPlaceName = req.params.placeName;
    const placeName = rawPlaceName ? decodeURIComponent(rawPlaceName).trim() : "";
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
      dishes,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawPlaceName = req.params.placeName;
    const placeName = rawPlaceName ? decodeURIComponent(rawPlaceName).trim() : "";
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

    const categories =
      userInfo.planName === EPlan.free
        ? categoryDoc.categories.slice(0, FREE_PLAN_SHOWCASE_ITEMS_LIMIT)
        : categoryDoc.categories;

    res.status(200).json({
      categories,
    });
  } catch (error) {
    next(error);
  }
};
