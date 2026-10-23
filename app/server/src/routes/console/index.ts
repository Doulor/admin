import type { FastifyInstance } from "fastify";
import { registerContracts } from "../../lib/http-contracts.js";
import { consoleContracts } from "./contracts.js";
import me from "./me.js";
import departments from "./departments.js";
import applications from "./applications.js";
import feedback from "./feedback.js";
import competitions from "./competitions.js";
import competitionRoster from "./competition-roster.js";
import invites from "./invites.js";
import gitlab from "./gitlab.js";
import permissions from "./permissions.js";
import permissionGroups from "./permission-groups.js";
import accounts from "./accounts.js";
import users from "./users.js";
import activity from "./activity.js";

/** 极客班控制台 `/api/console/*`：授权按 #274 新权限体系（节点/权限组）判定。不导入 routes/admin。 */
export default async function consoleRoutes(app: FastifyInstance) {
  registerContracts(app, consoleContracts);
  await app.register(me);
  await app.register(departments);
  await app.register(applications);
  await app.register(feedback);
  await app.register(competitions);
  await app.register(competitionRoster);
  await app.register(invites);
  await app.register(gitlab);
  await app.register(permissions);
  await app.register(permissionGroups);
  await app.register(accounts);
  await app.register(users);
  await app.register(activity);
}
