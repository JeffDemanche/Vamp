import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

// In production the API is served from the same origin as the SPA (the Express
// server serves both), so default to a same-origin relative path. In dev the
// Vite server and API run on separate ports, so point at the API directly.
const DEFAULT_URI = import.meta.env.PROD
  ? "/graphql"
  : "http://localhost:4000/graphql";

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
