// 年级（#280）：账号存入学年份 account_profiles.enrollment_year，年级按北京时间的学年现算，
// 每年 9 月 1 日升一级，大四之后是已毕业。比赛按年级加权（#278）也读这里，不另存年级。
// 下拉框也能直接选已毕业（所有者 2026-10-24 22:05）：存成五年前入学，之后一直算出已毕业。
import { beijingParts } from "./beijing-time.js";

export type Grade = 1 | 2 | 3 | 4 | "graduated";
/** 下拉框里能选的年级：大一到大四和已毕业 */
export type SelectableGrade = Grade;

export const GRADE_LABELS: Record<Grade, string> = { 1: "大一", 2: "大二", 3: "大三", 4: "大四", graduated: "已毕业" };
export const SELECTABLE_GRADES: readonly SelectableGrade[] = [1, 2, 3, 4, "graduated"];

/** 北京时间这一刻所在的学年：9 月 1 日起是新学年，例如 2026-10-24 属于 2026 学年，2027-08-31 仍属于 2026 学年 */
export function academicYear(at: Date | number = Date.now()): number {
  const { y, m } = beijingParts(at);
  return m >= 9 ? y : y - 1;
}

/** 入学年份 → 这一刻的年级；没填或入学年份在将来时返回 null */
export function gradeOf(enrollmentYear: number | null | undefined, at: Date | number = Date.now()): Grade | null {
  if (enrollmentYear === null || enrollmentYear === undefined || !Number.isInteger(enrollmentYear)) return null;
  const n = academicYear(at) - enrollmentYear + 1;
  if (n < 1) return null;
  return n > 4 ? "graduated" : (n as SelectableGrade);
}

/** 下拉框选的年级 → 入学年份（按选的那一刻的学年算）；已毕业按大四再早一年算 */
export function enrollmentYearFor(grade: SelectableGrade, at: Date | number = Date.now()): number {
  return academicYear(at) - (grade === "graduated" ? 5 : grade) + 1;
}

export function isSelectableGrade(value: unknown): value is SelectableGrade {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === "graduated";
}
