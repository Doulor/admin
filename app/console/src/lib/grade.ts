// 年级（#280）：下拉框的选项和真实姓名的本地检查。年级怎么随学年升级由服务端算（app/server/src/lib/grade.ts），这里只显示。
import type { SelectableGrade } from "./types";

export const GRADE_OPTIONS: { value: SelectableGrade; label: string }[] = [
  { value: 1, label: "大一" }, { value: 2, label: "大二" }, { value: 3, label: "大三" }, { value: 4, label: "大四" },
];

export const isSelectableGrade = (value: unknown): value is SelectableGrade => value === 1 || value === 2 || value === 3 || value === 4;

/** 和服务端 normalizeRealName 同一条规则：2–32 个字，只能是文字、空格和「·」「.」「-」；只挡明显填错的，最终以服务端为准 */
export function realNameProblem(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return "填上真实姓名";
  return /^[\p{L}\p{M}][\p{L}\p{M} ·.\-]*$/u.test(name) && [...name].length >= 2 && [...name].length <= 32 ? null : "姓名填 2 到 32 个字，只能是文字、空格和「·」";
}

export const gradeProblem = (grade: unknown): string | null => (isSelectableGrade(grade) ? null : "选一个年级");
