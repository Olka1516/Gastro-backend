import { ITokenUserData } from "@/types/entities";
import jwt from "jsonwebtoken";

export const generateAccessToken = (user: ITokenUserData) => {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRATION! }
  );
};

export const generateRefreshToken = (user: ITokenUserData) => {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRATION! }
  );
};
