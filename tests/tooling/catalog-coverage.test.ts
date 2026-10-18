import { beforeAll, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateCatalog as collectCatalog } from "../../scripts/project-catalog";
import { collectRuntime, ROOT } from "../../scripts/catalog/collect";
import { buildCatalog, OWNERSHIP_PATH, type Ownership, type Runtime } from "../../scripts/catalog/model";

let runtime: Runtime;
let ownership: Ownership;
beforeAll(async () => {
  runtime = await collectRuntime();
  ownership = JSON.parse(readFileSync(join(ROOT, OWNERSHIP_PATH), "utf8"));
});

it("每个业务操作和补充入口都有可追溯的业务用例", async () => {
  const catalog = await collectCatalog();
  const business = catalog.routes.filter(route =>
    route.kind === "business" && route.registration === "explicit" && route.method !== "HEAD");
  const operations = [...business, ...catalog.supplementalInterfaces];
  const covered = new Set(catalog.flows.map(flow => flow.operationNodeId));
  const missing = operations.filter(operation => !covered.has(operation.id)).map(operation => operation.id);
  console.log(`业务用例覆盖：${business.filter(route => covered.has(route.id)).length}/${business.length} 业务操作，`
    + `${catalog.supplementalInterfaces.filter(route => covered.has(route.id)).length}/${catalog.supplementalInterfaces.length} 补充入口`);
  expect(missing, "已注册操作不能仅有路由节点而没有业务用例").toEqual([]);
});

it("删除任一真实业务接口的全部流程关联时拒绝生成", () => {
  const baseline = buildCatalog(runtime, ownership);
  const operations = baseline.routes.filter(route =>
    route.kind === "business" && route.registration === "explicit" && route.method !== "HEAD");
  for (const operation of operations) {
    const changed = structuredClone(ownership);
    changed.flows = changed.flows.filter(flow => flow.operation !== operation.key);
    expect(() => buildCatalog(runtime, changed), operation.key).toThrow(/业务接口缺少流程关联/);
  }
  console.log(`删除关联反例：${operations.length} 个业务操作逐一拒绝`);
}, 60_000);

it("删除任一补充入口的全部流程关联时拒绝生成", () => {
  const baseline = buildCatalog(runtime, ownership);
  for (const operation of baseline.supplementalInterfaces) {
    const changed = structuredClone(ownership);
    changed.flows = changed.flows.filter(flow => flow.operation !== operation.id);
    expect(() => buildCatalog(runtime, changed), operation.id).toThrow(/补充入口缺少流程关联/);
  }
  console.log(`删除关联反例：${baseline.supplementalInterfaces.length} 个补充入口逐一拒绝`);
});
