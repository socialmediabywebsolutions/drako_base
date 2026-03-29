import { getDb } from "@/lib/db";

export type UserFeedback = {
  id: string;
  studentProfileId: string;
  tenantId: string;
  sessionCount: number;
  liked: string[];
  missing: string[];
  overallSentiment: "positive" | "neutral" | "negative";
  wouldRecommend: boolean;
  collectedAt: string;
};

type UserFeedbackRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  session_count: number;
  liked_json: string;
  missing_json: string;
  overall_sentiment: string;
  would_recommend: number;
  collected_at: string;
  created_at: string;
  updated_at: string;
};

export type FeedbackPrompt = {
  sessionCount: number;
  question1: string;
  question2: string;
  question3: string;
};

export class FeedbackSystem {
  constructor(private db: D1Database = getDb()) {}

  getFeedbackPrompt(sessionCount: number): FeedbackPrompt {
    if (sessionCount === 1) {
      return {
        sessionCount: 1,
        question1: "¿Qué es lo que más te ha gustado de esta sesión?",
        question2: "¿Qué te ha faltado o qué mejorarías?",
        question3: "¿Recomendarías Mentoría a otros padres?",
      };
    }

    if (sessionCount === 2) {
      return {
        sessionCount: 2,
        question1: "Después de 2 sesiones, ¿qué es lo mejor de Mentoría?",
        question2: "¿Hay algo que no te funcione o que falte?",
        question3: "¿Seguirías usando Mentoría después del período de prueba?",
      };
    }

    return {
      sessionCount,
      question1: "¿Qué aspectos de Mentoría te han sido más útiles?",
      question2: "¿Qué cambios te gustaría ver?",
      question3: "¿Recomendarías Mentoría a otros padres?",
    };
  }

  async collectFeedback(input: {
    tenantId: string;
    studentProfileId: string;
    sessionCount: number;
    liked: string[];
    missing: string[];
    wouldRecommend: boolean;
  }): Promise<UserFeedback> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const overallSentiment = this.calculateSentiment(input.liked, input.missing, input.wouldRecommend);

    await this.db
      .prepare(
        `INSERT INTO user_feedback (
          id, tenant_id, student_profile_id, session_count, liked_json, missing_json,
          overall_sentiment, would_recommend, collected_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.tenantId,
        input.studentProfileId,
        input.sessionCount,
        JSON.stringify(input.liked),
        JSON.stringify(input.missing),
        overallSentiment,
        input.wouldRecommend ? 1 : 0,
        now,
        now,
        now
      )
      .run();

    return {
      id,
      studentProfileId: input.studentProfileId,
      tenantId: input.tenantId,
      sessionCount: input.sessionCount,
      liked: input.liked,
      missing: input.missing,
      overallSentiment,
      wouldRecommend: input.wouldRecommend,
      collectedAt: now,
    };
  }

  async getUserFeedback(tenantId: string, studentProfileId: string): Promise<UserFeedback[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM user_feedback
         WHERE tenant_id = ? AND student_profile_id = ?
         ORDER BY collected_at DESC`
      )
      .bind(tenantId, studentProfileId)
      .all<UserFeedbackRow>();

    return rows.results.map((row) => ({
      id: row.id,
      studentProfileId: row.student_profile_id,
      tenantId: row.tenant_id,
      sessionCount: row.session_count,
      liked: this.parseJson(row.liked_json),
      missing: this.parseJson(row.missing_json),
      overallSentiment: row.overall_sentiment as "positive" | "neutral" | "negative",
      wouldRecommend: row.would_recommend === 1,
      collectedAt: row.collected_at,
    }));
  }

  async getFeedbackSummary(): Promise<{
    totalFeedback: number;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
    recommendationRate: number;
    topLiked: Array<{ item: string; count: number }>;
    topMissing: Array<{ item: string; count: number }>;
  }> {
    const summaryRow = await this.db
      .prepare(
        `SELECT
          COUNT(*) as total_feedback,
          COUNT(CASE WHEN overall_sentiment = 'positive' THEN 1 END) as positive_count,
          COUNT(CASE WHEN overall_sentiment = 'neutral' THEN 1 END) as neutral_count,
          COUNT(CASE WHEN overall_sentiment = 'negative' THEN 1 END) as negative_count,
          COUNT(CASE WHEN would_recommend = 1 THEN 1 END) as recommend_count
         FROM user_feedback`
      )
      .first<{
        total_feedback: number;
        positive_count: number;
        neutral_count: number;
        negative_count: number;
        recommend_count: number;
      }>();

    const recommendationRate = summaryRow && summaryRow.total_feedback > 0 
      ? (summaryRow.recommend_count / summaryRow.total_feedback) * 100 
      : 0;

    // Get top liked items
    const allFeedback = await this.db
      .prepare(`SELECT liked_json FROM user_feedback`)
      .all<{ liked_json: string }>();

    const likedCounts: Record<string, number> = {};
    const missingCounts: Record<string, number> = {};

    allFeedback.results.forEach((row) => {
      const liked = this.parseJson(row.liked_json);
      liked.forEach((item) => {
        likedCounts[item] = (likedCounts[item] || 0) + 1;
      });
    });

    const missingFeedback = await this.db
      .prepare(`SELECT missing_json FROM user_feedback`)
      .all<{ missing_json: string }>();

    missingFeedback.results.forEach((row) => {
      const missing = this.parseJson(row.missing_json);
      missing.forEach((item) => {
        missingCounts[item] = (missingCounts[item] || 0) + 1;
      });
    });

    const topLiked = Object.entries(likedCounts)
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topMissing = Object.entries(missingCounts)
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalFeedback: summaryRow?.total_feedback || 0,
      positiveCount: summaryRow?.positive_count || 0,
      neutralCount: summaryRow?.neutral_count || 0,
      negativeCount: summaryRow?.negative_count || 0,
      recommendationRate,
      topLiked,
      topMissing,
    };
  }

  private calculateSentiment(liked: string[], missing: string[], wouldRecommend: boolean): "positive" | "neutral" | "negative" {
    if (wouldRecommend && liked.length > 0 && missing.length === 0) {
      return "positive";
    }
    if (!wouldRecommend && missing.length > liked.length) {
      return "negative";
    }
    return "neutral";
  }

  private parseJson(json: string): string[] {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
