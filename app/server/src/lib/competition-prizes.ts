// 定榜与兑奖码（#278，所有者 2026-10-24 13:45）：比赛结束后管理员定榜，冻结名次并给每个得奖的人发一个兑奖码；
// 得奖的人在门户「我的参赛」里看名次、奖项和兑奖码，所有者在控制台输入兑奖码核销。
//
// 名次用 competition-score-store 的 standings()：严格排序不并列（同分时先到这个分的在前，再按报名先后），
// 只有分数大于 0 的人能拿奖，奖只发给个人。兑奖码 `YUGC-XXXX-XXXX-XXXX-XXXX`，16 位 Crockford base32、80 位随机，
// 猜不出来。库里存三样：SHA-256 散列（按码查找、核销，查找不需要明文）、AES-GCM 密文（lib/crypto.ts，
// 只用来让得奖的人在「我的参赛」里再看一次）、末四位（控制台名单上对人用）。公开接口从不返回兑奖码。
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { CompetitionStore } from "./competition-store.js";
import type { CompetitionScoreStore, Standing } from "./competition-score-store.js";
import { prizeForRank, type CompetitionRulesStore } from "./competition-rules-store.js";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const PRIZE_CODE_PREFIX = "YUGC";

export type PrizeError = "not_found" | "not_ended" | "already_finalized" | "not_finalized" | "prizes_redeemed" | "scoring_not_enabled" | "code_not_found" | "already_redeemed";
export const PRIZE_ERRORS: Record<PrizeError, { status: number; message: string }> = {
  not_found: { status: 404, message: "比赛不存在" },
  not_ended: { status: 409, message: "比赛还没结束，结束后才能定榜" },
  already_finalized: { status: 409, message: "这场比赛已经定榜了" },
  not_finalized: { status: 404, message: "这场比赛还没有定榜" },
  prizes_redeemed: { status: 409, message: "已经有奖项核销过，不能撤销定榜" },
  scoring_not_enabled: { status: 409, message: "这场比赛没有开启积分" },
  code_not_found: { status: 404, message: "没有这个兑奖码，请核对后再输入" },
  already_redeemed: { status: 409, message: "这个兑奖码已经核销过了" },
};
export type PrizeResult<T> = { ok: true; value: T } | { ok: false; error: PrizeError };

export type PrizeRow = {
  id: string; competition_id: string; account_id: string; rank: number; points: number; amount_cny: number; title: string;
  code_hash: string; code_cipher: string; code_hint: string; created_at: number; redeemed_at: number | null; redeemed_by: string | null;
};
export type FinalRow = { competition_id: string; finalized_at: number; finalized_by: string; standings: string };

/** 80 位随机数编成 16 位 Crockford base32，四位一组。 */
export function generatePrizeCode(): string {
  const bytes = randomBytes(10);
  let bits = 0n;
  for (const byte of bytes) bits = (bits << 8n) | BigInt(byte);
  let text = "";
  for (let index = 15; index >= 0; index--) text += CROCKFORD[Number((bits >> BigInt(index * 5)) & 31n)];
  return `${PRIZE_CODE_PREFIX}-${text.match(/.{4}/g)!.join("-")}`;
}

/** 输入的兑奖码 → 16 位规范形式：不分大小写，去掉空格和连字符与前缀，I、L 当 1，O 当 0；不像兑奖码的为 null。 */
export function normalizePrizeCode(input: string): string | null {
  let text = input.toUpperCase().replace(/[\s-]+/g, "");
  if (text.startsWith(PRIZE_CODE_PREFIX)) text = text.slice(PRIZE_CODE_PREFIX.length);
  text = text.replace(/[IL]/g, "1").replace(/O/g, "0");
  return /^[0-9A-HJKMNP-TV-Z]{16}$/.test(text) ? text : null;
}

export const prizeCodeHash = (normalized: string) => createHash("sha256").update(`yugc-prize:${normalized}`).digest("hex");

