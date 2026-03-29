import cloudinary from "@/config/cloudinary";
import CategoryEntity from "@/entities/Category.entity";
import DishEntity from "@/entities/Dish.entity";
import UserEntity from "@/entities/User.entity";
import { FREE_PLAN_SHOWCASE_ITEMS_LIMIT } from "@/types/constants";
import { EPlan, EResponseMessage, EStatus } from "@/types/enums";
import { CloudinaryUploadResponse } from "@/types/express";
import { NextFunction, Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { checkSession } from "./stripe.controller";
import { changeUserPlan } from "./user.controller";

const isFreeDishLimitReached = async (ownerId: string): Promise<boolean> => {
  const userInfo = await UserEntity.findOne({ id: ownerId });
  if (!userInfo || userInfo.planName !== EPlan.free) {
    return false;
  }

  const dishesCount = await DishEntity.countDocuments({ ownerId });
  return dishesCount >= FREE_PLAN_SHOWCASE_ITEMS_LIMIT;
};

const isFreeCategoryLimitReached = async (ownerId: string): Promise<boolean> => {
  const userInfo = await UserEntity.findOne({ id: ownerId });
  if (!userInfo || userInfo.planName !== EPlan.free) {
    return false;
  }

  const categoryDoc = await CategoryEntity.findOne({ ownerId });
  const categoriesCount = categoryDoc?.categories?.length || 0;
  return categoriesCount >= FREE_PLAN_SHOWCASE_ITEMS_LIMIT;
};

export const getDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerID = req.user?.id;
    if (!ownerID) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const userInfo = await UserEntity.findOne({ id: ownerID });
    if (!userInfo) {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    if (userInfo.planName === EPlan.free && userInfo.status !== EStatus.complete) {
      const changeResult = await changeUserPlan(ownerID, {
        planName: EPlan.free,
        status: EStatus.complete,
      });

      if (!changeResult?.success || !changeResult.updated) {
        res.status(400).json({ message: changeResult?.message });
        return;
      }

      res.status(200).json({ user: changeResult.updated });
      return;
    }

    if (userInfo.status === EStatus.complete) {
      res.status(200).json({ user: userInfo });
      return;
    }

    const session = await checkSession(userInfo.email);

    if (!session || session.payment_status === "unpaid") {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    let updatedUser = userInfo;
    if (session.metadata?.plan && session.metadata.plan !== userInfo.planName) {
      const changeResult = await changeUserPlan(ownerID, {
        planName: session.metadata.plan,
        status: EStatus.complete,
      });

      if (!changeResult?.success || !changeResult.updated) {
        res.status(400).json({ message: changeResult?.message });
        return;
      }

      updatedUser = changeResult.updated;
    }

    res.status(200).json({ user: updatedUser });
  } catch (error) {
    next(error);
  }
};

export const createDish = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const { name, description, price, category, isAvailable } = req.body;

    if (!name) {
      res.status(400).json({ message: EResponseMessage.DISH_NAME_REQUIRED });
      return;
    }

    if (!price && price !== 0) {
      res.status(400).json({ message: EResponseMessage.DISH_PRICE_REQUIRED });
      return;
    }

    if (price < 0) {
      res.status(400).json({ message: EResponseMessage.INVALID_PRICE });
      return;
    }

    if (await isFreeDishLimitReached(ownerId)) {
      res.status(400).json({ message: EResponseMessage.FREE_PLAN_ITEMS_LIMIT });
      return;
    }

    let imageUrl = "";

    if (req.files?.image) {
      const imageFile = req.files.image as UploadedFile;

      let fileBuffer: Buffer;
      if (imageFile.tempFilePath) {
        fileBuffer = fs.readFileSync(imageFile.tempFilePath);
      } else {
        fileBuffer = imageFile.data as Buffer;
      }

      const uploadResult = await new Promise<CloudinaryUploadResponse>(
        (resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                folder: "dishes",
                transformation: [
                  { width: 800, height: 600, crop: "limit" },
                  { quality: "auto" },
                ],
              },
              (error, uploadResult) => {
                if (error) {
                  reject(error);
                } else {
                  resolve(uploadResult as CloudinaryUploadResponse);
                }
              }
            )
            .end(fileBuffer);
        }
      );

      imageUrl = uploadResult.secure_url;
    }

    const newDish = await DishEntity.create({
      id: uuidv4(),
      name,
      description,
      price: Number(price),
      category,
      isAvailable: isAvailable || "available",
      image: imageUrl,
      ownerId,
    });

    res.status(201).json({
      message: EResponseMessage.DISH_CREATED,
      dish: newDish,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDish = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const { dishId } = req.params;
    const { name, description, price, category, isAvailable } = req.body;

    if (!dishId) {
      res.status(400).json({ message: EResponseMessage.IS_REQUIRED });
      return;
    }

    const existingDish = await DishEntity.findOne({ id: dishId, ownerId });
    if (!existingDish) {
      res.status(404).json({ message: EResponseMessage.DISH_NOT_FOUND });
      return;
    }

    if (price !== undefined && price < 0) {
      res.status(400).json({ message: EResponseMessage.INVALID_PRICE });
      return;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = Number(price);
    if (category !== undefined) updateData.category = category;
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;

    if (req.files?.image) {
      const imageFile = req.files.image as UploadedFile;

      let fileBuffer: Buffer;
      if (imageFile.tempFilePath) {
        fileBuffer = fs.readFileSync(imageFile.tempFilePath);
      } else {
        fileBuffer = imageFile.data as Buffer;
      }

      const imageUpload = await new Promise<CloudinaryUploadResponse>(
        (resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                folder: "dishes",
                transformation: [
                  { width: 800, height: 600, crop: "limit" },
                  { quality: "auto" },
                ],
              },
              (error, uploadResult) => {
                if (error) {
                  reject(error);
                } else {
                  resolve(uploadResult as CloudinaryUploadResponse);
                }
              }
            )
            .end(fileBuffer);
        }
      );

      updateData.image = imageUpload.secure_url;

      if (existingDish.image) {
        try {
          const publicId = existingDish.image.split("/").pop()?.split(".")[0];
          if (publicId) {
            await cloudinary.uploader.destroy(`dishes/${publicId}`);
          }
        } catch (deleteError) {
          console.error("Error deleting old image:", deleteError);
        }
      }
    }

    const updatedDish = await DishEntity.findOneAndUpdate(
      { id: dishId, ownerId },
      updateData,
      { new: true }
    );

    res.status(200).json({
      message: EResponseMessage.DISH_UPDATED,
      dish: updatedDish,
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
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const dishes = await DishEntity.find({ ownerId }).sort({ createdAt: -1 });

    res.status(200).json({
      dishes,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDish = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const { dishId } = req.params;

    if (!dishId) {
      res.status(400).json({ message: EResponseMessage.IS_REQUIRED });
      return;
    }

    const existingDish = await DishEntity.findOne({ id: dishId, ownerId });
    if (!existingDish) {
      res.status(404).json({ message: EResponseMessage.DISH_NOT_FOUND });
      return;
    }

    if (existingDish.image) {
      try {
        const publicId = existingDish.image.split("/").pop()?.split(".")[0];
        if (publicId) {
          await cloudinary.uploader.destroy(`dishes/${publicId}`);
        }
      } catch (deleteError) {
        console.error("Error deleting image from Cloudinary:", deleteError);
      }
    }

    await DishEntity.findOneAndDelete({ id: dishId, ownerId });

    res.status(200).json({
      message: EResponseMessage.DISH_DELETED,
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
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    let categoryDoc = await CategoryEntity.findOne({ ownerId });

    if (!categoryDoc) {
      categoryDoc = await CategoryEntity.create({
        id: uuidv4(),
        ownerId,
        categories: [],
      });
    }

    res.status(200).json({
      categories: categoryDoc.categories,
    });
  } catch (error) {
    next(error);
  }
};

export const addCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const { name } = req.body;

    if (!name) {
      res
        .status(400)
        .json({ message: EResponseMessage.CATEGORY_NAME_REQUIRED });
      return;
    }

    if (await isFreeCategoryLimitReached(ownerId)) {
      res.status(400).json({ message: EResponseMessage.FREE_PLAN_ITEMS_LIMIT });
      return;
    }

    let categoryDoc = await CategoryEntity.findOne({ ownerId });

    if (!categoryDoc) {
      categoryDoc = await CategoryEntity.create({
        id: uuidv4(),
        ownerId,
        categories: [],
      });
    }

    const existingCategory = categoryDoc.categories.find(
      (cat) => cat.name.toLowerCase() === name.toLowerCase()
    );

    if (existingCategory) {
      res.status(400).json({ message: EResponseMessage.PLACE_TAKEN });
      return;
    }

    const newCategory = {
      id: uuidv4(),
      name,
    };

    categoryDoc.categories.push(newCategory);
    await categoryDoc.save();

    res.status(201).json({
      message: EResponseMessage.CATEGORY_CREATED,
      category: newCategory,
    });
  } catch (error) {
    next(error);
  }
};

export const editCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const { id } = req.params;
    const { name } = req.body;

    if (!id) {
      res.status(400).json({ message: EResponseMessage.IS_REQUIRED });
      return;
    }

    if (!name) {
      res
        .status(400)
        .json({ message: EResponseMessage.CATEGORY_NAME_REQUIRED });
      return;
    }

    const categoryDoc = await CategoryEntity.findOne({ ownerId });
    if (!categoryDoc) {
      res.status(404).json({ message: EResponseMessage.CATEGORY_NOT_FOUND });
      return;
    }

    const categoryIndex = categoryDoc.categories.findIndex(
      (cat) => cat.id === id
    );
    if (categoryIndex === -1) {
      res.status(404).json({ message: EResponseMessage.CATEGORY_NOT_FOUND });
      return;
    }

    const existingCategory = categoryDoc.categories.find(
      (cat) => cat.id !== id && cat.name.toLowerCase() === name.toLowerCase()
    );

    if (existingCategory) {
      res.status(400).json({ message: EResponseMessage.PLACE_TAKEN });
      return;
    }

    categoryDoc.categories[categoryIndex].name = name;
    await categoryDoc.save();

    res.status(200).json({
      message: EResponseMessage.CATEGORY_UPDATED,
      category: categoryDoc.categories[categoryIndex],
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({ message: EResponseMessage.IS_REQUIRED });
      return;
    }

    const categoryDoc = await CategoryEntity.findOne({ ownerId });
    if (!categoryDoc) {
      res.status(404).json({ message: EResponseMessage.CATEGORY_NOT_FOUND });
      return;
    }

    const categoryIndex = categoryDoc.categories.findIndex(
      (cat) => cat.id === id
    );
    if (categoryIndex === -1) {
      res.status(404).json({ message: EResponseMessage.CATEGORY_NOT_FOUND });
      return;
    }

    const categoryToDelete = categoryDoc.categories[categoryIndex];

    const dishesWithCategory = await DishEntity.find({
      ownerId,
      category: categoryToDelete.id,
    });

    if (dishesWithCategory.length > 0) {
      res.status(400).json({
        message: EResponseMessage.CATEGORY_IN_USE,
      });
      return;
    }

    categoryDoc.categories.splice(categoryIndex, 1);
    await categoryDoc.save();

    res.status(200).json({
      message: EResponseMessage.CATEGORY_DELETED,
    });
  } catch (error) {
    next(error);
  }
};
