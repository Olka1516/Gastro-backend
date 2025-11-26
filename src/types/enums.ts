export enum EResponseMessage {
  IS_REQUIRED = "requiredFields",
  PASSWORD_LENGTH = "passwordLength",
  EMAIL_TAKEN = "emailTaken",
  PLACE_TAKEN = "placeTaken",
  USER_REGISTERED = "userRegistered",
  USER_LOGIN = "userLogin",
  INVALID_CREDENTIALS = "invalidCredentials",
  PASS_MISS_MACH = "passMissMatch",
  USER_NOT_FOUND = "userNotFound",
  TOKEN_REQUIRED = "tokenRequired",
  INVALID_TOKEN = "invalidToken",
  TOKEN_REFRESHED = "tokenRefreshed",
  SERVER_ERROR = "serverError",
  TOKEN_MISSING = "tockenMissing",
  TOKEN_INVALID = "tockenInvalid",
  DISH_CREATED = "dishCreated",
  DISH_UPDATED = "dishUpdated",
  DISH_NOT_FOUND = "dishNotFound",
  DISH_NAME_REQUIRED = "dishNameRequired",
  DISH_PRICE_REQUIRED = "dishPriceRequired",
  INVALID_PRICE = "invalidPrice",
}

export enum EPlan {
  free = "free",
  standart = "standart",
  premium = "premium",
}

export enum EStatus {
  pending = "pending",
  complete = "complete",
  error = "error",
  cancelled = "cancelled",
}
