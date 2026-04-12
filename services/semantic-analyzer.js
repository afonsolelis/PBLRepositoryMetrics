/**
 * Semantic Analyzer — Multi-Provider LLM Document Quality Assessment
 *
 * Phase 3: Uses an LLM to evaluate document content against Sprint
 * Descriptor criteria. Supports multiple providers:
 *
 *   - Anthropic Claude API (ANTHROPIC_API_KEY)
 *   - OpenAI-compatible endpoints (LLM_BASE_URL + LLM_API_KEY),
 *     including local servers: Ollama, vLLM, llama.cpp, LM Studio
 *
 * The LLM receives the document content, expected sections, evaluation
 * criteria, structural check results, and contribution history.
 * Returns a structured JSON assessment with per-section scores,
 * executive summary, strengths, weaknesses, and recommended actions.
 *
 * Provider selection priority:
 *   1. LLM_BASE_URL (OpenAI-compatible, local or remote)
 *   2. ANTHROPIC_API_KEY (Anthropic Claude)
 *
 * At least one provider must be configured.
 */

const { getDB } = require('../config/db');

let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch {
  Anthropic = null;
}

const MAX_CONTENT_CHARS = 8000; // truncate very large documents

// ─── Provider detection ────────────────────────────────────────────────────

function getProvider() {
  if (process.env.LLM_BASE_URL) {
    return {
      type: 'openai-compatible',
      baseUrl: process.env.LLM_BASE_URL.replace(/\/+$/, ''),
      apiKey: process.env.LLM_API_KEY || '',
      model: process.env.SEMANTIC_MODEL || 'gemma3:27b',
    };
  }

  if (Anthropic && process.env.ANTHROPIC_API_KEY) {
    return {
      type: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.SEMANTIC_MODEL || 'claude-haiku-4-5-20251001',
    };
  }

  return null;
}

// ─── Prompt builder ─────────────────────────────────────────────────────────

function buildPrompt(deliverable, structuralResult, contributionData) {
  const content = (structuralResult.file_content || '')
    .slice(0, MAX_CONTENT_CHARS);

  const contributionText = (contributionData || [])
    .map(m => `- ${m.name}: ${m.lines} linhas, ${m.commits} commits (${m.percentage}%)`)
    .join('\n');

  return `Você é um avaliador acadêmico de artefatos PBL (Problem-Based Learning) em engenharia de software.
Avalie o documento abaixo comparando com os critérios do metaprojeto.

## Entregável
- Nome: ${deliverable.name}
- Peso: ${deliverable.weight}
- Arquivo: ${deliverable.path}

## Seções esperadas pelo metaprojeto
${(deliverable.expected_sections || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Critérios de avaliação do metaprojeto
${deliverable.evaluation_criteria}

## Resultado da verificação estrutural automática
- Completude estrutural: ${(structuralResult.structural_completeness * 100).toFixed(0)}%
- Seções presentes: ${structuralResult.sections_found.join(', ') || 'nenhuma'}
- Seções ausentes: ${structuralResult.sections_missing.join(', ') || 'nenhuma'}
- Placeholders detectados: ${structuralResult.placeholders_detected.join(', ') || 'nenhum'}
- Total de palavras: ${structuralResult.word_count}

## Histórico de contribuição (git)
${contributionText || 'Não disponível'}

## Conteúdo do documento
\`\`\`markdown
${content}
\`\`\`

---

Avalie CADA SEÇÃO esperada e retorne APENAS um JSON válido (sem markdown, sem explicações fora do JSON) com esta estrutura:

{
  "section_assessments": [
    {
      "section": "nome da seção esperada",
      "present": true,
      "completeness": 0.85,
      "quality": 0.70,
      "feedback": "explicação concisa do que está bom e do que falta"
    }
  ],
  "overall_semantic_score": 0.72,
  "executive_summary": "2-3 frases sobre o estado geral do entregável",
  "strengths": ["ponto forte 1"],
  "weaknesses": ["ponto fraco 1"],
  "recommended_actions": ["ação recomendada 1"]
}`;
}

