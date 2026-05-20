import cloudinary from "@/config/cloudinary";
import CategoryEntity from "@/entities/Category.entity";
import DishEntity from "@/entities/Dish.entity";
import ShowcaseOrderEntity from "@/entities/ShowcaseOrder.entity";
import UserEntity from "@/entities/User.entity";
import { FREE_PLAN_SHOWCASE_ITEMS_LIMIT } from "@/types/constants";
import {
  IDish,
  IShowcaseOrderCustomer,
  IShowcaseOrderLine,
} from "@/types/entities";
import {
  EPlan,
  EResponseMessage,
  EShowcaseOrderStatus,
  EStatus,
} from "@/types/enums";
import { CloudinaryUploadResponse } from "@/types/express";
import { NextFunction, Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import {
  buildCategoryWritePayload,
  categoryItemToApi,
  ensureCategoryUkName,
  mergeCategoryTranslations,
} from "@/utils/categoryTranslations";
import {
  buildDishWritePayload,
  dishItemToApi,
  ensureDishUkFields,
  mergeDishTranslations,
} from "@/utils/dishTranslations";
import {
  checkSession,
  isCheckoutSessionInvalidated,
} from "./stripe.controller";
import { changeUserPlan } from "./user.controller";

const isFreeDishLimitReached = async (ownerId: string): Promise<boolean> => {
  const userInfo = await UserEntity.findOne({ id: ownerId });
  if (!userInfo || userInfo.planName !== EPlan.free) {
    return false;
  }

  const dishesCount = await DishEntity.countDocuments({ ownerId });
  return dishesCount >= FREE_PLAN_SHOWCASE_ITEMS_LIMIT;
};

const showcaseOrderCustomerForApi = (c: IShowcaseOrderCustomer) => ({
  firstName: c.firstName,
  lastName: c.lastName,
  phone: c.phone,
  email: c.email ?? "",
  address: c.address,
  deliveryTime: c.deliveryTime ?? "",
  comment: c.comment ?? "",
});

const SHOWCASE_ORDER_STATUS_LIST = Object.values(EShowcaseOrderStatus);

const isShowcaseOrderStatus = (
  v: string,
): v is EShowcaseOrderStatus =>
  (SHOWCASE_ORDER_STATUS_LIST as string[]).includes(v);

const showcaseOrderDocToApi = (doc: {
  id: string;
  status?: string;
  total: number;
  customer: IShowcaseOrderCustomer;
  lines: IShowcaseOrderLine[];
  createdAt?: Date;
}) => {
  const createdAtRaw = doc.createdAt;
  let createdAt: string | undefined;
  if (createdAtRaw instanceof Date) {
    createdAt = createdAtRaw.toISOString();
  }
  const statusVal = doc.status ?? "";
  const status = isShowcaseOrderStatus(statusVal)
    ? statusVal
    : EShowcaseOrderStatus.pending;

  return {
    id: doc.id,
    status,
    ...(createdAt !== undefined ? { createdAt } : {}),
    total: doc.total,
    customer: showcaseOrderCustomerForApi(doc.customer),
    lines: doc.lines,
  };
};

const isFreeCategoryLimitReached = async (
  ownerId: string,
): Promise<boolean> => {
  const userInfo = await UserEntity.findOne({ id: ownerId });
  if (!userInfo || userInfo.planName !== EPlan.free) {
    return false;
  }

  const categoryDoc = await CategoryEntity.findOne({ ownerId });
  const categoriesCount = categoryDoc?.categories?.length || 0;
  return categoriesCount >= FREE_PLAN_SHOWCASE_ITEMS_LIMIT;
};

export const getShowcaseOrdersForOwner = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const statusRaw = req.query.status;
    const statusParam =
      typeof statusRaw === "string"
        ? statusRaw.trim()
        : Array.isArray(statusRaw) && typeof statusRaw[0] === "string"
          ? statusRaw[0].trim()
          : "";

    let statusFilter: EShowcaseOrderStatus | undefined;
    if (statusParam !== "" && statusParam !== "all") {
      if (!isShowcaseOrderStatus(statusParam)) {
        res
          .status(400)
          .json({ message: EResponseMessage.SHOWCASE_ORDER_INVALID_STATUS });
        return;
      }
      statusFilter = statusParam;
    }

    const query: { ownerId: string; status?: EShowcaseOrderStatus } = {
      ownerId,
    };
    if (statusFilter !== undefined) {
      query.status = statusFilter;
    }

    const docs = await ShowcaseOrderEntity.find(query)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const orders = docs.map((doc) =>
      showcaseOrderDocToApi({
        id: doc.id as string,
        status: doc.status as string | undefined,
        total: doc.total as number,
        customer: doc.customer as IShowcaseOrderCustomer,
        lines: doc.lines as IShowcaseOrderLine[],
        createdAt: (doc as { createdAt?: Date }).createdAt,
      }),
    );

    res.status(200).json({ orders });
  } catch (error) {
    next(error);
  }
};

