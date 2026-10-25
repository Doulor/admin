import { generateKeyPairSync, randomBytes } from "node:crypto";
import { loadConfig } from "../config.js";
import { createDatabase } from "../lib/db.js";
import { createCrypto } from "../lib/crypto.js";
import { createOidcStore } from "../lib/oidc-store.js";

/**
 * 维护者在服务器上用的对外授权工具（#270）。只开数据库，不起服务；在运行中的容器里执行，和服务共用同一个库：
 *
 *   node app/server/dist/cli/oidc.js keygen > 某个 0600 文件
 *     生成签名私钥（一把 RSA 2048 的 JWK Set，输出成一行 base64），原样填进目标机 .env 的 OIDC_JWKS（环境文件的密钥不收引号，
 *     所以不用 JSON 原文）。不开数据库，不需要别的环境变量。
 *   docker exec <server 容器> node app/server/dist/cli/oidc.js client add --name GitLab --client-id gitlab --redirect-uri https://git.yangtzeu.work/users/auth/openid_connect/callback
 *     登记一个下游应用，输出 client id 和 client secret。secret 只输出这一次，库里只存加密后的。
 *   … client list | client rotate --client-id <id> | client disable --client-id <id> | client enable --client-id <id>
 *     列出应用（不含 secret）；换 secret（旧的立即失效，输出新的）；停用或恢复。
 */
function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}
function options(args: string[], name: string): string[] {
  return args.flatMap((arg, index) => (arg === `--${name}` && args[index + 1] ? [args[index + 1]] : []));
}
const print = (value: unknown) => process.stdout.write(`${JSON.stringify(value)}\n`);

function keygen(): number {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = privateKey.export({ format: "jwk" });
  const jwks = { keys: [{ ...jwk, kid: randomBytes(8).toString("hex"), use: "sig", alg: "RS256" }] };
  process.stdout.write(`${Buffer.from(JSON.stringify(jwks)).toString("base64")}\n`);
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const [command, sub, ...args] = argv;
  if (command === "keygen") return keygen();
  if (command !== "client") {
    process.stderr.write("usage: oidc.js keygen | client add|list|rotate|disable|enable …\n");
    return 2;
  }
  const config = loadConfig();
  const storage = createDatabase(config.dbPath);
  const store = createOidcStore(storage.db, createCrypto(config.encryptionKey));
  try {
    if (sub === "add") {
      const name = option(args, "name") ?? "";
      const redirectUris = options(args, "redirect-uri");
      if (!name || redirectUris.length === 0) {
        process.stderr.write("usage: oidc.js client add --name <名称> --redirect-uri <回调地址> [--redirect-uri …] [--client-id <id>]\n");
        return 2;
      }
      const { client, clientSecret } = store.registerClient({ name, redirectUris, clientId: option(args, "client-id") });
      storage.audit("system", "oidc.client.add", client.client_id, { name: client.name, redirect_uris: client.redirect_uris, via: "cli" }, undefined, { surface: "system" });
      print({ client_id: client.client_id, client_secret: clientSecret, redirect_uris: client.redirect_uris, issuer: config.oidc?.issuer ?? null });
      return 0;
    }
    if (sub === "list") {
      print(store.listClients());
      return 0;
    }
    const clientId = option(args, "client-id");
    if (!clientId) {
      process.stderr.write(`usage: oidc.js client ${sub ?? "<命令>"} --client-id <id>\n`);
      return 2;
    }
    if (sub === "rotate") {
      const clientSecret = store.rotateSecret(clientId);
      storage.audit("system", "oidc.client.rotate", clientId, { via: "cli" }, undefined, { surface: "system" });
      print({ client_id: clientId, client_secret: clientSecret });
      return 0;
    }
    if (sub === "disable" || sub === "enable") {
      store.setClientStatus(clientId, sub === "disable" ? "disabled" : "active");
      storage.audit("system", `oidc.client.${sub}`, clientId, { via: "cli" }, undefined, { surface: "system" });
      print({ client_id: clientId, status: sub === "disable" ? "disabled" : "active" });
      return 0;
    }
    process.stderr.write("usage: oidc.js client add|list|rotate|disable|enable …\n");
    return 2;
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  } finally {
    storage.db.close();
  }
}

process.exitCode = await main(process.argv.slice(2));
