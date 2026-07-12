type DimensionScoreKey = 'communication' | 'operation' | 'response' | 'safety' | 'care' | 'completeness';

type ServiceScoreKey = 'professionalism' | 'attitude' | 'responsiveness' | 'detail';

const DIMENSION_KEYS: DimensionScoreKey[] = ['communication', 'operation', 'response', 'safety', 'care', 'completeness'];
const SERVICE_SCORE_KEYS: ServiceScoreKey[] = ['professionalism', 'attitude', 'responsiveness', 'detail'];

function clampInt(value: unknown, min: number, max: number) {
  const score = Number(value);
  if (!Number.isFinite(score)) return min;
  return Math.max(min, Math.min(max, Math.round(score)));
}

function normalizeText(value: unknown, maxLength = 500) {
  return String(value || '')
    .replace(/\r/g, '')
    .trim()
    .slice(0, maxLength);
}

function normalizeStringArray(value: unknown, limit: number, itemMaxLength = 120) {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = normalizeText(item, itemMaxLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeDimensionScores(value: unknown) {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    communication: clampInt(source.communication, 0, 10),
    operation: clampInt(source.operation, 0, 10),
    response: clampInt(source.response, 0, 10),
    safety: clampInt(source.safety, 0, 10),
    care: clampInt(source.care, 0, 10),
    completeness: clampInt(source.completeness, 0, 10),
  };
}

function normalizeServiceScore(value: unknown) {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    professionalism: clampInt(source.professionalism, 0, 10),
    attitude: clampInt(source.attitude, 0, 10),
    responsiveness: clampInt(source.responsiveness, 0, 10),
    detail: clampInt(source.detail, 0, 10),
    comment: normalizeText(source.comment, 300),
  };
}

function computeOverallScore(dimensionScores: Record<DimensionScoreKey, number>) {
  const total = DIMENSION_KEYS.reduce((sum, key) => sum + dimensionScores[key], 0);
  return Number((total / DIMENSION_KEYS.length).toFixed(1));
}

function normalizeVisitStats(value: unknown) {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    hasVisit: Boolean(source.hasVisit),
    visitCount: Boolean(source.hasVisit) ? clampInt(source.visitCount, 0, 99) : 0,
  };
}

function normalizeMedicalFeedback(value: unknown) {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    hasMedicalFeedback: Boolean(source.hasMedicalFeedback),
    notes: normalizeText(source.notes, 500),
  };
}

export function buildReportCard(report: { analysisPayload?: Record<string, any>; scorePayload?: Record<string, any>; cleanedTranscript?: string }) {
  const analysisPayload = report.analysisPayload && typeof report.analysisPayload === 'object' ? report.analysisPayload : {};
  const scorePayload = report.scorePayload && typeof report.scorePayload === 'object' ? report.scorePayload : {};

  const dimensionScores = normalizeDimensionScores(scorePayload.dimensionScores);
  const serviceScore = normalizeServiceScore(scorePayload.serviceScore);
  const parsedOverallScore = Number(scorePayload.overallScore);
  const normalizedOverallScore = Number.isFinite(parsedOverallScore) ? Math.max(0, Math.min(10, parsedOverallScore > 10 ? parsedOverallScore / 10 : parsedOverallScore)) : 0;
  const overallScore = normalizedOverallScore || computeOverallScore(dimensionScores);
  const scoreComment = normalizeText(scorePayload.scoreComment || serviceScore.comment, 300);
  const aiSummary = normalizeText(analysisPayload.summary, 300);
  const emotionSummary = normalizeText(analysisPayload.emotionSummary, 300);

  const tasksCompleted = normalizeStringArray(analysisPayload.tasksCompleted, 8);
  const highlights = normalizeStringArray(analysisPayload.highlights, 3);
  const riskAlerts = normalizeStringArray(analysisPayload.riskAlerts, 3);
  const warmMoments = normalizeStringArray(analysisPayload.warmMoments, 3);
  const evidenceSnippets =
    normalizeStringArray(analysisPayload.evidenceSnippets, 4, 200).length > 0
      ? normalizeStringArray(analysisPayload.evidenceSnippets, 4, 200)
      : normalizeStringArray(String(report.cleanedTranscript || '').split('\n'), 4, 200);

  return {
    overallScore,
    aiSummary,
    dimensionScores,
    tasksCompleted,
    highlights,
    riskAlerts,
    evidenceSnippets,
    scoreComment,
    emotionSummary,
    warmMoments,
    visitStats: normalizeVisitStats(analysisPayload.visitStats),
    medicalFeedback: normalizeMedicalFeedback(analysisPayload.medicalFeedback),
    analysisPayload: {
      summary: aiSummary,
      emotionSummary,
      tasksCompleted,
      highlights,
      riskAlerts,
      warmMoments,
      evidenceSnippets,
      visitStats: normalizeVisitStats(analysisPayload.visitStats),
      medicalFeedback: normalizeMedicalFeedback(analysisPayload.medicalFeedback),
    },
    scorePayload: {
      overallScore,
      dimensionScores,
      scoreComment,
      serviceScore,
    },
  };
}
