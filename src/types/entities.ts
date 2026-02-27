export interface IUser {
  placeName: string;
  email: string;
  password: string;
  id: string;
  avatar: string | null;
}

export interface ITokenUserData extends Pick<IUser, "email" | "id"> {}
