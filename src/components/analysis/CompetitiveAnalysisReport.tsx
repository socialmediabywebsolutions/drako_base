import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Styles for the PDF
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Helvetica',
        fontSize: 10,
        backgroundColor: '#ffffff',
    },
    coverPage: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
    },
    logo: {
        width: 200,
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#0ea5e9',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: '#64748b',
        marginBottom: 40,
        textAlign: 'center',
    },
    companyName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 10,
    },
    date: {
        fontSize: 12,
        color: '#94a3b8',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0ea5e9',
        marginBottom: 15,
        borderBottom: '2 solid #e2e8f0',
        paddingBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#334155',
        marginTop: 10,
        marginBottom: 8,
    },
    text: {
        fontSize: 10,
        color: '#475569',
        lineHeight: 1.6,
        marginBottom: 6,
    },
    table: {
        display: 'flex',
        width: '100%',
        marginVertical: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#0ea5e9',
        padding: 8,
        fontWeight: 'bold',
        color: '#ffffff',
        fontSize: 9,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottom: '1 solid #e2e8f0',
        padding: 8,
        fontSize: 9,
    },
    tableRowAlt: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderBottom: '1 solid #e2e8f0',
        padding: 8,
        fontSize: 9,
    },
    tableCell: {
        flex: 1,
        color: '#475569',
    },
    tableCellBold: {
        flex: 1,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    alert: {
        backgroundColor: '#fef3c7',
        border: '1 solid #fbbf24',
        borderRadius: 4,
        padding: 12,
        marginVertical: 10,
    },
    alertTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#92400e',
        marginBottom: 6,
    },
    alertText: {
        fontSize: 10,
        color: '#78350f',
        lineHeight: 1.5,
    },
    opportunity: {
        backgroundColor: '#e0f2fe',
        borderLeft: '4 solid #0ea5e9',
        padding: 12,
        marginBottom: 10,
    },
    opportunityTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#0c4a6e',
        marginBottom: 4,
    },
    opportunityText: {
        fontSize: 9,
        color: '#075985',
        lineHeight: 1.4,
    },
    department: {
        backgroundColor: '#f0fdf4',
        border: '1 solid #86efac',
        borderRadius: 4,
        padding: 12,
        marginBottom: 12,
    },
    departmentName: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#14532d',
        marginBottom: 4,
    },
    departmentPrice: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#16a34a',
        marginBottom: 6,
    },
    benefit: {
        fontSize: 9,
        color: '#166534',
        marginLeft: 10,
        marginBottom: 3,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        fontSize: 8,
        color: '#94a3b8',
        borderTop: '1 solid #e2e8f0',
        paddingTop: 10,
    },
    cta: {
        backgroundColor: '#0ea5e9',
        color: '#ffffff',
        padding: 12,
        textAlign: 'center',
        borderRadius: 4,
        marginTop: 20,
        marginBottom: 10,
    },
    ctaText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
});

interface PDFReportProps {
    companyName: string;
    analysis: {
        competitors_found: number;
        comparison: {
            instagram_posts_gap?: number;
            instagram_likes_gap?: number;
            engagement_gap?: number;
            facebook_posts_gap?: number;
            pricing_gap?: number;
        };
        clientMetrics: {
            instagram?: { posts_per_week?: number; avg_likes?: number; engagement_rate?: number };
            facebook?: { posts_per_week?: number; avg_reactions?: number };
            google_rating?: number;
            review_count?: number;
        };
        competitorMetrics: {
            instagram?: { posts_per_week?: number; avg_likes?: number; engagement_rate?: number };
            facebook?: { posts_per_week?: number; avg_reactions?: number };
            google_rating?: number;
            review_count?: number;
        };
        strengths: string[];
        weaknesses: string[];
        opportunities: Array<{ title: string; description: string; impact: string }>;
        recommended_departments: Array<{
            name: string;
            price_monthly: number;
            roi_multiplier: number;
            benefits: string[];
        }>;
        financial_summary: {
            total_monthly_investment: number;
            projected_revenue_increase: string;
            avg_roi_multiplier: string;
            break_even_days: number;
        };
    };
}

