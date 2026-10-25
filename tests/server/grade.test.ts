import { describe, expect, it } from "vitest";
import { GRADE_LABELS, academicYear, enrollmentYearFor, gradeOf, isSelectableGrade } from "../../app/server/src/lib/grade";

// 北京时间的某一刻：传 UTC 毫秒，减 8 小时
const bj = (y: number, m: number, d: number, hh = 0, mm = 0) => Date.UTC(y, m - 1, d, hh - 8, mm);

describe("年级按北京时间的学年现算（#280）", () => {
  it("9 月 1 日零点起是新学年，8 月 31 日最后一刻还是上一学年", () => {
    expect(academicYear(bj(2026, 10, 24))).toBe(2026);
    expect(academicYear(bj(2026, 8, 31, 23, 59))).toBe(2025);
    expect(academicYear(bj(2026, 9, 1, 0, 0))).toBe(2026);
    // UTC 还是 8 月 31 日 16:00，北京已经是 9 月 1 日零点
    expect(academicYear(Date.UTC(2026, 7, 31, 16, 0))).toBe(2026);
  });

  it("选了大一的人每年 9 月 1 日升一级，大四之后是已毕业", () => {
    const year = enrollmentYearFor(1, bj(2026, 10, 24));
    expect(year).toBe(2026);
    expect(gradeOf(year, bj(2027, 8, 31, 23, 59))).toBe(1);
    expect(gradeOf(year, bj(2027, 9, 1))).toBe(2);
    expect(gradeOf(year, bj(2029, 9, 1))).toBe(4);
    expect(gradeOf(year, bj(2030, 9, 1))).toBe("graduated");
    expect(GRADE_LABELS[gradeOf(year, bj(2028, 3, 1))!]).toBe("大二");
  });

  it("选了已毕业，当下和以后都算已毕业", () => {
    const year = enrollmentYearFor("graduated", bj(2026, 10, 24));
    expect(year).toBe(2022);
    expect(gradeOf(year, bj(2026, 10, 24))).toBe("graduated");
    expect(gradeOf(year, bj(2031, 9, 1))).toBe("graduated");
  });

  it("没填、不是整数、入学年份在将来，都算没有年级", () => {
    expect(gradeOf(null)).toBeNull();
    expect(gradeOf(undefined)).toBeNull();
    expect(gradeOf(2025.5, bj(2026, 10, 24))).toBeNull();
    expect(gradeOf(2027, bj(2026, 10, 24))).toBeNull();
  });

  it("下拉框认大一到大四和已毕业", () => {
    expect([1, 2, 3, 4, "graduated"].every(isSelectableGrade)).toBe(true);
    expect([0, 5, "1", "alumni", null].some(isSelectableGrade)).toBe(false);
  });
});
