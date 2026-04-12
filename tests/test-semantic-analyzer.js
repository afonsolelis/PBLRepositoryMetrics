/**
 * Unit tests for semantic-analyzer.js and synthesis.js
 * Tests prompt building and composite score computation (no LLM needed).
 */

const { buildPrompt } = require('../services/semantic-analyzer');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

// ─── Test data ──────────────────────────────────────────────────────────────

const deliverable = {
  id: 'D1',
  name: 'Contextualização e Especificação de Requisitos',
  type: 'document',
  path: 'docs/Contextualizacao.md',
  expected_sections: ['Cenário Organizacional', 'Requisitos Funcionais', 'Requisitos Não Funcionais'],
  evaluation_criteria: 'RFs com rastreabilidade, RNFs com justificativa técnica.',
  weight: 2,
};

const excellentStructural = {
  deliverable_id: 'D1',
  structural_completeness: 1.0,
  sections_found: ['Cenário Organizacional', 'Requisitos Funcionais', 'Requisitos Não Funcionais'],
  sections_missing: [],
  section_details: [
    { section: 'Cenário Organizacional', present: true, is_substantive: true, word_count: 200 },
    { section: 'Requisitos Funcionais', present: true, is_substantive: true, word_count: 300 },
    { section: 'Requisitos Não Funcionais', present: true, is_substantive: true, word_count: 150 },
  ],
  placeholders_detected: [],
  word_count: 650,
};

// ─── Prompt builder tests ──────────────────────────────────────────────────

console.log('\n=== Prompt builder ===');

const prompt = buildPrompt(deliverable, excellentStructural, [
  { name: 'Alice', lines: 200, commits: 5, percentage: 60 },
  { name: 'Bruno', lines: 130, commits: 3, percentage: 40 },
]);

assert(prompt.includes('Contextualização e Especificação'), 'Prompt includes deliverable name');
assert(prompt.includes('Cenário Organizacional'), 'Prompt includes expected sections');
assert(prompt.includes('RFs com rastreabilidade'), 'Prompt includes evaluation criteria');
assert(prompt.includes('Alice'), 'Prompt includes contributor names');
assert(prompt.includes('JSON'), 'Prompt asks for JSON output');
assert(prompt.length > 500, `Prompt has substantial length (${prompt.length} chars)`);

// ─── Prompt with poor structural results ───────────────────────────────────

console.log('\n=== Prompt with poor structural ===');

const poorStructural = {
  deliverable_id: 'D1',
  structural_completeness: 0.0,
  sections_found: ['Cenário Organizacional'],
  sections_missing: ['Requisitos Funcionais', 'Requisitos Não Funcionais'],
  section_details: [],
  placeholders_detected: ['TODO'],
  word_count: 30,
};

const poorPrompt = buildPrompt(deliverable, poorStructural, []);

assert(poorPrompt.includes('0%'), 'Poor prompt shows 0% completeness');
assert(poorPrompt.includes('Requisitos Funcionais'), 'Poor prompt lists missing sections');
assert(poorPrompt.includes('TODO'), 'Poor prompt lists detected placeholders');

// ─── Prompt with no contribution data ──────────────────────────────────────

console.log('\n=== Prompt with no contribution ===');

const noContribPrompt = buildPrompt(deliverable, excellentStructural, null);
assert(noContribPrompt.includes('Não disponível'), 'Shows "Não disponível" when no contribution data');

// ─── Synthesis score computation ───────────────────────────────────────────

console.log('\n=== Synthesis score computation ===');

const { computeDeliverableScore } = require('../services/synthesis');

const score1 = computeDeliverableScore(
  { structural_completeness: 0.8 },
  { overall_semantic_score: 0.7 },
  { composite_score: 0.6 },
  0.9,
  { structural_conformance: 0.25, semantic_quality: 0.35, commit_discipline: 0.20, quantitative_cep: 0.20 }
);

assert(score1.final_score > 0, `Synthesis produces non-zero score (got ${score1.final_score})`);
assert(score1.final_score <= 1.0, `Score is <= 1.0 (got ${score1.final_score})`);
assert(score1.structural_score === 0.8, 'Structural score preserved');
assert(score1.semantic_score === 0.7, 'Semantic score preserved');

// Expected: 0.8*0.25 + 0.7*0.35 + 0.6*0.20 + 0.9*0.20 = 0.20 + 0.245 + 0.12 + 0.18 = 0.745
const expected = 0.20 + 0.245 + 0.12 + 0.18;
assert(Math.abs(score1.final_score - expected) < 0.01, `Score matches manual calc: ${expected.toFixed(2)} (got ${score1.final_score})`);

// Edge: all zeros
const score0 = computeDeliverableScore(null, null, null, 0, undefined);
assert(score0.final_score === 0, `All zeros = 0 score`);

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
