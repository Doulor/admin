// 「加入我们」窗口（#279）：一封信就是表单，写在桌面窗口里，不再跳到单独的页面（原来的 /join-us 三维信封场景已归档到
// docs/history/portal-yugc-os-v1/）。打开时才加载，防刷验证和表单样式不进桌面首屏。
//
// 提交是真实写操作：POST /api/portal/apply，准入与其它公开表单一致（蜜罐 + PoW + 可选 Turnstile），
// PoW 指纹 `apply:<姓名>:<邮箱>`（trim 后）与后端逐字一致；没有 mock 分支，也不做假成功。
// 投递要登录（#274）：没登录时只有「先注册再投递」，注册或登录后回到 /?open=join，桌面直接打开这个窗口；
// 登录后底部写今天还能投几份（/auth/me 的 quota，成员不限时不显示），投完了按钮变灰。
// 这个浏览器第一次打开时先全屏播宣传片（#77，能跳过），播完或跳过才露出信纸；之后靠 cookie 不再自动播。
import TurnstileWidget from "@shared/ui/TurnstileWidget";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { appConfig } from "@shared/config";
import { ApiError, requestJson } from "@shared/lib/http";
import { computePow, powProof } from "@shared/lib/pow";
import Icon from "../Icon";
import { LazyPromoPlayer } from "../PromoLazy";
import { readQuota, registerHref, signInHref, useAccount, type ApplyQuota } from "../../lib/account";
import { appLinkById } from "../../lib/osApps";
import { hasSeenPromo, promoCookie } from "../../lib/promo";
import { useInert, useReducedMotion } from "../../lib/useReducedMotion";
import "../../styles/pages.css";

type FormState = { name: string; className: string; email: string; strengths: string; website: string };
type FieldName = "name" | "className" | "email" | "strengths";
type FieldErrors = Partial<Record<FieldName, string>>;
type Receipt = { id: string; submitted_at: number; message: string; quota?: unknown };
type PublicConfig = { turnstile_site_key: string | null; pow_difficulty: number };

const EMPTY: FormState = { name: "", className: "", email: "", strengths: "", website: "" };
// 与 app/server/src/routes/portal/apply.ts 的 EMAIL_REGEX 逐字一致（tests/web/portal-join.test.ts 核对）
const EMAIL_RE = /^[^\s@"\\()<>,;:[\].]+(\.[^\s@"\\()<>,;:[\].]+)*@[^\s@"\\()<>,;:[\].]+(\.[^\s@"\\()<>,;:[\].]+)+$/;
const CLASS_RE = /^[\u4e00-\u9fa5A-Za-z0-9 ·\-]+$/;
/** 注册、登录完回到桌面并打开这个窗口 */
export const JOIN_RETURN = "/?open=join";

/** 与后端同一套规则，先在前端给出即时反馈；后端仍然是唯一权威。 */
export function validateJoin(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const name = form.name.trim();
  const className = form.className.trim();
  const email = form.email.trim();
  const strengths = form.strengths.trim();
  if (name.length < 2 || name.length > 40) errors.name = "姓名写 2 到 40 个字";
  if (className.length < 2 || className.length > 40) errors.className = "班级写 2 到 40 个字";
  else if (!CLASS_RE.test(className)) errors.className = "班级只能用中文、字母、数字、空格、· 和 -";
  if (!email) errors.email = "请填写邮箱，我们靠它联系你";
  else if (email.length > 120) errors.email = "邮箱最多 120 个字符";
  else if (!EMAIL_RE.test(email)) errors.email = email.includes("@") ? "邮箱格式不对，检查有没有多打的点、逗号或空格" : "邮箱格式不对，检查一下有没有漏掉 @";
  if (strengths.length < 10) errors.strengths = "至少写 10 个字";
  else if (strengths.length > 2000) errors.strengths = "最多 2000 字，请删减一些";
  return errors;
}

