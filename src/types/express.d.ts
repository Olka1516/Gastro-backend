import { ITokenUserData } from "./entities";

declare global {
  namespace Express {
    interface Request {
      user?: ITokenUserData;
    }
  }
}
