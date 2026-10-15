# Issues — English overview

> English navigation companion; the linked Chinese document is the canonical policy.

状态：`current` · 更新：2026-10-15

The current, complete policy is [ISSUES.md](ISSUES.md). This overview does not define a second set of rules.

Use the repository root as the entry, keep changes scoped, preserve unrelated work, update contracts/tests/docs together, and record actual validation. Commits use Conventional Commits with a Chinese subject. Local checks are `pnpm verify`; browser checks are explicit. Production resources, publishing, merging and deployment require separate authorization. Proposed and historical documents never override current module contracts.

Every issue and PR carries at least one type label of the form `group:kind` (`ui:*` needs screenshots, `func:*` needs interface tests and verification, `infra:*` needs command output), and lists related open and closed issues in its body. See [ISSUES](ISSUES.md) §2.
