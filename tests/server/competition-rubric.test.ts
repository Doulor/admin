// 两档计分表与防刷规则（#278，所有者 2026-10-24 16:59）：基础分查表、MR 比 Issue 高、表里的数落在积分表的 CHECK 里，
// 北京时间按周一 0 点分周，扣分不乘系数。
import { describe, expect, it } from 'vitest';
import {
  CORE, DEFAULT_GRADE_FACTORS, GRADE_FACTOR_RANGE, IMPORTANCE, PENALTY_POINTS, RUBRIC, WEEK_LENGTH_MS,
  basePoints, dampPercent, isTrivial, scoringView, weekStart, weightedPoints,
} from '../../app/server/src/lib/competition-rubric';

describe('competition rubric', () => {
  it('grows with importance and core, puts a PR above an Issue at the same levels, and stays inside the score_events CHECK', () => {
    for (const importance of IMPORTANCE) {
      for (const core of CORE) {
        expect(basePoints('pr', importance, core)).toBeGreaterThan(basePoints('issue', importance, core));
        expect(basePoints('issue', importance, core)).toBeGreaterThanOrEqual(5);
        expect(basePoints('issue', importance, core)).toBeLessThanOrEqual(30);
        expect(basePoints('pr', importance, core)).toBeGreaterThanOrEqual(15);
        expect(basePoints('pr', importance, core)).toBeLessThanOrEqual(100);
      }
    }
    for (const kind of ['issue', 'pr'] as const) {
      for (let i = 1; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(RUBRIC[kind][IMPORTANCE[i]][CORE[j]]).toBeGreaterThan(RUBRIC[kind][IMPORTANCE[i - 1]][CORE[j]]);
          expect(RUBRIC[kind][IMPORTANCE[j]][CORE[i]]).toBeGreaterThan(RUBRIC[kind][IMPORTANCE[j]][CORE[i - 1]]);
        }
      }
    }
    expect(RUBRIC.pr.critical.core).toBe(100);
    expect(RUBRIC.issue.normal.edge).toBe(5);
    expect(scoringView().points).toHaveLength(18);
  });

  it('keeps a 大四 关键 × 核心 MR above a 大一 一般 × 业务 MR at the default factors', () => {
    expect(weightedPoints(RUBRIC.pr.critical.core, DEFAULT_GRADE_FACTORS.year4)).toBeGreaterThan(weightedPoints(RUBRIC.pr.normal.business, DEFAULT_GRADE_FACTORS.year1));
    expect(Object.values(DEFAULT_GRADE_FACTORS).every(value => value >= GRADE_FACTOR_RANGE.min && value <= GRADE_FACTOR_RANGE.max)).toBe(true);
  });

  it('applies the grade factor and the weekly discount, never to a penalty', () => {
    expect(weightedPoints(25, 350)).toBe(88);
    expect(weightedPoints(15, 350, 0)).toBe(0);
    expect(weightedPoints(PENALTY_POINTS, 350)).toBe(-50);
    expect(isTrivial('normal', 'edge')).toBe(true);
    expect(isTrivial('normal', 'business')).toBe(false);
    expect(isTrivial(null, null)).toBe(false);
    expect([dampPercent(0), dampPercent(1), dampPercent(5)]).toEqual([100, 0, 0]);
  });

  it('starts the week on Monday 00:00 Beijing time', () => {
    // 2026-10-26 是周一；北京时间 00:00 = UTC 前一天 16:00
    const monday = Date.parse('2026-10-25T16:00:00Z');
    expect(weekStart(monday)).toBe(monday);
    expect(weekStart(monday - 1)).toBe(monday - WEEK_LENGTH_MS);
    expect(weekStart(Date.parse('2026-11-01T15:59:59Z'))).toBe(monday); // 周日 23:59:59
    expect(weekStart(Date.parse('2026-10-28T04:00:00Z'))).toBe(monday);
  });
});
