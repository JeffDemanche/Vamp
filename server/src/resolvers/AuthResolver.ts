import { IsEmail, MaxLength, MinLength } from "class-validator";
import { Arg, Ctx, Field, InputType, Mutation, Query, Resolver } from "type-graphql";
import { config } from "../config";
import type { ServerContext } from "../context";
import { User } from "../entities/User";

@InputType()
export class RegisterInput {
  @Field()
  @MinLength(2)
  @MaxLength(50)
  username!: string;

  @Field()
  @IsEmail()
  email!: string;

  @Field()
  // Lower bound follows current NIST guidance; the upper bound caps the work
  // done by the (deliberately slow) password hash to avoid a DoS vector.
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}

@InputType()
export class LoginInput {
  @Field()
  @IsEmail()
  email!: string;

  @Field()
  password!: string;
}

/**
 * Email + password authentication. `register` creates an account, `login`
 * begins a server-side session (delivered as an HttpOnly cookie), `logout`
 * ends it, and `me` returns the currently authenticated user.
 *
 * Cookie handling lives here in the API layer; the {@link AuthService} owns the
 * credential and session logic and never knows about HTTP.
 */
@Resolver(() => User)
export class AuthResolver {
  @Query(() => User, { nullable: true })
  async me(@Ctx() ctx: ServerContext): Promise<User | null> {
    return ctx.currentUser ?? null;
  }

  @Mutation(() => User)
  async register(
    @Arg("input") input: RegisterInput,
    @Ctx() ctx: ServerContext,
  ): Promise<User> {
    return ctx.services.auth.register({
      username: input.username,
      email: input.email,
      password: input.password,
    });
  }

  @Mutation(() => User)
  async login(
    @Arg("input") input: LoginInput,
    @Ctx() ctx: ServerContext,
  ): Promise<User> {
    const { user, token, expiresAt } = await ctx.services.auth.login({
      email: input.email,
      password: input.password,
    });

    ctx.res?.cookie(config.auth.cookieName, token, {
      httpOnly: true,
      secure: config.auth.cookieSecure,
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
    });

    return user;
  }

  @Mutation(() => Boolean)
  async logout(@Ctx() ctx: ServerContext): Promise<boolean> {
    await ctx.services.auth.logout(ctx.sessionToken);
    ctx.res?.clearCookie(config.auth.cookieName, {
      httpOnly: true,
      secure: config.auth.cookieSecure,
      sameSite: "lax",
      path: "/",
    });
    return true;
  }
}
