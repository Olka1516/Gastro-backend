import { generateAccessToken } from "@/config/jwt";
import { ITokenUserData } from "@/types/entities";
import { EResponseMessage } from "@/types/enums";
import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export const refreshAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ message: EResponseMessage.TOKEN_REQUIRED });
      return;
    }

    jwt.verify(
      refreshToken,
      process.env.JWT_SECRET!,
      (
        err: jwt.VerifyErrors | null,
        decoded: JwtPayload | string | undefined
      ) => {
        if (err) {
          res.status(401).json({ message: EResponseMessage.INVALID_TOKEN });
          return;
        }

        const newAccessToken = generateAccessToken({
          id: (decoded as ITokenUserData).id,
          username: (decoded as ITokenUserData).username,
        });

        res.status(200).json({
          message: EResponseMessage.TOKEN_REFRESHED,
          accessToken: newAccessToken,
        });
      }
    );
  } catch (error) {
    next(error);
  }
};
