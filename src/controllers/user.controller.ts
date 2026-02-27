import { generateAccessToken, generateRefreshToken } from "@/config/jwt";
import UserEntity from "@/entities/User.entity";
import { IPlan } from "@/types/entities";
import { EPlan, EResponseMessage, EStatus } from "@/types/enums";
import bcrypt from "bcryptjs";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { EResponseMessage } from "@/types/enums";
import bcrypt from "bcryptjs";
import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, placeName } = req.body;

    if (!email || !password || !placeName) {
      res.status(400).json({ message: EResponseMessage.IS_REQUIRED });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: EResponseMessage.PASSWORD_LENGTH });
      return;
    }

    const existingUsername = await UserEntity.findOne({ placeName });
    if (existingUsername) {
      res.status(400).json({ message: EResponseMessage.PLACE_TAKEN });
      return;
    }

    const existingEmail = await UserEntity.findOne({ email });
    if (existingEmail) {
      res.status(400).json({ message: EResponseMessage.EMAIL_TAKEN });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await UserEntity.create({
      email,
      password: hashedPassword,
      placeName,
      id: uuidv4(),
    });

    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    res.status(201).json({
      message: EResponseMessage.USER_REGISTERED,
      user: {
        id: newUser.id,
        email: newUser.email,
        placeName: newUser.placeName,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await UserEntity.findOne({ email });
    if (!user) {
      res.status(400).json({ message: EResponseMessage.INVALID_CREDENTIALS });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ message: EResponseMessage.PASS_MISS_MACH });
      return;
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(200).json({
      message: EResponseMessage.USER_LOGIN,
      user: {
        id: user.id,
        email: user.email,
        placeName: user.placeName,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const checkAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({ message: EResponseMessage.TOKEN_MISSING });
      return;
    }

    jwt.verify(
      token,
      process.env.JWT_SECRET as string,
      async (err, decoded: any) => {
        if (err) {
          res.status(401).json({
            message: EResponseMessage.TOKEN_INVALID,
          });
          return;
        }

        const user = await UserEntity.findOne({ id: decoded.id });
        if (!user) {
          res.status(401).json({
            message: EResponseMessage.USER_NOT_FOUND,
          });
          return;
        }

        res.status(200).json({ user });
      }
    );
  } catch (error) {
    next(error);
  }
};

export const putFreePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
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

    let changedData;
    if (EPlan.free !== userInfo.planName) {
      changedData = await changeUserPlan(ownerID, {
        planName: EPlan.free,
        status: EStatus.complete,
      });

      if (!changedData?.success) {
        res.status(400).json({ message: changedData?.message });
        return;
      }
    }

    const user = changedData?.updated || userInfo;
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
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

    const { placeName, email } = req.body;

    if (!placeName || !email) {
      res.status(400).json({ message: EResponseMessage.IS_REQUIRED });
      return;
    }

    const userInfo = await UserEntity.findOne({ id: ownerId });
    if (!userInfo) {
      res.status(404).json({ message: EResponseMessage.USER_NOT_FOUND });
      return;
    }

    // Перевіряємо, чи placeName не зайнятий іншим користувачем
    if (placeName !== userInfo.placeName) {
      const existingPlaceName = await UserEntity.findOne({ placeName });
      if (existingPlaceName) {
        res.status(400).json({ message: EResponseMessage.PLACE_TAKEN });
        return;
      }
    }

    // Перевіряємо, чи email не зайнятий іншим користувачем
    if (email !== userInfo.email) {
      const existingEmail = await UserEntity.findOne({ email });
      if (existingEmail) {
        res.status(400).json({ message: EResponseMessage.EMAIL_TAKEN });
        return;
      }
    }

    // Оновлюємо дані користувача
    const updatedUser = await UserEntity.findOneAndUpdate(
      { id: ownerId },
      {
        placeName,
        email,
      },
      { new: true }
    );

    if (!updatedUser) {
      res.status(404).json({ message: EResponseMessage.USER_NOT_FOUND });
      return;
    }

    res.status(200).json({
      message: EResponseMessage.USER_UPDATED,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        placeName: updatedUser.placeName,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const changeUserPlan = async (userId: string, planInfo: IPlan) => {
  if (!userId) {
    return { message: EResponseMessage.INVALID_CREDENTIALS, success: false };
  }

  const updated = await UserEntity.findOneAndUpdate(
    { id: userId },
    {
      planName: planInfo.planName,
      status: planInfo.status,
      planDate: new Date(),
    },
    { new: true }
  );

  if (!updated) {
    return { message: EResponseMessage.USER_NOT_FOUND, success: false };
  }

  return { updated, success: true };
};
