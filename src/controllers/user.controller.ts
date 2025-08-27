import { generateAccessToken, generateRefreshToken } from "@/config/jwt";
import UserEntity from "@/entities/User.entity";
import { EResponseMessage } from "@/types/enums";
import bcrypt from "bcryptjs";
import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";

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
    console.log("here");
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
