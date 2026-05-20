# Database Schema — PBLRepositoryMetrics

Complete MongoDB collection schemas referenced from the SoftwareX manuscript
(*PBLRepositoryMetrics: SCM-Grounded Conformance Evaluation for PBL Digital Twins*).

The persistence layer comprises **13 collections**: two **time-series collections**
(`commits`, `daily_conformance`) configured with MongoDB's native temporal
bucketing, and **eleven standard document collections**. Each time-series
collection declares:

- `timeField` — the temporal dimension for bucketing
- `metaField` — the entity identifier co-located inside each bucket
- `granularity` — bucket-span hint (`hours`)

This configuration enables CEP evaluation and conformance trajectory queries to
scan temporally ordered, columnar-compressed data without application-level
time partitioning.

---

## Time-series collections

### `commits` — SCM configuration items

Time-series: `timeField = committed_date`, `metaField = project_id`, granularity = `hours`.

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | Int32 | Project identifier (metaField) |
| `committed_date` | Date | Commit timestamp (timeField) |
| `sha` | String | Git commit SHA-1 hash |
| `author_name` | String | Committer full name |
| `author_email` | String | Committer email address |
| `message` | String | Commit message (conventional format matched via regex) |
| `additions` | Int32 | Lines added |
| `deletions` | Int32 | Lines deleted |

### `daily_conformance` — CEP evaluation results

Time-series: `timeField = evaluated_at`, `metaField = project_id`, granularity = `hours`.

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | Int32 | Project identifier (metaField) |
| `evaluated_at` | Date | Evaluation timestamp (timeField) |
| `sprint_id` | String | Sprint identifier (e.g., `M7-S3`) |
| `sprint_day` | Int32 | Elapsed working days in sprint |
| `total_working_days` | Int32 | Total sprint working days |
| `sprint_progress_ratio` | Double | Progress ratio (0.0–1.0) |
| `total_members` | Int32 | Team size |
| `expected` | Object | `{commits_cumulative, active_members, mrs_merged, issues_closed}` |
| `actual` | Object | `{commits_cumulative, active_members_today, mrs_merged, issues_closed}` |
| `distance` | Object | Signed deltas: `{commits, members, mrs, issues}` |
| `conventional_commit_rate` | Double | Conventional commit compliance (0.0–1.0) |
| `patterns` | Array | Detected CEP patterns, each with `{type, severity, message}` |
| `score` | Double | Weighted conformance score (0.0–1.0) |
| `strong_points` | Array | Positive diagnostic findings |
| `weak_points` | Array | Areas needing improvement |
| `trend` | String | Score trend: `stable`, `improving`, or `deteriorating` |
| `dimension_scores` | Object | `{commit_quality, review_process, issue_tracking, delivery_cadence}` |

---

## Standard document collections

### `projects` — team project metadata

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | Int32 | Unique project identifier |
| `name` | String | Project display name |
| `path_with_namespace` | String | GitLab path (e.g., `inteli-m7/team-alpha-s3`) |
| `description` | String | Project description |
| `created_at` | String | Creation timestamp (ISO 8601) |
| `default_branch` | String | Default branch (e.g., `main`) |
| `web_url` | String | GitLab project URL |
| `pattern` | String | Conformance pattern label |

### `members` — team membership

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | Int32 | Project identifier |
| `user_id` | Int32 | Member identifier |
| `username` | String | GitLab username |
| `name` | String | Full name |
| `access_level` | Int32 | GitLab access level (30 = developer, 40 = maintainer) |

### `merge_requests` — code review workflow

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | Int32 | Project identifier |
| `iid` | Int32 | MR internal identifier |
| `title` | String | MR title |
| `author_username` | String | Author GitLab username |
| `author_name` | String | Author full name |
| `state` | String | State: `opened`, `merged`, or `closed` |
| `source_branch` | String | Feature branch name |
| `target_branch` | String | Target branch |
| `created_at` | Date | Creation timestamp |
| `merged_at` | Date/Null | Merge timestamp |
| `closed_at` | Date/Null | Close timestamp |
| `merge_commit_sha` | String/Null | Merge commit SHA |

### `issues` — issue tracking

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | Int32 | Project identifier |
| `iid` | Int32 | Issue internal identifier |
| `title` | String | Issue title |
| `author_username` | String | Author GitLab username |
| `state` | String | State: `opened` or `closed` |
| `labels` | Array | Labels (e.g., `sprint-3`, `easy`, `medium`) |
| `created_at` | Date | Creation timestamp |
| `closed_at` | Date/Null | Closure timestamp |
| `assignees` | Array | Assignees, each with `{username, name}` |

### `sprint_descriptors` — SCM baseline specifications

