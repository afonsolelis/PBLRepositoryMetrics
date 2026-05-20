# CEP Pattern Catalogue — PBLRepositoryMetrics

Catalogue of the nine team-level Complex Event Processing (CEP) patterns
referenced from the SoftwareX manuscript
(*PBLRepositoryMetrics: SCM-Grounded Conformance Evaluation for PBL Digital Twins*).

All patterns operate at the **team-artifact level**. Individual member
assessment is the exclusive prerogative of the professor. Multiple patterns
can fire simultaneously, and the same negative conformance delta receives a
different pedagogical interpretation depending on which patterns are active.

The patterns are grouped into four families:

1. **Temporal distribution events** — delivery rhythm issues
2. **Process flow events** — review and traceability problems
3. **Commit quality events** (from diff analysis) — code discipline issues
4. **Document deliverable events** (from structural check) — deliverable completeness problems

---

## 1. Temporal distribution events

### `CRAMMING_RISK` — Warning

**Detection condition:** More than 50 % of commits in the sprint are
concentrated in the last 20 % of the sprint window.

**Pedagogical interpretation:** The team is delivering late; work
distribution over the sprint is uneven. Risk of incomplete or low-quality
delivery at deadline.

### `LOW_CADENCE` — Critical

**Detection condition:** Cumulative commits at day *D* fall below 40 % of the
value expected from `expected_commits(D) = commits_per_day × D`.

**Pedagogical interpretation:** At the current pace, the team will not reach
the sprint commit minimum. Intervention is needed before sprint end.

---

## 2. Process flow events

### `MR_BOTTLENECK` — Warning

**Detection condition:** A merge request has remained in `opened` state for
more than **3 working days** without being merged.

**Pedagogical interpretation:** Code review is stalled. Unmerged work
accumulates integration risk and delays delivery verification.

### `QUALITY_DRIFT` — Warning

**Detection condition:** Conventional-commit compliance (`feat`, `fix`,
`docs`, etc.) is below **50 %** of total commits in the sprint.

**Pedagogical interpretation:** The team is not following the commit format
required by the Sprint Descriptor. Reduces SCM traceability and audit quality.

---

## 3. Commit quality events (from diff analysis)

### `MONOLITHIC_COMMIT` — Warning

**Detection condition:** A commit changes more than **300 lines** across all
files.

**Pedagogical interpretation:** Commit is not atomic. Large commits are
harder to review, increase integration risk, and reduce traceability of
individual changes.

### `NO_TESTS` — Warning

**Detection condition:** Code changes exist under `src/` but zero commits
touch any file under `tests/` or matching the `test_*` glob.

**Pedagogical interpretation:** The team is delivering code without
automated tests. Undermines quality assurance and makes regression detection
impossible.

### `CHURN_HOTSPOT` — Warning

**Detection condition:** The same file has been edited more than **5 times**
during the sprint.

**Pedagogical interpretation:** Excessive churn on a single file may
indicate poor modular design, repeated bug fixing, or unstable requirements
for that component.

---

## 4. Document deliverable events (from structural check)

### `MISSING_DELIVERABLE` — Critical

**Detection condition:** A document file specified in the Sprint Descriptor
(`path` field) does not exist in the repository.

**Pedagogical interpretation:** The team has not created the expected
document. The deliverable cannot be evaluated structurally or semantically.

### `SKELETON_DOCUMENT` — Warning

**Detection condition:** A document file exists but has fewer than **50 words
per expected section** or contains placeholder text such as `TODO` or
`em desenvolvimento`.

**Pedagogical interpretation:** Document exists but lacks substantive
content. May indicate rushed or incomplete work.

---

## Summary table

| Pattern | Severity | Threshold |
|---------|----------|-----------|
| `CRAMMING_RISK` | Warning | > 50 % commits in last 20 % of sprint |
| `LOW_CADENCE` | Critical | Cumulative commits < 40 % of expected |
| `MR_BOTTLENECK` | Warning | MR `opened` > 3 working days |
| `QUALITY_DRIFT` | Warning | Conventional-commit rate < 50 % |
| `MONOLITHIC_COMMIT` | Warning | Commit > 300 lines changed |
| `NO_TESTS` | Warning | `src/` changed, `tests/` untouched |
| `CHURN_HOTSPOT` | Warning | Same file edited > 5 times |
| `MISSING_DELIVERABLE` | Critical | Expected document file absent |
| `SKELETON_DOCUMENT` | Warning | < 50 words/section or placeholder text |
