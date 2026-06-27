import { config } from "./config";
import { type AudioStorage, createAudioStorage } from "./lib/audioStorage";
import { ProjectAudioRepository } from "./repositories/ProjectAudioRepository";
import { ProjectDataRepository } from "./repositories/ProjectDataRepository";
import { ProjectRepository } from "./repositories/ProjectRepository";
import { ProjectUserRepository } from "./repositories/ProjectUserRepository";
import { SessionRepository } from "./repositories/SessionRepository";
import { UserRepository } from "./repositories/UserRepository";
import { AuthService } from "./services/AuthService";
import { ProjectAudioService } from "./services/ProjectAudioService";
import { ProjectClipService } from "./services/ProjectClipService";
import { ProjectDataService } from "./services/ProjectDataService";
import { ProjectService } from "./services/ProjectService";
import { ProjectUserService } from "./services/ProjectUserService";
import { UserService } from "./services/UserService";

/**
 * The set of services exposed to resolvers via the GraphQL context. This is
 * the seam between the API layer (resolvers) and the business-logic layer
 * (services) — resolvers reach everything they need through here.
 */
export interface Services {
  users: UserService;
  auth: AuthService;
  projects: ProjectService;
  projectData: ProjectDataService;
  projectUsers: ProjectUserService;
  projectAudios: ProjectAudioService;
  projectClips: ProjectClipService;
}

/** Overrides for the composition root, primarily so tests can inject fakes. */
export interface CreateServicesOptions {
  /** Object store for audio uploads; defaults to the configured backend. */
  audioStorage?: AudioStorage;
}

/**
 * Composition root: instantiate repositories and wire them into services.
 * The services are stateless, so this can be called per request cheaply (or
 * once and shared). Tests call it directly to build a real service graph,
 * optionally swapping in fakes (e.g. an in-memory {@link AudioStorage}).
 */
export function createServices(options: CreateServicesOptions = {}): Services {
  const userRepository = new UserRepository();
  const sessionRepository = new SessionRepository();
  const projectRepository = new ProjectRepository();
  const projectDataRepository = new ProjectDataRepository();
  const projectUserRepository = new ProjectUserRepository();
  const projectAudioRepository = new ProjectAudioRepository();

  const audioStorage = options.audioStorage ?? createAudioStorage(config.audio);

  const users = new UserService(userRepository);
  const auth = new AuthService(userRepository, sessionRepository, {
    sessionTtlMs: config.auth.sessionTtlMs,
  });
  const projectData = new ProjectDataService(projectDataRepository);
  const projectUsers = new ProjectUserService(projectUserRepository);
  const projects = new ProjectService(projectRepository, projectData, projectUsers);
  const projectAudios = new ProjectAudioService(
    projectAudioRepository,
    audioStorage,
    config.audio.publicBaseUrl,
  );
  const projectClips = new ProjectClipService(projects, projectData, projectAudios);

  return {
    users,
    auth,
    projects,
    projectData,
    projectUsers,
    projectAudios,
    projectClips,
  };
}
