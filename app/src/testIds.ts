/**
 * Single source of truth for `data-testid` values used across the client.
 *
 * Constants are grouped by the React component that renders the element, so a
 * value's access path names both the owning component and the element it marks
 * (e.g. `testIds.LoginView.submit`). This file is consumed both by the
 * components themselves (rendering the attribute) and by the Playwright Page
 * Object Models in `app/e2e/` (locating it) — change an id here and both sides
 * stay in lockstep.
 *
 * `as const` keeps each value a string-literal type.
 */
export const testIds = {
  /** `LandingView` — public landing screen at `/`. */
  LandingView: {
    root: "landing-view",
    error: "error",
    userList: "user-list",
  },
  /** `RegisterView` — registration form at `/register`. */
  RegisterView: {
    form: "register-form",
    username: "register-username",
    email: "register-email",
    password: "register-password",
    submit: "register-submit",
  },
  /** `LoginView` — login form at `/login`. */
  LoginView: {
    form: "login-form",
    registeredNotice: "registered-notice",
    email: "login-email",
    password: "login-password",
    submit: "login-submit",
  },
  /** `LogoutView` — transient logout screen at `/logout`. */
  LogoutView: {
    root: "logout-view",
  },
  /** `UserHomeView` — signed-in home screen at `/home`. */
  UserHomeView: {
    root: "user-home-view",
    projectsToolbar: "projects-toolbar",
  },
  /** `ProjectView` — project editor at `/projects/:projectId`. */
  ProjectView: {
    root: "project-view",
    backToHome: "project-back-to-home",
  },
  /** `ProjectsTable` — table of the user's projects on `UserHomeView`. */
  ProjectsTable: {
    table: "projects-table",
    empty: "projects-empty",
    error: "projects-error",
    /** Per-row button that opens the archive confirmation for that project. */
    archive: "projects-archive",
    /** Confirm button in the archive confirmation dialog. */
    archiveConfirm: "projects-archive-confirm",
    /** Cancel button in the archive confirmation dialog. */
    archiveCancel: "projects-archive-cancel",
  },
  /** `TimelineToolbar` — playback/record toolbar above the timeline. */
  TimelineToolbar: {
    root: "timeline-toolbar",
    recordingSettingsTrigger: "recording-settings-trigger",
    recordingSettingsContent: "recording-settings-content",
    recordingInputSelect: "recording-input-select",
    recordingOutputSelect: "recording-output-select",
  },
  /** `TrackPane` — track list to the left of the timeline. */
  TrackPane: {
    root: "track-pane",
  },
} as const;
