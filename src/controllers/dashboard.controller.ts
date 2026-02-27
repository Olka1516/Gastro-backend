import cloudinary from "@/config/cloudinary";
import CategoryEntity from "@/entities/Category.entity";
import DishEntity from "@/entities/Dish.entity";
import UserEntity from "@/entities/User.entity";
import { EResponseMessage, EStatus } from "@/types/enums";
import { CloudinaryUploadResponse } from "@/types/express";
import { NextFunction, Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { checkSession } from "./stripe.controller";
import { EResponseMessage, EStatus } from "@/types/enums";
import { NextFunction, Request, Response } from "express";
import { checkSession } from "./stripe.controller";
import UserEntity from "@/entities/User.entity";
import { changeUserPlan } from "./user.controller";

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

    if (!req.user?.id) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }
    const ownerID = req.user.id;
    const userInfo = await UserEntity.findOne({ id: ownerID });
    if (!userInfo) {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    // Якщо статус вже complete, повертаємо дані без перевірки Stripe
    if (userInfo.status === EStatus.complete) {
      res.status(200).json({ user: userInfo });
      return;
    }

    // Перевіряємо Stripe сесію тільки для pending статусу
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

    let imageUrl = "";

    // Якщо є зображення - завантажуємо в Cloudinary
    if (req.files?.image) {
      const imageFile = req.files.image as UploadedFile;

      // Отримуємо Buffer з файлу
      let fileBuffer: Buffer;
      if (imageFile.tempFilePath) {
        // Якщо файл збережений в тимчасовій директорії
        fileBuffer = fs.readFileSync(imageFile.tempFilePath);
      } else {
        // Якщо файл в пам'яті
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

    // Якщо є нове зображення - завантажуємо в Cloudinary
    if (req.files?.image) {
      const imageFile = req.files.image as UploadedFile;

      // Отримуємо Buffer з файлу
      let fileBuffer: Buffer;
      if (imageFile.tempFilePath) {
        // Якщо файл збережений в тимчасовій директорії
        fileBuffer = fs.readFileSync(imageFile.tempFilePath);
      } else {
        // Якщо файл в пам'яті
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

      // Видаляємо старе зображення з Cloudinary, якщо воно існує
      if (existingDish.image) {
        try {
          // Витягуємо public_id з URL
          const publicId = existingDish.image.split("/").pop()?.split(".")[0];
          if (publicId) {
            await cloudinary.uploader.destroy(`dishes/${publicId}`);
          }
        } catch (deleteError) {
          console.error("Error deleting old image:", deleteError);
          // Не зупиняємо процес оновлення через помилку видалення старого зображення
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

    // Видаляємо зображення з Cloudinary, якщо воно існує
    if (existingDish.image) {
      try {
        // Витягуємо public_id з URL
        const publicId = existingDish.image.split("/").pop()?.split(".")[0];
        if (publicId) {
          await cloudinary.uploader.destroy(`dishes/${publicId}`);
        }
      } catch (deleteError) {
        console.error("Error deleting image from Cloudinary:", deleteError);
        // Не зупиняємо процес видалення через помилку видалення зображення
      }
    }

    // Видаляємо страву з бази даних
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

    // Якщо документ не існує, створюємо новий
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

    let categoryDoc = await CategoryEntity.findOne({ ownerId });

    // Якщо документ не існує, створюємо новий
    if (!categoryDoc) {
      categoryDoc = await CategoryEntity.create({
        id: uuidv4(),
        ownerId,
        categories: [],
      });
    }

    // Перевіряємо, чи категорія з таким ім'ям вже існує
    const existingCategory = categoryDoc.categories.find(
      (cat) => cat.name.toLowerCase() === name.toLowerCase()
    );

    if (existingCategory) {
      res.status(400).json({ message: EResponseMessage.PLACE_TAKEN });
      return;
    }

    // Додаємо нову категорію
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

    // Знаходимо категорію за id
    const categoryIndex = categoryDoc.categories.findIndex(
      (cat) => cat.id === id
    );
    if (categoryIndex === -1) {
      res.status(404).json({ message: EResponseMessage.CATEGORY_NOT_FOUND });
      return;
    }

    // Перевіряємо, чи категорія з таким ім'ям вже існує (крім поточної)
    const existingCategory = categoryDoc.categories.find(
      (cat) => cat.id !== id && cat.name.toLowerCase() === name.toLowerCase()
    );

    if (existingCategory) {
      res.status(400).json({ message: EResponseMessage.PLACE_TAKEN });
      return;
    }

    // Оновлюємо категорію
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

    // Знаходимо категорію за id
    const categoryIndex = categoryDoc.categories.findIndex(
      (cat) => cat.id === id
    );
    if (categoryIndex === -1) {
      res.status(404).json({ message: EResponseMessage.CATEGORY_NOT_FOUND });
      return;
    }

    const categoryToDelete = categoryDoc.categories[categoryIndex];

    // Перевіряємо, чи є страви, які використовують цю категорію
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

    // Видаляємо категорію з масиву
    categoryDoc.categories.splice(categoryIndex, 1);
    await categoryDoc.save();

    res.status(200).json({
      message: EResponseMessage.CATEGORY_DELETED,
    });
    let changedData;
    if (userInfo.status === EStatus.pending) {
      const checkSessionResult = await checkSession(userInfo.email);
      if (checkSessionResult !== "unpaid") {
        changedData = await changeUserPlan(ownerID, {
          planName: userInfo.planName,
          status: EStatus.complete,
        });

        if (!changedData?.success) {
          res.status(400).json({ message: changedData?.message });
          return;
        }
      }
    }

    const user = changedData?.updated || userInfo;
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};
