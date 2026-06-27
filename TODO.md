# TODO

Known follow-up tasks, grouped by area. Keep this list current as work lands.

## User authentication

The core email + password flow (register / login / logout / `me`) is implemented
with scrypt-hashed passwords and server-side sessions delivered via an HttpOnly
cookie. Remaining work:

- [ ] **Email confirmation.** On registration, send a verification email and require
      the user to confirm their address before the account is considered active.
      Implement using the [Resend](https://resend.com) library and service
      (`resend` npm package) for transactional email delivery.
- [ ] **Password reset.** Add a "forgot password" flow: request a reset, email a
      single-use, time-limited reset link, and let the user set a new password.
      Also use the Resend library/service to send the reset email.
- [ ] Rate-limit `login` / `register` (and the future reset endpoints) to slow down
      credential-stuffing and brute-force attempts.
- [ ] Consider auto-login on `register` (issue a session immediately) for smoother UX.
- [ ] Lock down read access: `users` and `userByEmail` currently expose all accounts
      to anyone; add authorization once roles/permissions exist.
- [ ] Restrict CORS to known client origins in production (currently reflects any
      origin to support local dev).
- [ ] Session hardening: rotate tokens on privilege change and add a
      "log out everywhere" action (`SessionRepository.deleteByUser` already exists).