export const patchShowcaseOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const orderId = req.params.orderId?.trim();
    if (!orderId) {
      res.status(400).json({ message: EResponseMessage.IS_REQUIRED });
      return;
    }

    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== "object") {
      res
        .status(400)
        .json({ message: EResponseMessage.SHOWCASE_ORDER_INVALID_BODY });
      return;
    }

    const rawStatus = body.status;
    if (typeof rawStatus !== "string") {
      res
        .status(400)
        .json({ message: EResponseMessage.SHOWCASE_ORDER_INVALID_BODY });
      return;
    }

    const nextStatus = rawStatus.trim();
    if (!isShowcaseOrderStatus(nextStatus)) {
      res
        .status(400)
        .json({ message: EResponseMessage.SHOWCASE_ORDER_INVALID_STATUS });
      return;
    }

    const updated = await ShowcaseOrderEntity.findOneAndUpdate(
      { id: orderId, ownerId },
      { status: nextStatus },
      { new: true },
    )
      .lean()
      .exec();

    if (!updated) {
      res
        .status(404)
        .json({ message: EResponseMessage.SHOWCASE_ORDER_NOT_FOUND });
      return;
    }

    res.status(200).json({
      order: showcaseOrderDocToApi({
        id: updated.id as string,
        status: updated.status as string | undefined,
        total: updated.total as number,
        customer: updated.customer as IShowcaseOrderCustomer,
        lines: updated.lines as IShowcaseOrderLine[],
        createdAt: (updated as { createdAt?: Date }).createdAt,
      }),
    });
  } catch (error) {
    next(error);
  }
};

export const getDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

    if (userInfo.status === EStatus.complete) {
      res.status(200).json({ user: userInfo });
      return;
    }

    const session = await checkSession(userInfo.email, userInfo.planDate);

    if (!session) {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    if (isCheckoutSessionInvalidated(session)) {
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

    if (session.payment_status !== "paid") {
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
    } else {
      const changeResult = await changeUserPlan(ownerID, {
        planName: userInfo.planName,
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
  next: NextFunction,
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const userInfo = await UserEntity.findOne({ id: ownerId });
    if (!userInfo) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const writeResult = buildDishWritePayload(userInfo.planName, req.body);
    if (!writeResult.ok) {
      res.status(writeResult.status).json({ message: writeResult.message });
      return;
    }

    const {
      name,
      description,
      translations,
      persistTranslations,
    } = writeResult.payload;

    const { price, category, isAvailable } = req.body;

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
              },
            )
            .end(fileBuffer);
        },
      );

      imageUrl = uploadResult.secure_url;
    }

    const dishData: IDish = {
      id: uuidv4(),
      name,
      description,
      price: Number(price),
      category,
      isAvailable: isAvailable || "available",
      image: imageUrl,
      ownerId,
    };

    if (persistTranslations && translations) {
      dishData.translations = ensureDishUkFields(
        translations,
        name,
        description,
      );
    }

    const newDish = await DishEntity.create(dishData);

    res.status(201).json({
      message: EResponseMessage.DISH_CREATED,
      dish: dishItemToApi(newDish),
    });
  } catch (error) {
    next(error);
  }
};

