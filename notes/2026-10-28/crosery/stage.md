# stage · crosery · 2026-10-28

负责人：crosery

## 10:55:26 +08:00 · 发布 · 无 issue · 发布 rc.28 修复 CDN 私有索引归档并部署预发布

- 执行者：agent-omp-geek-main-fece2da2（omp，k3.1-pro）
- 做了什么：复用已合入 stage 的 task/303 rclone 缺失对象修复；CI 运行 40611105503 全绿后创建并推送 v0.1.1-rc.28，提交 a5cb5a9cd470daf047551e2b785081f52cab83cf
- 结果：Deploy Preview 运行 40621471746 全部 job 成功；cdn-upload 与私有索引归档通过；release.json=0.1.1-rc.28@a5cb5a9cd470
- 下一步：核对官网、控制台、论坛真实浏览器资源加载

## 10:55:27 +08:00 · 验收 · 无 issue · 预发布大资源已从 Garage CDN 加载

- 执行者：agent-omp-geek-main-fece2da2（omp，k3.1-pro）
- 做了什么：真实 Chromium 打开 https://prev.yangtzeu.work/、/console、/forum/，读取 performance 资源地址并截图；Range 请求核对大文件尺寸与缓存
- 结果：官网 24 个静态/媒体资源全部来自 cdn.yangtzeu.work，无同源大资源；控制台 36 个构建资源与论坛 6 个首屏构建资源均来自新 CDN；vendor 219519B、console CSS 942242B、forum CSS 851834B、forum JS 598629B 均返回 206 与一年 immutable 缓存
