import { ApiRoutes } from 'clawhub-schema'
import { httpRouter } from 'convex/server'
import { auth } from './auth'
import { downloadZip } from './downloads'
import {
  listSkillsV1Http,
  listSoulsV1Http,
  publishSkillV1Http,
  publishSoulV1Http,
  resolveSkillVersionV1Http,
  searchSkillsV1Http,
  skillsDeleteRouterV1Http,
  skillsGetRouterV1Http,
  skillsScriptRouterV1Http,
  soulsDeleteRouterV1Http,
  soulsGetRouterV1Http,
  soulsScriptRouterV1Http,
  starsDeleteRouterV1Http,
  starsScriptRouterV1Http,
  whoamiV1Http,
} from './httpApiV1'

const http = httpRouter()

auth.addHttpRoutes(http)

http.route({
  path: ApiRoutes.download,
  method: 'GET',
  handler: downloadZip,
})

http.route({
  path: ApiRoutes.search,
  method: 'GET',
  handler: searchSkillsV1Http,
})

http.route({
  path: ApiRoutes.resolve,
  method: 'GET',
  handler: resolveSkillVersionV1Http,
})

http.route({
  path: ApiRoutes.skills,
  method: 'GET',
  handler: listSkillsV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.skills}/`,
  method: 'GET',
  handler: skillsGetRouterV1Http,
})

http.route({
  path: ApiRoutes.skills,
  method: 'POST',
  handler: publishSkillV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.skills}/`,
  method: 'POST',
  handler: skillsScriptRouterV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.skills}/`,
  method: 'DELETE',
  handler: skillsDeleteRouterV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.stars}/`,
  method: 'POST',
  handler: starsScriptRouterV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.stars}/`,
  method: 'DELETE',
  handler: starsDeleteRouterV1Http,
})

http.route({
  path: ApiRoutes.whoami,
  method: 'GET',
  handler: whoamiV1Http,
})

http.route({
  path: ApiRoutes.souls,
  method: 'GET',
  handler: listSoulsV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.souls}/`,
  method: 'GET',
  handler: soulsGetRouterV1Http,
})

http.route({
  path: ApiRoutes.souls,
  method: 'POST',
  handler: publishSoulV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.souls}/`,
  method: 'POST',
  handler: soulsScriptRouterV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.souls}/`,
  method: 'DELETE',
  handler: soulsDeleteRouterV1Http,
})

// Legacy /api routes removed 2026-02-03 after deprecation window.
// All clients have migrated to /api/v1 routes.

export default http