| Field | Type | Description |
|-------|------|-------------|
| `sprint_id` | String | Unique identifier (e.g., `M7-S3`, `ES11-S1-v2`) |
| `module` | String | Module code (`M7`, `ES11`) |
| `sprint_number` | Int32 | Sprint sequence number |
| `title` | String | Sprint title |
| `partner` | String | Corporate partner name |
| `baseline_version` | Int32 | Baseline version (starts at 1) |
| `baseline_origin` | String | Origin: `metaproject` or `professor_grade_10` |
| `start_date` | String | Sprint start (YYYY-MM-DD) |
| `end_date` | String | Sprint end (YYYY-MM-DD) |
| `working_days` | Int32 | Total working days |
| `deliverables` | Array | `{id, name, type, path, expected_sections, evaluation_criteria, weight}` |
| `commit_requirements` | Object | `{min_total, conventional_format, min_per_member, max_median_size, min_test_ratio}` |
| `expected_daily_pace` | Object | `{commits_per_day, active_members_ratio, issues_closed_per_week}` |
| `rubric_weights` | Object | CEP dimension weights: `{commit_quality, review_process, issue_tracking, delivery_cadence}` |
| `assessment_weights` | Object | Synthesis weights: `{structural_conformance, semantic_quality, commit_discipline, quantitative_cep}` |

### `file_snapshots` — document content captures

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | Int32 | Project identifier |
| `sprint_id` | String | Sprint identifier |
| `deliverable_id` | String | Deliverable identifier |
| `path` | String | File path in repository |
| `content` | String | Full Markdown content |
| `headings` | Array | Extracted heading names |
| `word_count` | Int32 | Total word count |
| `table_count` | Int32 | Number of tables |
| `captured_at` | String | Capture timestamp (ISO 8601) |

### `commit_diffs` — per-commit file change analysis

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | Int32 | Project identifier |
| `sha` | String | Commit SHA |
| `author_name` | String | Committer name |
| `committed_date` | Date | Commit timestamp |
| `message` | String | Commit message |
| `files_changed` | Array | Per-file stats: `{path, additions, deletions, is_test, is_doc, is_config}` |
| `total_lines` | Int32 | Total lines changed across all files |

### `semantic_assessments` — LLM evaluation results

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | Int32 | Project identifier |
| `sprint_id` | String | Sprint identifier |
| `deliverable_id` | String | Deliverable identifier |
| `model_used` | String | LLM model identifier (e.g., `gemma3:27b`) |
| `section_assessments` | Array | Per-section: `{section, present, completeness, quality, feedback}` |
| `overall_semantic_score` | Double | Aggregate semantic quality (0.0–1.0) |
| `executive_summary` | String | Brief assessment summary |
| `strengths` | Array | Identified strengths |
| `weaknesses` | Array | Identified weaknesses |
| `recommended_actions` | Array | Actionable suggestions |
| `evaluated_at` | String | Evaluation timestamp (ISO 8601) |

### `deliverable_conformance` — composite scores per deliverable

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | Int32 | Project identifier |
| `sprint_id` | String | Sprint identifier |
| `deliverable_id` | String | Deliverable identifier |
| `deliverable_weight` | Double | Weight in project synthesis |
| `structural_score` | Double | Phase 2a structural completeness |
| `semantic_score` | Double | Phase 3 semantic quality |
| `commit_score` | Double | Phase 2b commit/diff quality |
| `cep_score` | Double | Phase 2 CEP quantitative score |
| `final_score` | Double | Weighted composite score |
| `strong_points` | Array | Consolidated strengths |
| `weak_points` | Array | Consolidated weaknesses |
| `patterns` | Array | Associated CEP patterns |
| `evaluated_at` | String | Evaluation timestamp (ISO 8601) |

### `project_conformance_summary` — project-level aggregated scores

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | Int32 | Project identifier |
| `sprint_id` | String | Sprint identifier |
| `weighted_score` | Double | Weighted average across deliverables |
| `deliverable_count` | Int32 | Number of deliverables evaluated |
| `deliverables` | Array | Per-deliverable: `{id, name, weight, structural/semantic/commit/cep/final_score}` |
| `all_patterns` | Array | Unique CEP pattern types |
| `top_strong_points` | Array | Top 5 strengths |
| `top_weak_points` | Array | Top 5 weaknesses |
| `evaluated_at` | String | Evaluation timestamp (ISO 8601) |

### `baseline_history` — baseline evolution audit trail

| Field | Type | Description |
|-------|------|-------------|
| `action` | String | Action type (`promote_grade_10`) |
| `from_sprint_id` | String | Original baseline sprint ID |
| `to_sprint_id` | String | Evolved baseline sprint ID |
| `project_id` | Int32 | Promoted project identifier |
| `professor_note` | String/Null | Professor justification |
| `previous_version` | Int32 | Prior baseline version |
| `new_version` | Int32 | New baseline version |
| `actual_metrics` | Object | `{commits, mrs_merged, issues_closed, score}` |
| `deliverable_scores` | Array | Per-deliverable: `{deliverable_id, final_score}` |
| `created_at` | String | Event timestamp (ISO 8601) |
