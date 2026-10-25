// 招新关闭时「加入我们」窗口里的页面（#284）：说明现在不收新的投递，整个窗口只有这一页，没有表单，
// 也没有注册、登录这类报名入口；只留去宣传片、关于极客班和论坛的入口。开关在控制台「投递」页，重新开放后窗口变回信纸。
import Icon from "../Icon";
import { appLinkById } from "../../lib/osApps";
import type { OpenApp } from "./Windows";

export default function JoinClosed({ onOpen }: { onOpen?: OpenApp }) {
  const forumLink = appLinkById("forum");
  return (
    <section className="pt-joinbox-closed" aria-labelledby="jc-title">
      <span className="pt-joinbox-seal" aria-hidden="true">
        <Icon name="time-line" size={26} />
      </span>
      <h3 id="jc-title">招新暂未开放</h3>
      <p>现在不收新的投递，所以这里没有报名的信纸。开放以后，这个窗口会变回写信的页面。</p>
      <p className="pt-hint">刷新页面，或者把这个窗口关掉再打开，就能看到最新的状态。</p>
      <div className="pt-form-actions">
        {onOpen && (
          <>
            <button type="button" className="pt-btn is-primary" onClick={(event) => onOpen("promo", event.currentTarget)}>
              <Icon name="film-line" size={16} />
              看宣传片
            </button>
            <button type="button" className="pt-btn" onClick={(event) => onOpen("about", event.currentTarget)}>
              <Icon name="book-2-line" size={16} />
              关于极客班
            </button>
          </>
        )}
        <a className="pt-btn" href={forumLink.href} target={forumLink.newTab ? "_blank" : undefined} rel={forumLink.newTab ? "noreferrer" : undefined}>
          <Icon name="discuss-line" size={16} />
          去论坛看看
        </a>
      </div>
    </section>
  );
}
