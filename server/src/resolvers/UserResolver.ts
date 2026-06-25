import { IsEmail, MinLength } from "class-validator";
import { Arg, Field, ID, InputType, Mutation, Query, Resolver } from "type-graphql";
import { User, UserModel } from "../entities/User";

@InputType()
export class CreateUserInput {
  @Field()
  @MinLength(2)
  name!: string;

  @Field()
  @IsEmail()
  email!: string;
}

@Resolver(() => User)
export class UserResolver {
  @Query(() => [User])
  async users(): Promise<User[]> {
    return UserModel.find().sort({ createdAt: -1 }).exec();
  }

  @Query(() => User, { nullable: true })
  async user(@Arg("id", () => ID) id: string): Promise<User | null> {
    return UserModel.findById(id).exec();
  }

  @Mutation(() => User)
  async createUser(@Arg("input") input: CreateUserInput): Promise<User> {
    return UserModel.create({ name: input.name, email: input.email });
  }
}
