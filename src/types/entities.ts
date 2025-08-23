export interface IUser {
  username: string;
  email: string;
  password: string;
  id: string;
  avatar: string | null;
}

export interface ITokenUserData extends Pick<IUser, "username" | "id"> {}
