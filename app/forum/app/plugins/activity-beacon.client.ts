/**
 * 论坛页面浏览埋点（#274）：每次路由切换（含首屏）上报一条 `page.view`，`target_id` 是 Nuxt 按文件路由
 * 生成的路由名（如 `t-id`、`u-username`），不带参数真实值，不是地址栏路径。useActivityBeacon 内部按
 * serverMode 过滤，示例、本地快照预览不发。
 */
export default defineNuxtPlugin((nuxtApp) => {
  const { report } = useActivityBeacon()
  nuxtApp.hook('page:finish', () => {
    const route = useRoute()
    report('page.view', { target_type: 'route', target_id: String(route.name ?? route.path) })
  })
})
