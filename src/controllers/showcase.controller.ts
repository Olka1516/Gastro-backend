import UserEntity from "@/entities/User.entity";
import { EResponseMessage } from "@/types/enums";
import { NextFunction, Request, Response } from "express";
import { checkSession } from "./stripe.controller";
import DishEntity from "@/entities/Dish.entity";
import CategoryEntity from "@/entities/Category.entity";

export const getPlanStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { placeName } = req.params;

    const userInfo = await UserEntity.findOne({ placeName });
    if (!userInfo) {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
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
    const { placeName } = req.params;
    if (!placeName) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const userInfo = await UserEntity.findOne({ placeName });
    if (!userInfo) {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const dishes = await DishEntity.find({
      ownerId: userInfo.id,
      isAvailable: "available",
    }).sort({
      createdAt: -1,
    });

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
    const { placeName } = req.params;
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
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    res.status(200).json({
      categories: categoryDoc.categories,
    });
  } catch (error) {
    next(error);
  }
};
