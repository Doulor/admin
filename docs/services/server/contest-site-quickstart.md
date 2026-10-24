# 内部比赛官网快速上手

> 给要给自己的内部比赛做一个官网的组织者看：从建比赛到发布官网的完整步骤，接口清单，以及几条容易踩的坑。这份文档本身是给论坛「举办内部比赛指南」（t910）直接引用的材料，写法上不假设读者先看过别的文档。

状态：`current` · 更新：2026-10-24 · 源码：`scripts/contest-site.mjs`、`app/server/src/lib/site-package.ts`、`app/web/shared/competition-sdk/`、`app/web/sites/contests/` · 上级合同：[server](README.md) §「比赛官网托管、公开接口、贡献收集、定榜与兑奖」 · 接口细节：[endpoint-contracts](endpoint-contracts.md)「比赛官网托管、公开接口、贡献收集、定榜与兑奖」

## 整条链路

```
控制台建内部赛 ──▶ 复制起步模板、改配置 ──▶ 本地开发（带示例数据，不用连后端） ──▶ 构建、打包成 zip
    ──▶ 控制台上传 ──▶ 上传后立刻有预览地址（还没发布） ──▶ 控制台发布（定官网地址）──▶ 正式对外
```

只有 `kind: "internal"` 的比赛能托管官网；外部赛（`external`）只填官方链接和说明，没有这一整套。

## 第 1 步：建比赛，拿到比赛 id

在控制台「比赛」页新建一场内部赛，填名称、起止时间、报名方式（个人赛或团队赛，团队赛要填队伍人数上下限）。保存后在比赛详情里能看到比赛 id，后面要用。

## 第 2 步：起步

复制起步模板到自己的目录（目录名随便取，建议用比赛的英文 slug）：

```bash
cp -r app/web/sites/contests/_starter app/web/sites/contests/<比赛 slug>
```

改 `<比赛 slug>/site.config.ts` 的 `competition_id`（上一步拿到的 id）和 `name`。这份文件生成站点包根目录必须有的 `yzgc-site.json` 清单，站点包上传时服务端会核对里面的 `competition_id` 和实际上传到的比赛是否一致。

模板只演示四个接口怎么接（比赛信息、人员、队伍、奖励，加天梯），没有任何视觉设计——官网长什么样、用什么动效，是每场比赛自己的事；参考 `app/web/sites/contests/oss-2026-1/` 看一个做完整的例子。

## 第 3 步：本地开发

**不想先接真实后端、先看最终效果**：构建一次再用示例数据预览，不用建比赛、报名、发分：

```bash
app/web/node_modules/.bin/vite build -c app/web/sites/contests/<比赛 slug>/vite.config.ts
node scripts/contest-site.mjs dev app/web/sites/contests/<比赛 slug>/dist/site
```

打开 `http://127.0.0.1:5196/` 就能看到带真实感示例数据（人员、队伍、分数、动态）渲染出来的页面。常用参数：

- `--variant team`：示例数据按团队赛给（含一支还在招募的队）；默认是个人赛（这时「队伍」那一段会被判定为不适用）。
- `--prizes`：示例数据带奖励；默认不带，和真实比赛「奖励可选」一致。
- `--port <端口>`：换一个端口，默认 `5196`。
- `--competition <id>`：示例数据里 `getCompetition()` 返回的比赛 id，默认 `oss-challenge-2026-1`；这个预览服务对**任意**比赛 id 的请求都回同一份示例数据，站点代码不用改就能试。

每次改了代码，重新 `vite build` 再重启 `dev` 就能看到效果（这是预览工具，不是开发服务器，没有热更新）。

**要接真实数据调试**：正常起 Vite 开发服务器，`/api` 会转发到本机跑着的 server（端口 3000）：

```bash
app/web/node_modules/.bin/vite -c app/web/sites/contests/<比赛 slug>/vite.config.ts
```

这种方式要本机已经起了 server、建好了比赛、有人报名，数据才看得出效果；大多数时候用上一种更快。

## 第 4 步：构建、打包

```bash
app/web/node_modules/.bin/vite build -c app/web/sites/contests/<比赛 slug>/vite.config.ts
node scripts/contest-site.mjs pack app/web/sites/contests/<比赛 slug>/dist/site --competition <比赛 id>
```

`pack` 把构建产物打成 zip，并在本地跑一遍和服务端上传时同一套校验（规则都在 `app/server/src/lib/site-package.ts`，本地通过的包，上传时一定通过）：

