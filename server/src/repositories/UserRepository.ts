import { User, UserModel } from "../entities/User";

export interface CreateUserData {
  username: string;
  email: string;
}

/**
 * Data-access layer for {@link User}. The repository is the only place that
 * touches the Typegoose model; services and resolvers depend on this instead
 * of `UserModel` directly.
 */
export class UserRepository {
  findAll(): Promise<User[]> {
    return UserModel.find().sort({ createdAt: -1 }).lean<User[]>().exec();
  }

  findById(id: string): Promise<User | null> {
    return UserModel.findById(id).lean<User>().exec();
  }

  findByEmail(email: string): Promise<User | null> {
    return UserModel.findOne({ email }).lean<User>().exec();
  }

  findByIds(ids: readonly string[]): Promise<User[]> {
    return UserModel.find({ _id: { $in: ids } }).lean<User[]>().exec();
  }

  async create(data: CreateUserData): Promise<User> {
    const doc = await UserModel.create(data);
    return doc.toObject<User>();
  }
}
