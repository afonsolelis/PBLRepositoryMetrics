# PBLRepositoryMetrics

**SCM-Grounded Conformance Evaluation for PBL Digital Twins**

PBLRepositoryMetrics is a teacher-support system for Project-Based Learning (PBL) environments. It captures repository events from GitLab and evaluates them against a Software Configuration Management (SCM) baseline defined by a metaproject (Sprint Descriptor), using Complex Event Processing (CEP) to compute daily conformance distances. A four-phase pipeline performs static verification, dynamic CEP pattern detection, and LLM-based semantic evaluation, producing per-deliverable diagnostic reports for evaluators. The baseline evolves through professor assessment, preserving the professor as the final interpreter.

This repository is the software artifact accompanying the SoftwareX manuscript *"PBLRepositoryMetrics: SCM-Grounded Conformance Evaluation for PBL Digital Twins"*.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Usage](#usage)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Reproducibility](#reproducibility)
- [Contributing](#contributing)
- [License](#license)
- [Citation](#citation)
- [Support](#support)

---

## Overview

Project-Based Learning in computing education produces heterogeneous digital evidence in team Git repositories (commits, merge requests, issues, documents). Evaluators (monitors, specialist professors, advisors) need a systematic mechanism to measure the daily distance between the SCM baseline encoded in the Project Charter (TAPI) and the actual configuration state in each team's repository.

PBLRepositoryMetrics observes repository events and evaluates them against the SCM baseline defined by the Sprint Descriptor (the machine-readable form of the TAPI). It operates as the observability layer of the PBL Digital Twin, producing diagnostic reports that tell each evaluator *where* a given team stands relative to the baseline and *why*.

The system **does not replace the professor**: individual assessment remains the exclusive prerogative of the human evaluator. All automated analysis is scoped to the **team artifact level**.

## Features

- **Event acquisition** — daily batch capture of commits, merge requests, issues, document content, and commit diffs from GitLab REST API.
- **CEP evaluation** — computes conformance distances and detects nine categories of temporal patterns against the Sprint Descriptor (cramming risk, low cadence, review bottlenecks, etc.).
- **Structural check** — deterministic verification that document deliverables exist with expected sections and substantive (non-placeholder) content.
- **Diff analysis** — commit-level atomicity, test ratio, churn hotspots, and monolithic-commit detection.
- **Semantic analysis** — LLM-based evaluation of document content quality against metaproject rubric criteria (Anthropic Claude API; mock mode available).
- **Synthesis** — composite diagnostic report per deliverable with strengths, weaknesses, and weighted score.
- **Baseline evolution** — professor-driven promotion of a grade-10 project as the reference baseline for the next cohort.
- **Web dashboard** — artifact-focused conformance table, project drill-down, CEP pattern viewer, professor report.
- **JSON API and export** — per-team JSON export of commit datasets for external analysis or auditing.
- **LGPD-safe demo mode** — fully functional simulation dataset bundled in `seeds/`, usable without any real GitLab connection.

## Architecture

The daily pipeline runs sequentially:

```
Phase 1  — Event Acquisition       → GitLab REST API → commits, MRs, issues, docs
Phase 2  — CEP Evaluation          → Conformance distance, temporal patterns
Phase 2a — Structural Check        → Section completeness, placeholder detection
Phase 2b — Diff Analysis           → Atomicity, test ratio, churn hotspots
Phase 3  — Semantic Analysis       → LLM quality score (local or cloud)
Phase 4  — Synthesis               → Composite score + diagnostic report
```

Persistence uses MongoDB with two **Time Series Collections** (`commits`, `daily_conformance`) keyed by a `timeField` (commit or evaluation timestamp) and a `metaField` (project identifier). The remaining collections use standard document storage.

Full architectural description, static/dynamic diagrams, and persistence schema are available in the manuscript and in `specs/`.

## Requirements

- **Node.js 18+** (built-in `fetch`)
- **npm 9+**
- **MongoDB 7+** (local or Docker)
- For live mode:
  - GitLab instance with REST API access
  - Personal access token with `read_api` scope
- For semantic analysis (optional):
  - Anthropic API key (if absent, the system falls back to mock assessments based on structural checks)

Supported operating systems: Linux, macOS, Windows (any platform with Node.js and MongoDB).

## Installation

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/afonsolelis/PBLRepositoryMetrics.git
cd PBLRepositoryMetrics
cp .env.example .env
docker compose up --build
```

This starts MongoDB and the application together. The web UI is available at `http://localhost:3000`.

### Option B — Local installation

```bash
git clone https://github.com/afonsolelis/PBLRepositoryMetrics.git
cd PBLRepositoryMetrics
npm install
cp .env.example .env
# Edit .env as needed, then ensure MongoDB is running locally
npm start
```

## Configuration

Environment variables are declared in `.env` (template in `.env.example`):

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `MONGODB_URI` | yes | `mongodb://localhost:27017/afonsystem` | MongoDB connection string |
| `PORT` | no | `3000` | HTTP port |
| `SEED_ON_START` | no | `false` | If `true`, loads LGPD-safe simulation data on startup (demo mode) |
| `GITLAB_URL` | live mode | — | Base URL of the GitLab instance |
| `GITLAB_PAT` | live mode | — | GitLab personal access token (`read_api` scope) |
| `ANTHROPIC_API_KEY` | optional | — | Enables LLM-based semantic analysis; mock mode is used if unset |
| `SEMANTIC_MODEL` | optional | `claude-haiku-4-5-20251001` | LLM model identifier for semantic analysis |

## Running the Application

### Demo mode (no GitLab required)

```bash
SEED_ON_START=true npm start
```

The system seeds a complete simulation dataset (projects, commits, MRs, issues, document content, diffs), runs one CEP evaluation and one semantic-pipeline pass, and exposes the dashboard at `http://localhost:3000`. This mode is **LGPD-safe** and intended for reproducibility and review.

### Live mode (GitLab-connected)

```bash
SEED_ON_START=false GITLAB_URL=https://gitlab.example.com GITLAB_PAT=... npm start
```

A `node-cron` scheduler drives the daily pipeline. Manual triggers are exposed via the API (see below).

### Development

```bash
npm run dev          # nodemon hot reload
npm run seed         # regenerate simulation data
```

## Usage

1. Open `http://localhost:3000`.
2. Select a Sprint Descriptor (e.g., `ES11-S1`) from the filter.
3. Review the conformance table showing each team's distance from the baseline.
4. Click a project to open per-deliverable quality scores, detected CEP patterns, and the diagnostic report.
5. Use the **Professor Report** view for raw per-member repository data (subsidy for individual assessment; no automated scoring or ranking).
6. Export per-team commit datasets via `/api/projects/:id/commits.json` for external analysis.

## Testing

```bash
npm test                    # runs structural, diff, and semantic tests
npm run test:structural     # structural checker only
npm run test:diff           # diff analyzer only
npm run test:semantic       # semantic analyzer only
```

Test fixtures and results are documented in `specs/test-results.md`.

## Project Structure

```
PBLRepositoryMetrics/
├── app.js                      # Application entry point
├── config/db.js                # MongoDB connection (Time Series init)
├── routes/                     # Express routes
│   ├── api.js                  # JSON API + export endpoints
│   ├── index.js                # Dashboard
│   ├── members.js              # Member drill-down
│   ├── professor-report.js     # Raw per-member report
│   └── projects.js             # Project drill-down
├── services/                   # Pipeline services
│   ├── baseline-manager.js     # Evolutionary baseline promotion
│   ├── conformance-evaluator.js  # Phase 2 (CEP)
│   ├── diff-analyzer.js        # Phase 2b
│   ├── scheduler.js            # node-cron daily trigger
│   ├── semantic-analyzer.js    # Phase 3 (multi-provider LLM)
│   ├── semantic-pipeline.js    # Orchestrates 2a/2b/3/4
│   ├── structural-checker.js   # Phase 2a
│   └── synthesis.js            # Phase 4
├── seeds/                      # LGPD-safe simulation generators
├── specs/                      # Architecture and baseline specifications
├── tests/                      # Unit tests for each service
├── views/                      # EJS templates (pages + partials)
├── public/                     # Static assets (Bootstrap, Chart.js)
├── docker-compose.yml          # MongoDB + app orchestration
├── Dockerfile                  # Node 20 Alpine image
├── .env.example                # Environment template
├── LICENSE.txt                 # MIT License
└── README.md                   # This file
```

## API Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Dashboard |
| `GET` | `/projects/:id` | Project drill-down |
| `GET` | `/members/:id` | Member view |
| `GET` | `/professor-report` | Raw per-member data |
| `GET` | `/api/projects` | List projects (JSON) |
| `GET` | `/api/projects/:id/commits.json` | Per-team commit export |
| `GET` | `/api/conformance/:sprint` | Daily conformance for a sprint |

Full endpoint documentation is provided in `specs/semantic-conformance-architecture.md`.

## Reproducibility

The repository serves as the reproducible artifact referenced in the SoftwareX manuscript (metadata fields C3 and S3). To reproduce the results presented in the paper:

1. Clone the repository at commit `481b168` (the manuscript's reference commit, tagged `v1.0.0`).
2. Run `docker compose up --build` with `SEED_ON_START=true`.
3. Open `http://localhost:3000` and navigate to the `ES11-S1` Sprint Descriptor.

All simulation data is deterministic (fixed seeds) and LGPD-safe.

## Contributing

Issues and pull requests are welcome. Please:

1. Open an issue describing the change.
2. Fork and create a feature branch.
3. Ensure `npm test` passes.
4. Submit a pull request referencing the issue.

## License

This project is distributed under the **MIT License**. See [LICENSE.txt](LICENSE.txt) for the full text.

## Citation

If you use PBLRepositoryMetrics in academic work, please cite:

```bibtex
@article{Brandao2026PBLRepositoryMetrics,
  title   = {PBLRepositoryMetrics: SCM-Grounded Conformance Evaluation for PBL Digital Twins},
  author  = {Brand\~ao, Afonso Cesar Lelis and Arakaki, Reginaldo and da Silva, Leandro Augusto and Gon\c{c}alves, Marcelo Luiz do Amaral},
  journal = {SoftwareX},
  year    = {2026}
}
```

## Support

For questions, bug reports, or collaboration requests, contact:

**Afonso Cesar Lelis Brandão** — `afonso.brandao@prof.inteli.edu.br`

- Instituto de Tecnologia e Liderança (Inteli), São Paulo, Brazil
- Universidade Presbiteriana Mackenzie, São Paulo, Brazil
