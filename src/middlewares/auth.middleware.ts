import { ITokenUserData } from "@/types/entities";
import { EResponseMessage } from "@/types/enums";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ message: EResponseMessage.TOKEN_REQUIRED });
      return;
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
      if (err) {
        res.status(401).json({ message: EResponseMessage.INVALID_TOKEN });
        return;
      }
      req.user = decoded as ITokenUserData;
      next();
    });
  } catch (error) {
    res.status(500).json({ message: EResponseMessage.SERVER_ERROR });
  }
};

export default authMiddleware;
