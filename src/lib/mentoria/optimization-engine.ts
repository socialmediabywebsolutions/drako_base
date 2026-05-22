import { UserAnalytics } from "@/lib/mentoria/user-analytics";
import { FeedbackSystem } from "@/lib/mentoria/feedback-system";
import { AcquisitionPublisher } from "@/lib/mentoria/acquisition-publishing";

export type OptimizationRecommendation = {
  category: "content" | "messaging" | "onboarding" | "conversion";
  priority: "high" | "medium" | "low";
  issue: string;
  recommendation: string;
  dataPoint: string;
  expectedImpact: string;
};

export type OptimizationReport = {
  timestamp: string;
  conversionMetrics: {
    totalSignups: number;
    conversionRate: number;
    avgTimeToFirstSession: number;
    avgSessionsBeforeConversion: number;
  };
  dropoffAnalysis: {
    neverStartedTrial: number;
    completedButNotConverted: number;
    converted: number;
  };
  feedbackSummary: {
    totalFeedback: number;
    recommendationRate: number;
    topLiked: Array<{ item: string; count: number }>;
    topMissing: Array<{ item: string; count: number }>;
  };
  contentPerformance: {
    topPerformingPosts: Array<{ postId: string; clicks: number; conversionRate: number }>;
    underperformingPosts: Array<{ postId: string; clicks: number; conversionRate: number }>;
  };
  recommendations: OptimizationRecommendation[];
};

export class OptimizationEngine {
  constructor(
    private userAnalytics = new UserAnalytics(),
    private feedbackSystem = new FeedbackSystem(),
    private acquisitionPublisher = new AcquisitionPublisher()
  ) {}

  async generateOptimizationReport(tenantId: string): Promise<OptimizationReport> {
    const now = new Date().toISOString();

    const conversionMetrics = await this.userAnalytics.getConversionMetrics();
    const dropoffAnalysis = await this.userAnalytics.getDropoffAnalysis();
    const feedbackSummary = await this.feedbackSystem.getFeedbackSummary();
    const contentPerformance = await this.analyzeContentPerformance(tenantId);
    const recommendations = this.generateRecommendations(
      conversionMetrics,
      dropoffAnalysis,
      feedbackSummary,
      contentPerformance
    );

    return {
      timestamp: now,
      conversionMetrics,
      dropoffAnalysis,
      feedbackSummary,
      contentPerformance,
      recommendations,
    };
  }

  private async analyzeContentPerformance(tenantId: string): Promise<{
    topPerformingPosts: Array<{ postId: string; clicks: number; conversionRate: number }>;
    underperformingPosts: Array<{ postId: string; clicks: number; conversionRate: number }>;
  }> {
    const metrics = await this.acquisitionPublisher.getPerformanceMetrics(tenantId);

    // Get all published posts
    const linkedinPosts = await this.acquisitionPublisher.getPublishedPostsByChannel(tenantId, "linkedin");
    const instagramPosts = await this.acquisitionPublisher.getPublishedPostsByChannel(tenantId, "instagram");
    const tiktokPosts = await this.acquisitionPublisher.getPublishedPostsByChannel(tenantId, "tiktok");

    const allPosts = [...linkedinPosts, ...instagramPosts, ...tiktokPosts];

    const postsWithMetrics = allPosts.map((post) => ({
      postId: post.id,
      clicks: post.clicks,
      signups: post.signups,
      conversionRate: post.clicks > 0 ? (post.signups / post.clicks) * 100 : 0,
    }));

    const sorted = postsWithMetrics.sort((a, b) => b.conversionRate - a.conversionRate);

    return {
      topPerformingPosts: sorted.slice(0, 3).map((p) => ({
        postId: p.postId,
        clicks: p.clicks,
        conversionRate: p.conversionRate,
      })),
      underperformingPosts: sorted.slice(-3).map((p) => ({
        postId: p.postId,
        clicks: p.clicks,
        conversionRate: p.conversionRate,
      })),
    };
  }

  private generateRecommendations(
    conversionMetrics: any,
    dropoffAnalysis: any,
    feedbackSummary: any,
    contentPerformance: any
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Conversion rate analysis
    if (conversionMetrics.conversionRate < 5) {
      recommendations.push({
        category: "conversion",
        priority: "high",
        issue: `Low trial-to-paid conversion rate: ${conversionMetrics.conversionRate.toFixed(1)}%`,
        recommendation: "Improve upgrade messaging and value proposition at trial expiration",
        dataPoint: `${conversionMetrics.totalSignups} signups, ${conversionMetrics.totalConversions} conversions`,
        expectedImpact: "Increase conversion rate to 10%+",
      });
    }

    // Time to first session analysis
    if (conversionMetrics.avgTimeToFirstSession > 1440) {
      // More than 1 day
      recommendations.push({
        category: "onboarding",
        priority: "high",
        issue: `High time to first session: ${Math.round(conversionMetrics.avgTimeToFirstSession / 60)} hours`,
        recommendation: "Simplify onboarding, add push notifications, reduce friction to first session",
        dataPoint: `Average ${Math.round(conversionMetrics.avgTimeToFirstSession / 60)} hours to first session`,
        expectedImpact: "Reduce to < 1 hour",
      });
    }

    // Dropoff analysis
    if (dropoffAnalysis.neverStartedTrial > dropoffAnalysis.converted * 2) {
      recommendations.push({
        category: "onboarding",
        priority: "high",
        issue: `High signup-to-session dropoff: ${dropoffAnalysis.neverStartedTrial} users never started`,
        recommendation: "Add onboarding email sequence, in-app guidance, or guided first session",
        dataPoint: `${dropoffAnalysis.neverStartedTrial} users never started trial`,
        expectedImpact: "Increase first session rate to 50%+",
      });
    }

    // Feedback-based recommendations
    if (feedbackSummary.topMissing.length > 0) {
      const topMissing = feedbackSummary.topMissing[0];
      recommendations.push({
        category: "content",
        priority: "medium",
        issue: `Users requesting: ${topMissing.item}`,
        recommendation: `Prioritize feature/content: ${topMissing.item}`,
        dataPoint: `${topMissing.count} users mentioned this`,
        expectedImpact: "Improve satisfaction and retention",
      });
    }

    // Content performance
    if (contentPerformance.underperformingPosts.length > 0) {
      const underperforming = contentPerformance.underperformingPosts[0];
      recommendations.push({
        category: "content",
        priority: "medium",
        issue: `Low-performing content: ${underperforming.conversionRate.toFixed(1)}% conversion`,
        recommendation: "Analyze and adjust hooks, messaging, or CTA based on top-performing posts",
        dataPoint: `${underperforming.clicks} clicks, ${underperforming.conversionRate.toFixed(1)}% conversion`,
        expectedImpact: "Improve content conversion to match top performers",
      });
    }

    // Recommendation rate
    if (feedbackSummary.recommendationRate < 70) {
      recommendations.push({
        category: "messaging",
        priority: "medium",
        issue: `Low recommendation rate: ${feedbackSummary.recommendationRate.toFixed(1)}%`,
        recommendation: "Improve product experience, focus on top-liked features",
        dataPoint: `${feedbackSummary.recommendationRate.toFixed(1)}% would recommend`,
        expectedImpact: "Increase to 80%+ for viral growth",
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}
