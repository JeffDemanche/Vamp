import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

const DEFAULT_URI = "http://localhost:4000/graphql";

export function createApolloClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: import.meta.env.VITE_GRAPHQL_URI ?? DEFAULT_URI,
    }),
    cache: new InMemoryCache(),
  });
}
