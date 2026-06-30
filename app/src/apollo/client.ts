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
    cache: new InMemoryCache({
      typePolicies: {
        ProjectData: {
          fields: {
            // The server returns the complete `tracks`/`clips` arrays on every
            // read and on mutations that change them (createTrack/deleteTrack,
            // createClip), so the incoming list is always authoritative. Replace
            // rather than merge — this also silences Apollo's "cache data may be
            // lost when replacing the … field" warning, which fires when an
            // array of normalized objects shrinks (e.g. deleting a track).
            tracks: { merge: false },
            clips: { merge: false },
          },
        },
      },
    }),
  });
}
