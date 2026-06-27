import { ProjectDataRepository } from "./repositories/ProjectDataRepository";
import { ProjectRepository } from "./repositories/ProjectRepository";
import { UserRepository } from "./repositories/UserRepository";
import { ProjectDataService } from "./services/ProjectDataService";
import { ProjectService } from "./services/ProjectService";
import { UserService } from "./services/UserService";

/**
 * The set of services exposed to resolvers via the GraphQL context. This is
 * the seam between the API layer (resolvers) and the business-logic layer
 * (services) — resolvers reach everything they need through here.
 */
export interface Services {
  users: UserService;
  projects: ProjectService;
  projectData: ProjectDataService;
}

/**
 * Composition root: instantiate repositories and wire them into services.
 * The services are stateless, so this can be called per request cheaply (or
 * once and shared). Tests call it directly to build a real service graph.
 */
export function createServices(): Services {
  const userRepository = new UserRepository();
  const projectRepository = new ProjectRepository();
  const projectDataRepository = new ProjectDataRepository();

  const users = new UserService(userRepository);
  const projectData = new ProjectDataService(projectDataRepository);
  const projects = new ProjectService(projectRepository, projectData);

  return { users, projects, projectData };
}
