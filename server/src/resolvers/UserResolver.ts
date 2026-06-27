import { IsEmail, MinLength } from "class-validator";
import { Arg, Ctx, Field, ID, InputType, Mutation, Query, Resolver } from "type-graphql";
import type { ServerContext } from "../context";
import { User } from "../entities/User";

@InputType()
export class CreateUserInput {
  @Field()
  @MinLength(2)
  username!: string;

  @Field()
  @IsEmail()
  email!: string;
}

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

  @Mutation(() => User)
  async createUser(
    @Arg("input") input: CreateUserInput,
    @Ctx() ctx: ServerContext,
  ): Promise<User> {
    return ctx.services.users.create({
      username: input.username,
      email: input.email,
    });
  }
}
