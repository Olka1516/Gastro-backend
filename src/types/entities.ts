export interface IUser {
  placeName: string;
  planName: string;
  planDate: Date;
  status: string;
  email: string;
  password: string;
  id: string;
  menuIconColor?: string;
  logo?: string;
  menuBackgroundColor?: string;
  menuDishLayout?: string;
}

export interface IUpdatedUser {
  placeName: string;
  email: string;
  menuIconColor?: string;
  menuBackgroundColor?: string;
  menuDishLayout?: string;
  logo?: string;
}

export interface IPlan {
  planName: string;
  status: string;
}

export interface IDish {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  isAvailable: string;
  image?: string;
  ownerId: string;
}

export interface ICategoryItem {
  id: string;
  name: string;
}

export interface ICategory {
  id: string;
  ownerId: string;
  categories: ICategoryItem[];
}

export interface ITokenUserData extends Pick<IUser, "email" | "id"> { }

export interface IShowcaseOrderLine {
  dishId: string;
  quantity: number;
  unitPrice: number;
  name: string;
  categoryName: string;
}

export interface IShowcaseOrderCustomer {
  firstName: string;
  lastName: string;
  phone: string;
  /** May be omitted on input; stored as "" if empty. */
  email?: string;
  address: string;
  deliveryTime?: string;
  comment?: string;
}

export interface IShowcaseOrder {
  id: string;
  ownerId: string;
  placeName: string;
  status: string;
  customer: IShowcaseOrderCustomer;
  lines: IShowcaseOrderLine[];
  total: number;
}

/** Stored table reservation (Mongoose). */
export interface ITableReservationDoc {
  id: string;
  ownerId: string;
  placeName: string;
  status: string;
  visitDate: string;
  visitTime: string;
  partySize: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  comment: string;
  idempotencyKey?: string;
  venueTimeZone?: string;
}

/** API shape for dashboard list / PATCH response. */
export interface ITableReservation {
  id: string;
  createdAt: string;
  status: string;
  visitDate: string;
  visitTime: string;
  partySize: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  comment: string;
}
