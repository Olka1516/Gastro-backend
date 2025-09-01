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

export interface ITokenUserData extends Pick<IUser, "email" | "id"> {}
