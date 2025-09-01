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