export const CompetitiveAnalysisReport: React.FC<PDFReportProps> = ({ companyName, analysis }) => {
    const currentDate = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <Document>
            {/* Cover Page */}
            <Page size="A4" style={styles.page}>
                <View style={styles.coverPage}>
                    <Text style={styles.title}>Análisis Competitivo</Text>
                    <Text style={styles.companyName}>{companyName}</Text>
                    <Text style={styles.subtitle}>Inteligencia de Mercado</Text>
                    <Text style={styles.date}>Generado el {currentDate}</Text>
                </View>
            </Page>

            {/* Page 1: Executive Summary */}
            <Page size="A4" style={styles.page}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Resumen Ejecutivo</Text>
                    <Text style={styles.text}>
                        Hemos analizado {analysis.competitors_found} competidores en un radio de 5km de tu ubicación
                        para ofrecerte un panorama completo de tu posición en el mercado.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tu Situación Actual</Text>

                    <Text style={styles.sectionSubtitle}>📱 Instagram</Text>
                    <Text style={styles.text}>
                        Frecuencia: {analysis.clientMetrics.instagram?.posts_per_week || 'N/A'} posts/semana
                    </Text>
                    <Text style={styles.text}>
                        Likes promedio: {analysis.clientMetrics.instagram?.avg_likes || 'N/A'}
                    </Text>
                    <Text style={styles.text}>
                        Engagement: {analysis.clientMetrics.instagram?.engagement_rate || 'N/A'}%
                    </Text>

                    <Text style={styles.sectionSubtitle}>📘 Facebook</Text>
                    <Text style={styles.text}>
                        Frecuencia: {analysis.clientMetrics.facebook?.posts_per_week || 'N/A'} posts/semana
                    </Text>
                    <Text style={styles.text}>
                        Interacciones promedio: {analysis.clientMetrics.facebook?.avg_reactions || 'N/A'}
                    </Text>

                    <Text style={styles.sectionSubtitle}>⭐ Google Maps</Text>
                    <Text style={styles.text}>
                        Rating: {analysis.clientMetrics.google_rating || 'N/A'}
                    </Text>
                    <Text style={styles.text}>
                        Reseñas: {analysis.clientMetrics.review_count || 'N/A'}
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Text>Análisis generado por DRAKO.SYSTEMS</Text>
                </View>
            </Page>

            {/* Page 2: Comparative Analysis */}
            <Page size="A4" style={styles.page}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Análisis Comparativo Detallado</Text>

                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableCell, { flex: 2 }]}>Métrica</Text>
                            <Text style={styles.tableCell}>Tú</Text>
                            <Text style={styles.tableCell}>Competencia</Text>
                            <Text style={styles.tableCell}>Gap</Text>
                        </View>

                        <View style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 2 }]}>Posts Instagram/semana</Text>
                            <Text style={styles.tableCell}>{analysis.clientMetrics.instagram?.posts_per_week || '-'}</Text>
                            <Text style={styles.tableCell}>{analysis.competitorMetrics.instagram?.posts_per_week || '-'}</Text>
                            <Text style={styles.tableCellBold}>
                                {analysis.comparison.instagram_posts_gap ? `${analysis.comparison.instagram_posts_gap}%` : '-'}
                            </Text>
                        </View>

                        <View style={styles.tableRowAlt}>
                            <Text style={[styles.tableCell, { flex: 2 }]}>Likes promedio Instagram</Text>
                            <Text style={styles.tableCell}>{analysis.clientMetrics.instagram?.avg_likes || '-'}</Text>
                            <Text style={styles.tableCell}>{analysis.competitorMetrics.instagram?.avg_likes || '-'}</Text>
                            <Text style={styles.tableCellBold}>
                                {analysis.comparison.instagram_likes_gap ? `${analysis.comparison.instagram_likes_gap}%` : '-'}
                            </Text>
                        </View>

                        <View style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 2 }]}>Engagement rate Instagram</Text>
                            <Text style={styles.tableCell}>{analysis.clientMetrics.instagram?.engagement_rate || '-'}%</Text>
                            <Text style={styles.tableCell}>{analysis.competitorMetrics.instagram?.engagement_rate || '-'}%</Text>
                            <Text style={styles.tableCellBold}>
                                {analysis.comparison.engagement_gap ? `${analysis.comparison.engagement_gap}%` : '-'}
                            </Text>
                        </View>

                        <View style={styles.tableRowAlt}>
                            <Text style={[styles.tableCell, { flex: 2 }]}>Posts Facebook/semana</Text>
                            <Text style={styles.tableCell}>{analysis.clientMetrics.facebook?.posts_per_week || '-'}</Text>
                            <Text style={styles.tableCell}>{analysis.competitorMetrics.facebook?.posts_per_week || '-'}</Text>
                            <Text style={styles.tableCellBold}>
                                {analysis.comparison.facebook_posts_gap ? `${analysis.comparison.facebook_posts_gap}%` : '-'}
                            </Text>
                        </View>
                    </View>
                </View>

                {analysis.weaknesses.length > 0 && (
                    <View style={styles.alert}>
                        <Text style={styles.alertTitle}>⚠️ Áreas de Mejora Identificadas</Text>
                        {analysis.weaknesses.slice(0, 3).map((weakness, index) => (
                            <Text key={index} style={styles.alertText}>• {weakness}</Text>
                        ))}
                    </View>
                )}

                <View style={styles.footer}>
                    <Text>Análisis generado por DRAKO.SYSTEMS</Text>
                </View>
            </Page>

            {/* Page 3: Opportunities */}
            <Page size="A4" style={styles.page}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🎯 Oportunidades Identificadas</Text>
                    <Text style={styles.text}>
                        Basándonos en el análisis de tu competencia, hemos identificado las siguientes oportunidades
                        de crecimiento para tu negocio:
                    </Text>

                    {analysis.opportunities.map((opp, index) => (
                        <View key={index} style={styles.opportunity}>
                            <Text style={styles.opportunityTitle}>
                                Oportunidad #{index + 1}: {opp.title}
                            </Text>
                            <Text style={styles.opportunityText}>{opp.description}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.footer}>
                    <Text>Análisis generado por DRAKO.SYSTEMS</Text>
                </View>
            </Page>

            {/* Page 4: Recommended Departments (Sales Funnel) */}
            <Page size="A4" style={styles.page}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🚀 Departamentos Recomendados</Text>
                    <Text style={styles.text}>
                        Para cerrar la brecha con tu competencia y alcanzar tus objetivos de crecimiento,
                        recomendamos activar los siguientes departamentos:
                    </Text>

                    {analysis.recommended_departments.map((dept, index) => (
                        <View key={index} style={styles.department}>
                            <Text style={styles.departmentName}>✅ {dept.name}</Text>
                            <Text style={styles.departmentPrice}>€{dept.price_monthly}/mes</Text>
                            <Text style={[styles.text, { fontSize: 9, color: '#166534', marginBottom: 4 }]}>
                                ROI estimado: {dept.roi_multiplier}x en 6 meses
                            </Text>
                            {dept.benefits.map((benefit, idx) => (
                                <Text key={idx} style={styles.benefit}>→ {benefit}</Text>
                            ))}
                        </View>
                    ))}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💰 Resumen Financiero</Text>
                    <View style={[styles.table, { marginTop: 10 }]}>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCellBold}>Inversión Total Mensual:</Text>
                            <Text style={styles.tableCellBold}>€{analysis.financial_summary.total_monthly_investment}</Text>
                        </View>
                        <View style={styles.tableRowAlt}>
                            <Text style={styles.tableCell}>Retorno Proyectado:</Text>
                            <Text style={styles.tableCellBold}>{analysis.financial_summary.projected_revenue_increase}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.tableCell}>ROI Promedio:</Text>
                            <Text style={styles.tableCellBold}>{analysis.financial_summary.avg_roi_multiplier}</Text>
                        </View>
                        <View style={styles.tableRowAlt}>
                            <Text style={styles.tableCell}>Break Even:</Text>
                            <Text style={styles.tableCellBold}>{analysis.financial_summary.break_even_days} días</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.cta}>
                    <Text style={styles.ctaText}>Activa estos departamentos desde tu panel</Text>
                    <Text style={[styles.ctaText, { fontSize: 10, marginTop: 4 }]}>
                        https://drako.systems/site/panel
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Text>¿Preguntas? soporte@drako.systems | DRAKO.SYSTEMS</Text>
                </View>
            </Page>
        </Document>
    );
};
