// 整页跳转：单独放一个函数，测试里（jsdom 不能真的跳转）换成记录地址的假函数。
export function goTo(url: string): void {
  window.location.assign(url);
}
