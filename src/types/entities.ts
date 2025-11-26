export interface IUser {
  placeName: string;
  planName: string;
  planDate: Date;
  status: string;
  email: string;
  password: string;
  id: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface ITokenUserData extends Pick<IUser, "email" | "id"> {}
