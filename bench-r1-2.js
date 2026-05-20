/**
 * Benchmark script for R1.2 (SoftwareX revision).
 *
 * Measures wall-clock time per pipeline phase using the LGPD-safe
 * synthetic dataset (5 teams). Outputs a JSON file (bench-results.json)
 * with per-phase timings and aggregate stats, plus a readable table on
 * stdout suitable for pasting into the manuscript.
 *
 * Usage:
 *   MONGODB_URI=mongodb://localhost:27017/afonsystem \
 *   ANTHROPIC_API_KEY=sk-... (optional, enables Phase 3) \
 *   node bench-r1-2.js
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const { connectDB, getDB } = require('./config/db');
const { seed } = require('./seeds/simulation-data-generator');
const { seedDocuments } = require('./seeds/simulation-document-generator');
const { runEvaluation } = require('./services/conformance-evaluator');
const { checkAllDeliverables } = require('./services/structural-checker');
const { analyzeProject } = require('./services/diff-analyzer');
const { analyzeAllDeliverables } = require('./services/semantic-analyzer');
const { synthesizeProject } = require('./services/synthesis');

const HAS_LLM = !!(process.env.ANTHROPIC_API_KEY || process.env.LLM_BASE_URL);

function ms(t0, t1) { return Math.round((t1 - t0) * 100) / 100; }

function summarise(samples) {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  const mean = sum / samples.length;
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
  const stddev = Math.sqrt(variance);
  return {
    n: samples.length,
    mean_ms: Math.round(mean * 100) / 100,
    stddev_ms: Math.round(stddev * 100) / 100,
    min_ms: sorted[0],
    median_ms: sorted[Math.floor(sorted.length / 2)],
    max_ms: sorted[sorted.length - 1],
  };
}

async function clearAll() {
  const db = getDB();
  const cols = [
    'projects', 'members', 'commits', 'merge_requests', 'issues',
    'sprint_descriptors', 'file_snapshots', 'commit_diffs',
    'daily_conformance', 'semantic_assessments',
    'deliverable_conformance', 'project_conformance_summary',
    'baseline_history',
  ];
  for (const c of cols) {
    try { await db.collection(c).deleteMany({}); } catch {}
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' PBLRepositoryMetrics — Pipeline Timing Benchmark (R1.2)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Node:           ${process.version}`);
  console.log(`Platform:       ${process.platform} ${process.arch}`);
  console.log(`MongoDB URI:    ${process.env.MONGODB_URI || 'mongodb://localhost:27017/afonsystem'}`);
  console.log(`LLM provider:   ${HAS_LLM ? (process.env.LLM_BASE_URL ? 'OpenAI-compatible' : 'Anthropic Claude') : 'NONE (Phase 3 will be skipped)'}`);
  console.log('');

  await connectDB();
  console.log('[bench] Connected to MongoDB.');

  console.log('[bench] Clearing prior collections...');
  await clearAll();

  // ─── Phase 1: Event acquisition (surrogate via seed) ────────────────────
  console.log('[bench] Phase 1 — seeding LGPD-safe synthetic data...');
  const t1_a = performance.now();
  await seed();
  const t1_b = performance.now();
  const phase1_seed_ms = ms(t1_a, t1_b);

  const db = getDB();
  const projects = await db.collection('projects').find({}).toArray();

  // Document seed (file_snapshots + commit_diffs)
  const commitsByProject = {};
  for (const p of projects) {
    commitsByProject[p.project_id] = await db.collection('commits')
      .find({ project_id: p.project_id }).toArray();
  }
  const teams = projects.map(p => ({
    project_id: p.project_id,
    name: p.name,
    pattern: p.pattern,
    members: [],
  }));

  const t1d_a = performance.now();
  await seedDocuments(db, teams, commitsByProject);
  const t1d_b = performance.now();
  const phase1_docs_ms = ms(t1d_a, t1d_b);

  const totalCommits = await db.collection('commits').countDocuments();
  const totalMRs = await db.collection('merge_requests').countDocuments();
  const totalIssues = await db.collection('issues').countDocuments();
  const totalSnapshots = await db.collection('file_snapshots').countDocuments();
  const totalDiffs = await db.collection('commit_diffs').countDocuments();

  console.log(`        seed: ${phase1_seed_ms} ms · docs+diffs: ${phase1_docs_ms} ms`);
  console.log(`        items: ${projects.length} projects · ${totalCommits} commits · ${totalMRs} MRs · ${totalIssues} issues · ${totalSnapshots} snapshots · ${totalDiffs} diffs`);

  // ─── Phase 2: CEP evaluation ────────────────────────────────────────────
  console.log('[bench] Phase 2 — CEP evaluation...');
  const t2_a = performance.now();
  await runEvaluation('2026-03-30');
  const t2_b = performance.now();
  const phase2_ms = ms(t2_a, t2_b);
  console.log(`        ${phase2_ms} ms total · ${(phase2_ms / projects.length).toFixed(2)} ms/project`);

  // ─── Phases 2a / 2b / 3 / 4 per project ────────────────────────────────
  const descriptor = await db.collection('sprint_descriptors').findOne({ sprint_id: 'ES11-S1' });
  if (!descriptor) {
    console.error('[bench] No ES11-S1 descriptor found, aborting.');
    process.exit(1);
  }

  const per = {
    phase2a: [],
    phase2b: [],
    phase3: [],
    phase4: [],
    total: [],
  };

  for (const p of projects) {
    const tt0 = performance.now();

    const t2a_a = performance.now();
    const structuralResults = await checkAllDeliverables(p.project_id, descriptor);
    const t2a_b = performance.now();

    const t2b_a = performance.now();
    const diffMetrics = await analyzeProject(p.project_id, 'ES11-S1');
    const t2b_b = performance.now();

    let semanticResults = null;
    let phase3_ms = null;
    if (HAS_LLM) {
      const t3_a = performance.now();
      try {
        semanticResults = await analyzeAllDeliverables(
          p.project_id, descriptor, structuralResults, diffMetrics
        );
        const t3_b = performance.now();
        phase3_ms = ms(t3_a, t3_b);
      } catch (e) {
        console.warn(`        [${p.name}] Phase 3 failed: ${e.message}`);
        phase3_ms = null;
      }
    }

    const cep = await db.collection('daily_conformance').findOne(
      { project_id: p.project_id }, { sort: { sprint_day: -1 } }
    );

    const t4_a = performance.now();
    if (semanticResults) {
      await synthesizeProject(p.project_id, 'ES11-S1', descriptor, structuralResults, diffMetrics, semanticResults, cep);
    }
    const t4_b = performance.now();
    const phase4_ms = semanticResults ? ms(t4_a, t4_b) : null;

    const tt1 = performance.now();

    per.phase2a.push(ms(t2a_a, t2a_b));
    per.phase2b.push(ms(t2b_a, t2b_b));
    if (phase3_ms !== null) per.phase3.push(phase3_ms);
    if (phase4_ms !== null) per.phase4.push(phase4_ms);
    per.total.push(ms(tt0, tt1));

    console.log(`        [${p.name.padEnd(15)}] 2a:${ms(t2a_a, t2a_b).toString().padStart(7)}ms · 2b:${ms(t2b_a, t2b_b).toString().padStart(7)}ms${phase3_ms !== null ? ' · 3:' + phase3_ms.toString().padStart(8) + 'ms' : ''}${phase4_ms !== null ? ' · 4:' + phase4_ms.toString().padStart(6) + 'ms' : ''}`);
  }

  // ─── Aggregate ──────────────────────────────────────────────────────────
  const result = {
    environment: {
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      mongodb_uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/afonsystem',
      llm_provider: HAS_LLM ? (process.env.LLM_BASE_URL ? 'openai-compatible' : 'anthropic') : 'none',
      timestamp: new Date().toISOString(),
    },
    dataset: {
      projects: projects.length,
      commits: totalCommits,
      merge_requests: totalMRs,
      issues: totalIssues,
      file_snapshots: totalSnapshots,
      commit_diffs: totalDiffs,
    },
    phase_timings_ms: {
      phase1_seed:          phase1_seed_ms,
      phase1_docs_diffs:    phase1_docs_ms,
      phase1_total:         phase1_seed_ms + phase1_docs_ms,
      phase2_cep_total:     phase2_ms,
      phase2_cep_per_project: Math.round((phase2_ms / projects.length) * 100) / 100,
      phase2a_structural:   summarise(per.phase2a),
      phase2b_diff:         summarise(per.phase2b),
      phase3_semantic:      summarise(per.phase3),
      phase4_synthesis:     summarise(per.phase4),
      project_total:        summarise(per.total),
    },
  };

  const outPath = path.join(__dirname, 'bench-results.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' Summary (all in ms)                                       ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Phase 1 — Event acquisition (seed):     ${phase1_seed_ms} ms`);
  console.log(`Phase 1 — Documents & diffs:            ${phase1_docs_ms} ms`);
  console.log(`Phase 2 — CEP evaluation (5 projects):  ${phase2_ms} ms (${(phase2_ms / projects.length).toFixed(2)} ms/project)`);
  const fmt = (s) => s ? `mean ${s.mean_ms} ± ${s.stddev_ms} (n=${s.n}, min ${s.min_ms}, max ${s.max_ms})` : 'n/a';
  console.log(`Phase 2a — Structural check (per proj): ${fmt(result.phase_timings_ms.phase2a_structural)}`);
  console.log(`Phase 2b — Diff analysis (per proj):    ${fmt(result.phase_timings_ms.phase2b_diff)}`);
  console.log(`Phase 3 — Semantic (LLM, per proj):     ${fmt(result.phase_timings_ms.phase3_semantic)}`);
  console.log(`Phase 4 — Synthesis (per proj):         ${fmt(result.phase_timings_ms.phase4_synthesis)}`);
  console.log('');
  console.log(`JSON: ${outPath}`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
