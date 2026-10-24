import { describe, expect, it } from 'vitest';
import { departmentScopedAccess } from '../../app/server/src/lib/console-scope';
import type { ResolvedEntry } from '../../app/server/src/lib/permissions';

/** 直接构造 ResolvedEntry，不经过数据库——这是纯函数，单测不用起一个账号、一个组。 */
function entry(node: string, value: boolean, scope: Record<string, unknown> = {}): ResolvedEntry {
  return {
    id: Math.floor(Math.random() * 1_000_000), subjectType: 'account', subjectId: 'acct-x', node, value, scope,
    metaValue: null, expiresAt: null, grantedBy: 'test', createdAt: Date.now(), group: null, via: [],
  };
}

describe('departmentScopedAccess（#274 残留修复 J.2：部门级 deny 要能减掉部门级 allow，「有 deny 即 deny」）', () => {
  it('只有不限定 scope 的 allow → full（不过滤）', () => {
    expect(departmentScopedAccess([entry('apply.view', true)], 'apply.view')).toEqual({ kind: 'full' });
  });

  it('只有不限定 scope 的 deny → none', () => {
    expect(departmentScopedAccess([entry('apply.view', false)], 'apply.view')).toEqual({ kind: 'none' });
  });

  it('只有按部门限定的 allow → scoped 到那些部门', () => {
    const entries = [entry('apply.view', true, { department: ['dept.ai'] })];
    expect(departmentScopedAccess(entries, 'apply.view')).toEqual({ kind: 'scoped', departments: ['dept.ai'] });
  });

  it('同一个部门既有按部门限定的 allow 又有按部门限定的 deny：deny 赢，这个部门被减掉（原来的 bug：deny 被忽略，这个部门仍然算能看）', () => {
    const entries = [
      entry('apply.view', true, { department: ['dept.ai'] }),
      entry('apply.view', false, { department: ['dept.ai'] }),
    ];
    expect(departmentScopedAccess(entries, 'apply.view')).toEqual({ kind: 'none' });
  });

  it('两个部门都有按部门限定的 allow，其中一个被同部门的按部门限定 deny 减掉，只剩另一个', () => {
    const entries = [
      entry('apply.view', true, { department: ['dept.ai'] }),
      entry('apply.view', true, { department: ['dept.algo'] }),
      entry('apply.view', false, { department: ['dept.ai'] }),
    ];
    expect(departmentScopedAccess(entries, 'apply.view')).toEqual({ kind: 'scoped', departments: ['dept.algo'] });
  });

  it('不相关节点、不相关 scope 维度的条目不参与判定', () => {
    const entries = [entry('users.view', true, { department: ['dept.ai'] }), entry('apply.view', true, { category: ['c-ai'] })];
    expect(departmentScopedAccess(entries, 'apply.view')).toEqual({ kind: 'none' });
  });
});