export default function JoinBox() {
  const reducedMotion = useReducedMotion();
  // 回执里的「去论坛看看」和桌面上的论坛应用同一个去处：直达论坛首页（#185）
  const forumLink = appLinkById("forum");
  // 开了减少动态效果不播（和 PromoPlayer 的 autoplayOff 同一条规则）：按看过算，不挂播放层、不下载分包，直接给信纸（#122）
  const [promoBlocked] = useState(() => reducedMotion && !hasSeenPromo(document.cookie));
  const [promo, setPromo] = useState(() => !promoBlocked && !hasSeenPromo(document.cookie));
  const box = useInert<HTMLDivElement>(promo);
  const onPromoSeen = useCallback(() => {
    document.cookie = promoCookie(window.location.protocol === "https:");
  }, []);
  const onPromoClose = useCallback(() => setPromo(false), []);
  useEffect(() => {
    if (promoBlocked) onPromoSeen();
  }, [promoBlocked, onPromoSeen]);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState<"" | "pow" | "submit">("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [powDifficulty, setPowDifficulty] = useState(3);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileEpoch, setTurnstileEpoch] = useState(0);
  const { account, loaded } = useAccount();
  // 寄出成功或被每日限额挡下后，用服务端给的新限额盖住 /auth/me 读到的
  const [sentQuota, setSentQuota] = useState<ApplyQuota | null>(null);
  // 写到一半登录失效（服务端回 401）：信纸留着，按钮换成重新登录
  const [expired, setExpired] = useState(false);
  const signedOut = loaded && !account;
  const quota = sentQuota ?? account?.quota ?? null;
  const usedUp = quota !== null && quota.limit >= 0 && quota.left <= 0;

  useEffect(() => {
    requestJson<PublicConfig>("/api/public/config")
      .then((config) => {
        setPowDifficulty(config.pow_difficulty);
        setSiteKey(config.turnstile_site_key);
      })
      .catch(() => setStatus({ kind: "error", text: "连不上服务器，暂时寄不出去。关掉窗口再打开试试。" }));
  }, []);

  const update = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    if (field !== "website") setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (busy || signedOut || expired || usedUp) return;
    const found = validateJoin(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setStatus({ kind: "error", text: "有几项没填好，按红字改完再寄" });
      box.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    if (siteKey && !turnstileToken) {
      setStatus({ kind: "error", text: "先完成上面的人机验证，再寄出" });
      return;
    }
    const name = form.name.trim();
    const email = form.email.trim();
    setStatus(null);
    setBusy("pow");
    try {
      // 与后端约定的载荷指纹：apply:<姓名>:<邮箱>（trim 之后，半角冒号）
      const pow = await computePow(`apply:${name}:${email}`, powDifficulty);
      setBusy("submit");
      const result = await requestJson<Receipt>("/api/portal/apply", {
        method: "POST",
        body: JSON.stringify({
          name,
          className: form.className.trim(),
          email,
          strengths: form.strengths.trim(),
          website: form.website,
          pow: powProof(pow),
          turnstile_token: turnstileToken,
        }),
      });
      setReceipt(result);
      const next = readQuota(result.quota);
      if (next) setSentQuota(next);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setExpired(true);
        setStatus({ kind: "error", text: "登录已经失效，重新登录后再寄。离开前先把写好的内容复制下来。" });
      } else if (error instanceof ApiError && error.status === 429 && error.payload?.bucket === "apply.daily") {
        setSentQuota({ left: 0, limit: quota?.limit ?? 0 });
        setStatus({ kind: "error", text: error.message });
      } else if (error instanceof ApiError) {
        const fields = (error.payload?.fields ?? {}) as FieldErrors;
        setErrors(fields);
        setStatus({ kind: "error", text: Object.keys(fields).length > 0 ? "服务器没收下这封信，按红字改完再寄" : error.message });
      } else {
        setStatus({ kind: "error", text: (error as Error).message || "没寄出去，可能是网络断了。内容还在，稍后再点一次。" });
      }
      setTurnstileToken("");
      setTurnstileEpoch((value) => value + 1);
    } finally {
      setBusy("");
    }
  };

  const writeAnother = () => {
    setReceipt(null);
    setForm(EMPTY);
    setErrors({});
    setStatus(null);
    setTurnstileToken("");
    setTurnstileEpoch((value) => value + 1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  const field = (name: FieldName, label: string, input: JSX.Element, hint?: JSX.Element) => (
    <div className="pt-field">
      <label htmlFor={`jb-${name}`}>{label}</label>
      {input}
      {errors[name] ? (
        <p className="pt-hint is-error" id={`jb-${name}-err`} role="alert">
          {errors[name]}
        </p>
      ) : (
        hint
      )}
    </div>
  );
  const described = (name: FieldName, hint?: string) => (errors[name] ? `jb-${name}-err` : hint);

  const count = form.strengths.trim().length;
  // 今天还能投几份：信纸底部和回执里都写；成员不限（limit 为 -1）时不写
  const quotaNote = quota && quota.limit >= 0 && (
    <span className="pt-hint pt-joinbox-quota">
      {usedUp ? (
        "今天的投递次数用完了，明天再来"
      ) : (
        <>
          今天还能投 <span className="pt-num">{quota.left}</span> 份
        </>
      )}
    </span>
  );
  return (
    <>
      <div ref={box} className="pt-joinbox">
        <p className="pt-joinbox-lead">给极客班写一封信，写上姓名、班级、邮箱，再说说你会什么、想做什么。寄出之后，我们用邮件联系你。</p>

        {receipt ? (
          <section className="pt-joinbox-receipt" role="status" aria-live="polite">
            <span className="pt-joinbox-seal" aria-hidden="true">
              <Icon name="mail-check-line" size={26} />
            </span>
            <h3>信收到了</h3>
            <p>{receipt.message}</p>
            <dl>
              <div>
                <dt>编号</dt>
                <dd>
                  <code>{receipt.id}</code>
                </dd>
              </div>
              <div>
                <dt>提交时间</dt>
                <dd>{new Date(receipt.submitted_at).toLocaleString("zh-CN", { hour12: false })}</dd>
              </div>
            </dl>
            <p className="pt-hint">记下编号，之后联系我们时报上它。网站上查不到进度，请留意邮箱。</p>
            {quotaNote}
            <div className="pt-form-actions">
              <a className="pt-btn is-primary" href={forumLink.href} target={forumLink.newTab ? "_blank" : undefined} rel={forumLink.newTab ? "noreferrer" : undefined}>
                去论坛看看
              </a>
              {!usedUp && (
                <button type="button" className="pt-btn" onClick={writeAnother}>
                  再写一封
                </button>
              )}
            </div>
          </section>
        ) : (
          <form className="pt-joinbox-letter" noValidate aria-labelledby="jb-title" onSubmit={submit} onKeyDown={onKeyDown}>
            <header className="pt-joinbox-head">
              <h3 id="jb-title">致 长江大学极客班：</h3>
              <img src={appConfig.portal.brand.logo} alt="" width={40} height={40} />
            </header>
            {!loaded ? (
              <p className="pt-hint">正在读取登录状态…</p>
            ) : signedOut ? (
              <div className="pt-joinbox-gate">
                <h4>先注册再投递</h4>
                <p>投递要用极客班账号。注册不需要邀请码，注册或登录后会回到这封信。</p>
                <div className="pt-form-actions">
                  <a className="pt-btn is-primary" href={registerHref(JOIN_RETURN)}>
                    <Icon name="user-add-line" size={16} />
                    注册
                  </a>
                  <a className="pt-btn" href={signInHref(JOIN_RETURN)}>
                    登录
                  </a>
                </div>
              </div>
            ) : (
              <>
                <div className="pt-joinbox-row">
                  {field("name", "姓名", <input id="jb-name" className="pt-input" name="name" value={form.name} onChange={update("name")} autoComplete="name" placeholder="怎么称呼你" maxLength={40} aria-invalid={errors.name ? true : undefined} aria-describedby={described("name")} />)}
                  {field("className", "班级", <input id="jb-className" className="pt-input" name="className" value={form.className} onChange={update("className")} autoComplete="organization" placeholder="例如 计科 2301 班" maxLength={40} aria-invalid={errors.className ? true : undefined} aria-describedby={described("className")} />)}
                </div>
                {field(
                  "email",
                  "邮箱",
                  <input id="jb-email" className="pt-input" name="email" type="email" value={form.email} onChange={update("email")} autoComplete="email" placeholder="name@example.com" maxLength={120} aria-invalid={errors.email ? true : undefined} aria-describedby={described("email", "jb-email-hint")} />,
                  <p className="pt-hint" id="jb-email-hint">
                    只用来联系你，不会公开
                  </p>,
                )}
                {field(
                  "strengths",
                  "你会什么，想做什么",
                  <textarea
                    id="jb-strengths"
                    className="pt-input pt-textarea"
                    name="strengths"
                    rows={5}
                    value={form.strengths}
                    onChange={update("strengths")}
                    maxLength={2000}
                    placeholder="做过的项目、参加过的比赛、课程作业、自己写的小工具都可以写。"
                    aria-invalid={errors.strengths ? true : undefined}
                    aria-describedby={described("strengths", "jb-strengths-count")}
                  />,
                  <p className="pt-hint" id="jb-strengths-count">
                    <span className="pt-num">{count}</span> / 2000 字，至少 10 字
                  </p>,
                )}
                {/* 蜜罐字段：真人看不见也不会填，机器人会填。 */}
                <div className="pt-trap" aria-hidden="true">
                  <label>
                    个人主页（不要填写）
                    <input name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={update("website")} />
                  </label>
                </div>
                <TurnstileWidget siteKey={siteKey} onToken={setTurnstileToken} resetKey={turnstileEpoch} />
                {status && (
                  <p className={status.kind === "error" ? "pt-alert is-error" : "pt-alert"} role="alert">
                    {status.kind === "error" && <Icon name="error-warning-line" size={16} />} {status.text}
                  </p>
                )}
                <footer className="pt-form-actions">
                  {expired ? (
                    <a className="pt-btn is-primary" href={signInHref(JOIN_RETURN)}>
                      <Icon name="user-line" size={16} />
                      重新登录
                    </a>
                  ) : (
                    <button type="submit" className="pt-btn is-primary" disabled={busy !== "" || usedUp}>
                      <Icon name="send-plane-2-line" size={16} />
                      {busy === "pow" ? "正在做防刷验证…" : busy === "submit" ? "正在寄出…" : "寄出这封信"}
                      <kbd>⌘ Enter</kbd>
                    </button>
                  )}
                  {!expired && quotaNote}
                </footer>
              </>
            )}
          </form>
        )}
      </div>
      {/* 分包没到时先显示同一套加载遮罩（placeholder，#122）。挂到 body 上：窗口有 backdrop-filter，fixed 的播放层放在窗口里只会盖住窗口 */}
      {promo && createPortal(<LazyPromoPlayer mode="gate" placeholder onSeen={onPromoSeen} onClose={onPromoClose} />, document.body)}
    </>
  );
}
