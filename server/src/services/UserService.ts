import type { User } from "../entities/User";
import type { CreateUserData, UserRepository } from "../repositories/UserRepository";

/**
 * Business logic for {@link User}. Depends on the repository layer, never on
 * the Typegoose model directly.
 */
export class UserService {
  constructor(private readonly users: UserRepository) {}

  findAll(): Promise<User[]> {
    return this.users.findAll();
  }

  findById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email.trim().toLowerCase());
  }

  findByIds(ids: readonly string[]): Promise<User[]> {
    return this.users.findByIds(ids);
  }

  create(data: CreateUserData): Promise<User> {
    return this.users.create(data);
  }
}