export const updateDish = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const { dishId } = req.params;
    const { price, category, isAvailable } = req.body;

    if (!dishId) {
      res.status(400).json({ message: EResponseMessage.IS_REQUIRED });
      return;
    }

    const userInfo = await UserEntity.findOne({ id: ownerId });
    if (!userInfo) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const existingDish = await DishEntity.findOne({ id: dishId, ownerId });
    if (!existingDish) {
      res.status(404).json({ message: EResponseMessage.DISH_NOT_FOUND });
      return;
    }

    const hasTranslationsPayload =
      req.body.translations !== undefined && req.body.translations !== null;
    const hasNameOrDescPayload =
      req.body.name !== undefined || req.body.description !== undefined;

    let resolvedName = existingDish.name;
    let resolvedDescription = existingDish.description;

    if (hasTranslationsPayload) {
      const writeResult = buildDishWritePayload(userInfo.planName, {
        name: req.body.name ?? existingDish.name,
        description:
          req.body.description !== undefined
            ? req.body.description
            : existingDish.description,
        translations: req.body.translations,
      });
      if (!writeResult.ok) {
        res.status(writeResult.status).json({ message: writeResult.message });
        return;
      }
      resolvedName = writeResult.payload.name;
      if (writeResult.payload.description !== undefined) {
        resolvedDescription = writeResult.payload.description;
      }

      if (writeResult.payload.persistTranslations && writeResult.payload.translations) {
        const merged = mergeDishTranslations(
          existingDish.translations,
          writeResult.payload.translations,
        );
        existingDish.translations = ensureDishUkFields(
          merged,
          resolvedName,
          resolvedDescription,
        );
      }
    } else if (hasNameOrDescPayload) {
      if (req.body.name !== undefined) {
        if (typeof req.body.name !== "string" || !req.body.name.trim()) {
          res.status(400).json({ message: EResponseMessage.DISH_NAME_REQUIRED });
          return;
        }
        resolvedName = req.body.name.trim();
      }
      if (req.body.description !== undefined) {
        resolvedDescription =
          typeof req.body.description === "string" &&
          req.body.description.trim()
            ? req.body.description.trim()
            : undefined;
      }
      if (existingDish.translations) {
        existingDish.translations = ensureDishUkFields(
          existingDish.translations,
          resolvedName,
          resolvedDescription,
        );
      }
    }

    const hasNameOrDescOrTranslations =
      hasTranslationsPayload || hasNameOrDescPayload;

    if (price !== undefined && price < 0) {
      res.status(400).json({ message: EResponseMessage.INVALID_PRICE });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (hasNameOrDescOrTranslations) {
      updateData.name = resolvedName;
      updateData.description = resolvedDescription;
      if (existingDish.translations) {
        updateData.translations = existingDish.translations;
      }
    }
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
              },
            )
            .end(fileBuffer);
        },
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
      { new: true },
    );

    res.status(200).json({
      message: EResponseMessage.DISH_UPDATED,
      dish: updatedDish ? dishItemToApi(updatedDish) : null,
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
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const dishes = await DishEntity.find({ ownerId }).sort({ createdAt: -1 });

    res.status(200).json({
      dishes: dishes.map((dish) => dishItemToApi(dish)),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDish = async (
  req: Request,
  res: Response,
  next: NextFunction,
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
  next: NextFunction,
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
      categories: categoryDoc.categories.map((cat) => categoryItemToApi(cat)),
    });
  } catch (error) {
    next(error);
  }
};

export const addCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const userInfo = await UserEntity.findOne({ id: ownerId });
    if (!userInfo) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const writeResult = buildCategoryWritePayload(userInfo.planName, req.body);
    if (!writeResult.ok) {
      res.status(writeResult.status).json({ message: writeResult.message });
      return;
    }

    const { name, translations, persistTranslations } = writeResult.payload;

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
      (cat) => cat.name.toLowerCase() === name.toLowerCase(),
    );

    if (existingCategory) {
      res.status(400).json({ message: EResponseMessage.PLACE_TAKEN });
      return;
    }

    const newCategory: {
      id: string;
      name: string;
      translations?: typeof translations;
    } = {
      id: uuidv4(),
      name,
    };

    if (persistTranslations && translations) {
      newCategory.translations = ensureCategoryUkName(translations, name);
    }

    categoryDoc.categories.push(newCategory);
    await categoryDoc.save();

    res.status(201).json({
      message: EResponseMessage.CATEGORY_CREATED,
      category: categoryItemToApi(newCategory),
    });
  } catch (error) {
    next(error);
  }
};

export const editCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

    const userInfo = await UserEntity.findOne({ id: ownerId });
    if (!userInfo) {
      res.status(401).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const writeResult = buildCategoryWritePayload(userInfo.planName, req.body);
    if (!writeResult.ok) {
      res.status(writeResult.status).json({ message: writeResult.message });
      return;
    }

    const { name, translations, persistTranslations } = writeResult.payload;

    const categoryDoc = await CategoryEntity.findOne({ ownerId });
    if (!categoryDoc) {
      res.status(404).json({ message: EResponseMessage.CATEGORY_NOT_FOUND });
      return;
    }

    const categoryIndex = categoryDoc.categories.findIndex(
      (cat) => cat.id === id,
    );
    if (categoryIndex === -1) {
      res.status(404).json({ message: EResponseMessage.CATEGORY_NOT_FOUND });
      return;
    }

    const existingCategory = categoryDoc.categories.find(
      (cat) => cat.id !== id && cat.name.toLowerCase() === name.toLowerCase(),
    );

    if (existingCategory) {
      res.status(400).json({ message: EResponseMessage.PLACE_TAKEN });
      return;
    }

    categoryDoc.categories[categoryIndex].name = name;
    if (persistTranslations && translations) {
      categoryDoc.categories[categoryIndex].translations = ensureCategoryUkName(
        mergeCategoryTranslations(
          categoryDoc.categories[categoryIndex].translations,
          translations,
        ),
        name,
      );
    } else {
      const existingTranslations =
        categoryDoc.categories[categoryIndex].translations;
      if (existingTranslations) {
        categoryDoc.categories[categoryIndex].translations = ensureCategoryUkName(
          existingTranslations,
          name,
        );
      }
    }
    await categoryDoc.save();

    res.status(200).json({
      message: EResponseMessage.CATEGORY_UPDATED,
      category: categoryItemToApi(categoryDoc.categories[categoryIndex]),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
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
      (cat) => cat.id === id,
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
