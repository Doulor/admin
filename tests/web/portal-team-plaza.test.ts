// 组队广场（#278）门户这边的读响应与地址：两种条目各缺关键字段时整条丢掉，筛选条件只带填了的。
import { describe, expect, it } from "vitest";
import { plazaPath, readPlaza, readTeam } from "../../app/web/sites/portal/lib/competitionHub";

const person = (login: string) => ({ account_id: `acc_${login}`, login, avatar_url: null });

describe("team plaza reader", () => {
  it("keeps both kinds and drops entries missing what the card needs", () => {
    const page = readPlaza({
      items: [
        { kind: "recruiting_team", competition_id: "c1", competition_name: "黑客松", note: "缺前端", since: 10, team_id: "t1", team_name: "长江队", slogan: "", leader: person("lead"), member_count: 2, team_max: 4, wanted_skills: ["前端", 3, ""] },
        { kind: "seeking_team", competition_id: "c1", competition_name: "黑客松", note: "大一", since: 9, person: person("newbie") },
        { kind: "recruiting_team", competition_id: "c1", competition_name: "黑客松", note: "", since: 8 },
        { kind: "seeking_team", competition_id: "c1", competition_name: "黑客松", note: "", since: 7, person: null },
        { kind: "other", competition_id: "c1" },
      ],
      next_cursor: null,
    });
    expect(page?.items.map((item) => item.kind)).toEqual(["recruiting_team", "seeking_team"]);
    expect(page?.items[0]).toMatchObject({ team_name: "长江队", member_count: 2, team_max: 4, wanted_skills: ["前端"], person: null });
    expect(page?.items[1]).toMatchObject({ person: { login: "newbie" }, team_id: null, wanted_skills: null });
    expect(readPlaza({ nope: true })).toBeNull();
  });

  it("puts only the filled filters into the query string", () => {
    expect(plazaPath({ competition: null, kind: null, keyword: "" })).toBe("/api/team-plaza");
    expect(plazaPath({ competition: "c1", kind: "seeking_team", keyword: "前端" })).toBe("/api/team-plaza?competition_id=c1&kind=seeking_team&keyword=%E5%89%8D%E7%AB%AF");
  });

  it("reads a team's plaza broadcast, defaulting to not recruiting", () => {
    const base = { id: "t1", name: "长江队", members: [], member_count: 1 };
    expect(readTeam({ ...base, plaza: { recruiting: true, note: "缺人", wanted_skills: ["后端"] } })?.plaza).toEqual({ recruiting: true, note: "缺人", wanted_skills: ["后端"] });
    expect(readTeam(base)?.plaza).toEqual({ recruiting: false, note: "", wanted_skills: [] });
  });
});