- zip 本身不超过 20MB；解压后不超过 500 个文件、合计不超过 50MB；
- 文件扩展名只能是 `html css js mjs json svg png jpg jpeg webp avif woff2 txt ico mp3 ogg`；
- 不能有绝对路径、`..`、符号链接、以 `.` 开头的文件或目录；
- 根目录必须有 `index.html` 和 `yzgc-site.json`。

只想检查已经打好的 zip，不重新打包：`node scripts/contest-site.mjs check <文件.zip> --competition <比赛 id>`。

## 第 5 步：上传、预览

在控制台比赛详情的「官网」页签上传刚打好的 zip。上传成功会立刻给一个预览地址（`/c/<比赛 id 或已定的地址>/~preview/<版本号>/`），这时候**还没有对外发布**，只有能看到控制台这个页签的人（持有「发布比赛官网」权限）打开这个地址才能看到，访客和搜索引擎都看不到。先用这个地址确认效果，确认没问题再进下一步。

校验不通过时控制台会逐条列出原因，不会把文件落到服务器上，改好本地文件重新打包上传就行。

## 第 6 步：发布

还是在「官网」页签，选中刚才确认过的版本点发布。**第一次发布要填官网地址**（3–32 位小写字母、数字和连字符，字母或数字开头），比如 `oss-2026-1`，发布之后就是 `/c/oss-2026-1/`；这个地址发布之后不能再改，起名字要想清楚。之后再发布新版本就不用再填地址了。

发布之后比赛详情里主站比赛窗口会出现「打开官网」按钮，链到这个地址。想撤回某个版本：发布另一个通过校验的旧版本就是回滚；想整站下线：点「下线」，地址和历史版本都还保留，之后发布任一版本就恢复。

## 站点包必带的接口

站点在浏览器里跑在 sandbox 环境下（和主站不同源，读不到 cookie），只能用 SDK（`app/web/shared/competition-sdk/`，构建后也挂在 `/sdk/competition/v1.js`）匿名读以下几个接口，不需要也不应该自己写请求：

| 接口 | SDK 方法 | 给什么 | 比赛没有这项数据时 |
|---|---|---|---|
| 比赛信息 | `getCompetition()` | 名称、时间、报名方式、官网地址、门户深链等 | 不会发生——比赛一定存在才能有官网 |
| 人员 | `getParticipants({ cursor?, limit? })` | 全部已报名的参赛者（昵称、头像、部门），不是只有拿过分的人；分页 | 还没人报名时 `items` 是空数组 |
| 队伍 | `getTeams()` | 全部未解散的队伍（队名、成员、是否还在招募） | **个人赛也能调这个接口，不会报错**：`enabled` 为 `false`、`teams` 为空数组，站点据此跳过「队伍」这一段 |
| 奖励 | `getCompetition().prizes` | 奖项名次与金额 | 没设置奖励时是空数组，不是错误，不用单独调接口 |
| 天梯 | `getLeaderboard()` | 按分数排名的个人榜和队伍榜（只有拿过分的人才上榜） | 还没人拿分时两个列表都是空数组 |
| 贡献动态 | `getFeed({ cursor?, limit? })` | 最近的加分、扣分记录 | 同上，空数组 |
| 统计 | `getStats()` | 参赛人数、队伍数、合并的 MR 数等汇总 | 都是 0 |
| 一次取齐 | `getSnapshot()` | 比赛信息、天梯、动态、统计一次给齐，`subscribe()` 轮询用的就是它 | — |

人员和队伍不在 `getSnapshot()` 里（变化没有天梯那么频繁，按需单独调）；真要跟着轮询一起刷新，自己在 `subscribe()` 的回调里顺手再调一次。

接口都是匿名 GET，不带凭据，按来源 IP 每分钟限 120 次（四个基础接口加人员、队伍共用同一个桶），失败时 SDK 统一 reject 成 `{ code: "network" | "not_found" | "rate_limited" | "server", retry_after? }` 四种之一，站点代码按这四种分别处理就够了。

## 容易踩的坑

- **不要自己拼接口地址或域名**：`origin` 默认是空串（官网和主站同域），`createClient({ competition })` 就够，不要写死 `https://yangtzeu.work` 之类的地址——预发布和正式是两个不同的域名。
- **不要在站点包里放真实姓名、邮箱**：接口本身只给昵称、`@用户名`、头像，不会泄露这些；站点代码里也不要自己收集或显示。
- **图标、字体等资源打进包里**：sandbox 环境不能访问外部 CDN（`connect-src 'self'`），第三方字体、图标库要打进站点包，不能用 `<link>` 引用外部地址。
- **本地 `dev` 预览不是开发服务器**：改代码要重新 `vite build` 才能看到效果；边改边看用上面「要接真实数据调试」那条。
