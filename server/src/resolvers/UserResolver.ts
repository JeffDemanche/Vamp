import { Arg, Ctx, ID, Query, Resolver } from "type-graphql";
import type { ServerContext } from "../context";
import { User } from "../entities/User";

@Resolver(() => User)
export class UserResolver {
  @Query(() => [User])
  async users(@Ctx() ctx: ServerContext): Promise<User[]> {
    return ctx.services.users.findAll();
  }

  @Query(() => User, { nullable: true })
  async user(
    @Arg("id", () => ID) id: string,
    @Ctx() ctx: ServerContext,
  ): Promise<User | null> {
    return ctx.services.users.findById(id);
  }

  @Query(() => User, { nullable: true })
  async userByEmail(
    @Arg("email") email: string,
    @Ctx() ctx: ServerContext,
  ): Promise<User | null> {
    return ctx.services.users.findByEmail(email);
  }
}
