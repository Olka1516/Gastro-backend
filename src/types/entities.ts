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
}

export interface IUpdatedUser {
  placeName: string;
  email: string;
  menuIconColor?: string;
  menuBackgroundColor?: string;
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