export function createCompetitionPrizes(db: Database.Database, deps: {
  competitions: Pick<CompetitionStore, "get">;
  scores: Pick<CompetitionScoreStore, "standings">;
  signupScoring: (competitionId: string) => string;
  rules: Pick<CompetitionRulesStore, "get">;
  crypto: { encrypt(plain: string): string; decrypt(payload: string): string };
}) {
  const selectFinal = db.prepare("SELECT * FROM competition_finals WHERE competition_id = ?");
  const insertFinal = db.prepare("INSERT INTO competition_finals(competition_id, finalized_at, finalized_by, standings) VALUES(?, ?, ?, ?)");
  const deleteFinal = db.prepare("DELETE FROM competition_finals WHERE competition_id = ?");
  const insertPrize = db.prepare(`INSERT INTO competition_prizes(id, competition_id, account_id, rank, points, amount_cny, title, code_hash, code_cipher, code_hint, created_at)
    VALUES(@id, @competition_id, @account_id, @rank, @points, @amount_cny, @title, @code_hash, @code_cipher, @code_hint, @created_at)`);
  const selectPrizes = db.prepare("SELECT * FROM competition_prizes WHERE competition_id = ? ORDER BY rank");
  const selectPrizeByHash = db.prepare("SELECT * FROM competition_prizes WHERE code_hash = ?");
  const selectMyPrize = db.prepare("SELECT * FROM competition_prizes WHERE competition_id = ? AND account_id = ?");
  const countRedeemed = db.prepare("SELECT COUNT(*) AS n FROM competition_prizes WHERE competition_id = ? AND redeemed_at IS NOT NULL");
  const deletePrizes = db.prepare("DELETE FROM competition_prizes WHERE competition_id = ?");
  const markRedeemed = db.prepare("UPDATE competition_prizes SET redeemed_at = ?, redeemed_by = ? WHERE id = ? AND redeemed_at IS NULL");
  const selectMyFinals = db.prepare(`SELECT f.* FROM competition_finals f JOIN competition_signups s ON s.competition_id = f.competition_id
    WHERE s.account_id = ? AND s.status = 'active' ORDER BY f.finalized_at DESC`);

  const final = (competitionId: string) => (selectFinal.get(competitionId) as FinalRow | undefined) ?? null;
  const standingsOf = (row: FinalRow): Standing[] => {
    try { return JSON.parse(row.standings) as Standing[]; } catch { return []; }
  };

  /** 定榜：冻结名次快照，按奖项表给分数大于 0 的人各发一个兑奖码。调用方放在事务里并记操作记录。 */
  function finalize(competitionId: string, actorAccountId: string, now: number): PrizeResult<{ final: FinalRow; prizes: PrizeRow[] }> {
    const record = deps.competitions.get(competitionId);
    if (!record) return { ok: false, error: "not_found" };
    if (deps.signupScoring(competitionId) !== "contribution") return { ok: false, error: "scoring_not_enabled" };
    if (now <= record.end_at) return { ok: false, error: "not_ended" };
    if (final(competitionId)) return { ok: false, error: "already_finalized" };
    const standings = deps.scores.standings(competitionId);
    insertFinal.run(competitionId, now, actorAccountId, JSON.stringify(standings));
    const tiers = deps.rules.get(competitionId).prizes;
    for (const standing of standings) {
      if (standing.points <= 0) continue;
      const tier = prizeForRank(tiers, standing.rank);
      if (!tier) continue;
      const code = generatePrizeCode();
      const normalized = normalizePrizeCode(code)!;
      insertPrize.run({
        id: randomUUID(), competition_id: competitionId, account_id: standing.account_id, rank: standing.rank, points: standing.points,
        amount_cny: tier.amount_cny, title: tier.title, code_hash: prizeCodeHash(normalized), code_cipher: deps.crypto.encrypt(code),
        code_hint: normalized.slice(-4), created_at: now,
      });
    }
    return { ok: true, value: { final: final(competitionId)!, prizes: selectPrizes.all(competitionId) as PrizeRow[] } };
  }

  /** 撤销定榜：只有一个奖都没核销时可以，兑奖码随之作废。 */
  function unfinalize(competitionId: string): PrizeResult<{ prizes_removed: number }> {
    if (!deps.competitions.get(competitionId)) return { ok: false, error: "not_found" };
    if (!final(competitionId)) return { ok: false, error: "not_finalized" };
    if ((countRedeemed.get(competitionId) as { n: number }).n > 0) return { ok: false, error: "prizes_redeemed" };
    const removed = deletePrizes.run(competitionId).changes;
    deleteFinal.run(competitionId);
    return { ok: true, value: { prizes_removed: removed } };
  }

  function summary(competitionId: string): { final: FinalRow; standings: Standing[]; prizes: PrizeRow[] } | null {
    const row = final(competitionId);
    return row ? { final: row, standings: standingsOf(row), prizes: selectPrizes.all(competitionId) as PrizeRow[] } : null;
  }

  function lookup(code: string): PrizeRow | null {
    const normalized = normalizePrizeCode(code);
    return normalized ? (selectPrizeByHash.get(prizeCodeHash(normalized)) as PrizeRow | undefined) ?? null : null;
  }

  /** 核销：查不到 code_not_found，核销过 already_redeemed（带上次核销的行）。 */
  function redeem(code: string, actorAccountId: string, now: number): { ok: true; value: PrizeRow } | { ok: false; error: PrizeError; prize?: PrizeRow } {
    const prize = lookup(code);
    if (!prize) return { ok: false, error: "code_not_found" };
    if (prize.redeemed_at !== null) return { ok: false, error: "already_redeemed", prize };
    if (markRedeemed.run(now, actorAccountId, prize.id).changes !== 1) return { ok: false, error: "already_redeemed", prize: lookup(code) ?? prize };
    return { ok: true, value: lookup(code)! };
  }

  /** 本人参加过、已经定榜的比赛：名次、分数，得奖的再带奖项与兑奖码明文。 */
  function myResults(accountId: string) {
    return (selectMyFinals.all(accountId) as FinalRow[]).map(row => {
      const standing = standingsOf(row).find(item => item.account_id === accountId) ?? null;
      const prize = selectMyPrize.get(row.competition_id, accountId) as PrizeRow | undefined;
      return {
        competition_id: row.competition_id,
        name: deps.competitions.get(row.competition_id)?.name ?? row.competition_id,
        finalized_at: row.finalized_at,
        rank: standing?.rank ?? null,
        points: standing?.points ?? 0,
        prize: prize ? { amount_cny: prize.amount_cny, title: prize.title, code: deps.crypto.decrypt(prize.code_cipher), redeemed_at: prize.redeemed_at } : null,
      };
    });
  }

  return { final, finalize, unfinalize, summary, lookup, redeem, myResults };
}
export type CompetitionPrizes = ReturnType<typeof createCompetitionPrizes>;
