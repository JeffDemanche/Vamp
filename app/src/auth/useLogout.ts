import { useMutation } from "@apollo/client/react";
import { LogoutMutation, MeQuery } from "./queries";

/**
 * Ends the current session via the `logout` mutation and clears the cached `me`
 * user so route guards immediately treat the visitor as signed out. Navigation
 * after logout is left to the caller.
 */
export function useLogout() {
  const [logout, { loading }] = useMutation(LogoutMutation, {
    update(cache) {
      cache.writeQuery({ query: MeQuery, data: { me: null } });
    },
  });

  return { logout, loading };
}
