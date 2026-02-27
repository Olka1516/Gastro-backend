export enum EResponseMessage {
  IS_REQUIRED = "requiredFields",
  PASSWORD_LENGTH = "passwordLength",
  EMAIL_TAKEN = "emailTaken",
  PLACE_TAKEN = "placeTaken",
  USER_REGISTERED = "userRegistered",
  USER_LOGIN = "userLogin",
  USER_UPDATED = "userUpdated",
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
  DISH_DELETED = "dishDeleted",
  DISH_NOT_FOUND = "dishNotFound",
  DISH_NAME_REQUIRED = "dishNameRequired",
  DISH_PRICE_REQUIRED = "dishPriceRequired",
  INVALID_PRICE = "invalidPrice",
  CATEGORY_CREATED = "categoryCreated",
  CATEGORY_UPDATED = "categoryUpdated",
  CATEGORY_DELETED = "categoryDeleted",
  CATEGORY_NOT_FOUND = "categoryNotFound",
  CATEGORY_NAME_REQUIRED = "categoryNameRequired",
  CATEGORY_IN_USE = "categoryInUse",
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
