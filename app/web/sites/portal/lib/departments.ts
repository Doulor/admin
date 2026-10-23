// 组织架构的部门（#274 的 GET /api/public/departments，CONTRACT-274 §1）：AI、算法、硬件、网安、管理五个部门和「无部门」，
// 名字、图标、部门色、说明和称号都在控制台改，官网按接口给的顺序画。部门色是 YUGC 四个字母色加胶囊蓝、次要文字色（SPEC §1）。
// 数据没到或读不到时用和服务端初始数据一样的默认值顶上，窗口不空着，也不闪成报错。
import { useEffect, useState } from "react";
import { api } from "@shared/lib/api";
import type { DepartmentTone } from "./account";
import { isIconName, type IconName } from "./icons";

export type DepartmentTitle = { id: string; name: string; weight: number };
export type Department = { id: string; name: string; tone: DepartmentTone; icon: IconName; description: string; titles: DepartmentTitle[] };

export const DEPARTMENTS_URL = "/api/public/departments";

const TONES: readonly DepartmentTone[] = ["y", "u", "g", "c", "pill", "ink"];
/** 部门图标是 Remix 图标名；认不出的（控制台填错、注册表里没有）用中性的人群图标 */
const FALLBACK_ICON: IconName = "team-line";

function seed(id: string, name: string, tone: DepartmentTone, icon: IconName, headWeight = 60): Department {
  return {
    id: `dept.${id}`,
    name,
    tone,
    icon,
    description: `${name}成员`,
    titles: [
      { id: `title.${id}.head`, name: "部长", weight: headWeight },
      { id: `title.${id}.deputy`, name: "副部长", weight: 50 },
      { id: `title.${id}.staff`, name: "部员", weight: 40 },
    ],
  };
}

/** 和服务端初始数据一致（app/server 的 #274 迁移），只在数据还没到或读不到时用 */
export const DEFAULT_DEPARTMENTS: readonly Department[] = [
  seed("ai", "AI部门", "y", "robot-2-line"),
  seed("algo", "算法部门", "u", "code-s-slash-line"),
  seed("hardware", "硬件部门", "c", "cpu-line"),
  seed("security", "网安部门", "g", "shield-keyhole-line"),
  seed("management", "管理部门", "pill", "government-line", 80),
  { id: "dept.none", name: "无部门", tone: "ink", icon: "user-line", description: "没有分配部门的账号（默认）", titles: [] },
];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** 读接口响应：缺 id 或名字的条目丢掉，色调和图标认不出时换成默认；整份读不出或一个部门都没有时用默认值 */
export function readDepartments(body: unknown): Department[] {
  const list = isRecord(body) && Array.isArray(body.departments) ? body.departments : [];
  const departments = list.filter(isRecord).flatMap((item): Department[] => {
    const id = text(item.id);
    const name = text(item.name);
    if (!id || !name) return [];
    const titles = (Array.isArray(item.titles) ? item.titles : [])
      .filter(isRecord)
      .flatMap((title) => (text(title.id) && text(title.name) ? [{ id: text(title.id), name: text(title.name), weight: typeof title.weight === "number" ? title.weight : 0 }] : []))
      .sort((a, b) => b.weight - a.weight);
    return [
      {
        id,
        name,
        tone: TONES.includes(item.tone as DepartmentTone) ? (item.tone as DepartmentTone) : "ink",
        icon: isIconName(text(item.icon)) ? (text(item.icon) as IconName) : FALLBACK_ICON,
        description: text(item.description),
        titles,
      },
    ];
  });
  return departments.length ? departments : [...DEFAULT_DEPARTMENTS];
}

/** 窗口打开时读一次部门，关掉就取消请求；读到之前和读不到时是默认值 */
export function useDepartments(): Department[] {
  const [departments, setDepartments] = useState<Department[]>(() => [...DEFAULT_DEPARTMENTS]);
  useEffect(() => {
    const controller = new AbortController();
    api<unknown>(DEPARTMENTS_URL, { signal: controller.signal, headers: { Accept: "application/json" } }).then(
      (body) => {
        if (!controller.signal.aborted) setDepartments(readDepartments(body));
      },
      () => {
        // 读不到（离线、接口不通）就继续显示默认值
      },
    );
    return () => controller.abort();
  }, []);
  return departments;
}
