// 计分规则模拟（#278，所有者 2026-10-24 16:59）：固定种子的结果钉住，改模型、改基础分表或改默认系数时这里跟着变，
// 并且要在 docs/plan/COMPETITION-APP.md「计分规则」里重跑 5000 场的表。
import { describe, expect, it } from "vitest";
import { CHOSEN, DAMPING_RULES, FACTOR_SETS, MODELS, simulate } from "../../scripts/contest-score-sim.mjs";
import { DEFAULT_GRADE_FACTORS } from "../../app/server/src/lib/competition-rubric";

const ORIGINAL = FACTOR_SETS["1.5 / 1.3 / 1.1 / 1.0（原默认）"];
const RULE = DAMPING_RULES["每周只算 1 条（采用）"];
const run = (model = MODELS.base) => simulate({
  seed: 278, contests: 400, model,
  sets: { original: ORIGINAL, chosen: CHOSEN }, rules: { none: null, rule: RULE },
});
const variant = (result: ReturnType<typeof simulate>, name: string, rule: string) =>
  result.variants.find((item: { name: string; rule: string }) => item.name === name && item.rule === rule)!;

describe("contest score simulation", () => {
  it("uses the same defaults as the server and is reproducible from the seed", () => {
    expect(CHOSEN).toEqual({ year1: DEFAULT_GRADE_FACTORS.year1, year2: DEFAULT_GRADE_FACTORS.year2, year3: DEFAULT_GRADE_FACTORS.year3, year4: DEFAULT_GRADE_FACTORS.year4 });
    expect(CHOSEN).toEqual({ year1: 350, year2: 220, year3: 140, year4: 100 });
    expect(run()).toEqual(run());
  });

  it("pins the chosen defaults with the weekly rule on the base model", () => {
    const result = run();
    expect(result.participantShare).toEqual({ year1: 0.4, year2: 0.3, year3: 0.2, year4: 0.1 });
    expect(result.typicalYear3).toEqual({ items: 5, base: 146.5 });
    expect(variant(result, "chosen", "rule")).toEqual({
      name: "chosen", rule: "rule",
      top8Share: { year1: 0.259, year2: 0.317, year3: 0.287, year4: 0.138 },
      spamSlots: 0, p1: 0.193, p3: 0.53, p8: 0.913, year1InTop8: 2.07,
      spamTop8: 0, spamTop1: 0, coreTop8: 0.958, legitCut: 0.021,
      year1VsYear3: { sameQuality: 0.4, items: 0.84 },
    });
  });

  it("favours 大一 over the old defaults without burying core work, and the weekly rule keeps spammers off the prizes", () => {
    for (const model of [MODELS.base, MODELS.steep]) {
      const result = run(model);
      const original = variant(result, "original", "rule");
      const chosen = variant(result, "chosen", "rule");
      // 大一在前 8 名里的名额、进前 3 / 前 8 的概率都明显高于原来的 1.5 倍
      expect(chosen.top8Share.year1).toBeGreaterThan(original.top8Share.year1 * 2);
      expect(chosen.p3).toBeGreaterThan(original.p3);
      expect(chosen.p8).toBeGreaterThan(original.p8);
      // 核心贡献最多的人仍然几乎总在前 8
      expect(chosen.coreTop8).toBeGreaterThan(0.9);
      // 不打折时刷「一般 × 边缘」的人常进前 8；每周只算 1 条之后一个都进不去，正常参赛者被打掉的分在 3% 以内
      expect(variant(result, "chosen", "none").spamTop8).toBeGreaterThan(0.5);
      expect(chosen.spamTop8).toBe(0);
      expect(chosen.legitCut).toBeLessThan(0.03);
    }
  });
});
