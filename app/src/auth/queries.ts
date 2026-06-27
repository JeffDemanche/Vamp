import { graphql } from "../generated";

/** The currently authenticated user, or null when signed out. */
export const MeQuery = graphql(`
  query Me {
    me {
      _id
      username
      email
    }
  }
`);

export const LoginMutation = graphql(`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      _id
      username
      email
    }
  }
`);

export const RegisterMutation = graphql(`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      _id
      username
      email
    }
  }
`);

export const LogoutMutation = graphql(`
  mutation Logout {
    logout
  }
`);
