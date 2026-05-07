export const FREE_PLAN_SHOWCASE_ITEMS_LIMIT = 20;

export const SHOWCASE_PLACE_ORDER = {
  MAX_LINES: 50,
  MAX_QUANTITY: 999,
  NAME_MAX: 100,
  PHONE_MAX: 32,
  EMAIL_MAX: 254,
  ADDRESS_MAX: 500,
  DELIVERY_TIME_MAX: 120,
  COMMENT_MAX: 1000,
  DISH_NAME_MAX: 200,
  CATEGORY_NAME_MAX: 120,
  TOTAL_EPSILON: 0.01,
  PRICE_EPSILON: 0.01,
} as const;

export const SHOWCASE_PLACE_ORDER_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 30,
} as const;

export const TABLE_RESERVATION = {
  NAME_MAX: 100,
  PHONE_MAX: 32,
  EMAIL_MAX: 254,
  COMMENT_MAX: 1000,
  PARTY_MIN: 1,
  PARTY_MAX: 100,
  IDEMPOTENCY_KEY_MAX: 128,
} as const;

export const TABLE_RESERVATION_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 40,
} as const;

export const CONTACT_FORM = {
  MESSAGE_MAX: 10_000,
} as const;

export const CONTACT_FORM_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 15,
} as const;