// ─── LLM call: OpenAI-compatible endpoint (Ollama, vLLM, llama.cpp, etc.) ─

async function callOpenAICompatible(prompt, provider) {
  const url = `${provider.baseUrl}/v1/chat/completions`;

  const headers = { 'Content-Type': 'application/json' };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  const body = JSON.stringify({
    model: provider.model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000,
    temperature: 0.1,
  });

  const response = await fetch(url, { method: 'POST', headers, body });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM endpoint ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content.trim();

  return parseJSON(text);
}

// ─── LLM call: Anthropic Claude ────────────────────────────────────────────

async function callAnthropic(prompt, provider) {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: provider.model,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  return parseJSON(text);
}

// ─── JSON parser (handles markdown code blocks) ────────────────────────────

function parseJSON(text) {
  let jsonText = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }
  return JSON.parse(jsonText);
}

// ─── Unified LLM dispatcher ───────────────────────────────────────────────

async function callLLM(prompt) {
  const provider = getProvider();
  if (!provider) return null;

  if (provider.type === 'openai-compatible') {
    return callOpenAICompatible(prompt, provider);
  }

  return callAnthropic(prompt, provider);
}

// ─── Main analysis function ─────────────────────────────────────────────────

async function analyzeDeliverable(deliverable, structuralResult, contributionData) {
  const prompt = buildPrompt(deliverable, structuralResult, contributionData);

  const provider = getProvider();
  if (!provider) {
    throw new Error(
      'No LLM provider configured. Set LLM_BASE_URL for local models (Ollama, vLLM) ' +
      'or ANTHROPIC_API_KEY for Anthropic Claude.'
    );
  }

  const llmResult = await callLLM(prompt);
  llmResult._mock = false;
  return llmResult;
}

// ─── Analyze all deliverables for a project ─────────────────────────────────

async function analyzeAllDeliverables(projectId, descriptor, structuralResults, diffMetrics) {
  const db = getDB();
  const results = [];
  const provider = getProvider();

  if (!provider) {
    console.error('[Semantic] ERROR: No LLM provider configured. Set LLM_BASE_URL or ANTHROPIC_API_KEY.');
    return results;
  }

  const providerLabel = provider.type === 'openai-compatible'
    ? `${provider.model} @ ${provider.baseUrl}`
    : `${provider.model} (Anthropic)`;

  console.log(`[Semantic] Analyzing ${structuralResults.length} deliverables for project ${projectId} (LLM: ${providerLabel})`);

  for (const structural of structuralResults) {
    const deliverable = descriptor.deliverables.find(d => d.id === structural.deliverable_id);
    if (!deliverable) continue;

    const contribution = diffMetrics?.contribution_by_member || [];

    try {
      const result = await analyzeDeliverable(deliverable, structural, contribution);

      // Persist
      await db.collection('semantic_assessments').updateOne(
        {
          project_id: projectId,
          sprint_id: descriptor.sprint_id,
          deliverable_id: deliverable.id,
        },
        {
          $set: {
            project_id: projectId,
            sprint_id: descriptor.sprint_id,
            deliverable_id: deliverable.id,
            deliverable_name: deliverable.name,
            model_used: provider.model,
            provider_type: provider.type,
            ...result,
            evaluated_at: new Date().toISOString(),
          },
        },
        { upsert: true }
      );

      results.push({ deliverable_id: deliverable.id, ...result });
      console.log(`  [${deliverable.name}] semantic_score=${result.overall_semantic_score}`);
    } catch (err) {
      console.error(`  [${deliverable.name}] LLM error: ${err.message}`);
    }
  }

  return results;
}

module.exports = { analyzeDeliverable, analyzeAllDeliverables, buildPrompt };
