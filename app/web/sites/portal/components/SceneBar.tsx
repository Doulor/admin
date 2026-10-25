// 三个 3D 场景页（加入我们 / 论坛 / GitHub）共用的顶栏：回到桌面、品牌。
// 桌面是首页的默认状态（pages/Home.tsx 按 yugc:boot-day 判断），回「/」直接落在桌面，不用带路由 state。
import { Link } from "react-router-dom";
import { appConfig } from "@shared/config";
import Icon from "./Icon";

export default function SceneBar() {
  const { brand } = appConfig.portal;
  return (
    <div className="pt-scenebar">
      <Link className="pt-back" to="/">
        <Icon name="arrow-left-line" size={15} /> 回到桌面
      </Link>
      <span className="pt-spacer" />
      <Link className="pt-scenebrand" to="/" aria-label={`${brand.title}首页`}>
        <img src={brand.logo} alt="" width={26} height={26} />
        <span>{brand.title}</span>
      </Link>
    </div>
  );
}
