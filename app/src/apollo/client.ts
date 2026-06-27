import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

const DEFAULT_URI = "http://localhost:4000/graphql";

export function createApolloClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: import.meta.env.VITE_GRAPHQL_URI ?? DEFAULT_URI,
      // Send the HttpOnly session cookie on every request so the server can
      // authenticate the user (see the `me` query and auth mutations).
      credentials: "include",
    }),
    cache: new InMemoryCache(),
  });
}
