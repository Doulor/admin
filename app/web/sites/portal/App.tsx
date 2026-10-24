import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";

// 3D 场景页与普通页面按路由分包：首页之外的页面只在访问时下载。three.js 本身在各场景的 import() 里再次延迟。
const JoinUs = lazy(() => import("./pages/JoinUs"));
const Forum3D = lazy(() => import("./pages/Forum3D"));
const Docs = lazy(() => import("./pages/Docs"));
const Feedback = lazy(() => import("./pages/Feedback"));

/**
 * 官网路由。全部匿名可访问；登录状态只用来显示资料卡、投递限额和比赛里的「我」。
 *   /            开机动画（每天第一次进来播）+ YUGC OS 桌面
 *   /join-us     加入我们（信封场景，真实提交 POST /api/portal/apply，要先注册登录）；旧地址 /apply 重定向到这里
 *   /forum-3d    论坛版块气泡场景（主入口「进入论坛首页」）。不是桌面入口的中间页（#185）：桌面上的「论坛」直达论坛首页，
 *                这页留给已收藏、已分享的旧地址和论坛最新窗口里的「3D 版块」按钮；原来的 /github 场景页已删（#275），旧地址回首页
 *   /docs /docs/:id /feedback；/feedback/:org 是控制台意见箱页生成的分享地址（也接住旧链接），
 *                URL 里的组织名不生效，页面只发服务端下发的本部署组织（#129）
 *   旧的 /join/:token（GitHub 组织邀请链接）随 #274 删掉的 /api/join/:token 一起退场，落到兜底路由回首页
 */
export default function App() {
  return (
    <Suspense fallback={<div className="pt-route-fallback" aria-busy="true" />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join-us" element={<JoinUs />} />
        <Route path="/apply" element={<Navigate to="/join-us" replace />} />
        <Route path="/forum-3d" element={<Forum3D />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/docs/:id" element={<Docs />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/feedback/:org" element={<Feedback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
