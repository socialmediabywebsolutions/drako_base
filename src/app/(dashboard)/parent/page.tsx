/**
 * P4 PARENT EXPERIENCE: Parent Dashboard
 * 
 * Interfaz real del padre:
 * - Resumen principal (emocional, claro)
 * - Alertas activas (con severidad visual)
 * - Historial reciente (narrativa)
 * - Recomendación accionable
 * - Botón de acción
 */

"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, TrendingDown, Clock, BookOpen } from "lucide-react";

interface StudentData {
  id: string;
  name: string;
  age: number;
  level: string;
}

interface Summary {
  id: string;
  type: string;
  content: string;
  createdAt: string;
}

interface Alert {
  id: string;
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  createdAt: string;
}

interface OverviewData {
  student: StudentData;
  latestSummary: Summary | null;
  alerts: Alert[];
  summaryHistory: Summary[];
  stats: {
    totalActivitiesThisWeek: number;
    totalSessionsThisWeek: number;
    lastActivityTime: string | null;
  };
  lastUpdated: string;
}

export default function ParentDashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // TODO: En producción, obtener studentId y familyId del contexto de autenticación
  const studentId = "test-student-123";
  const familyId = "test-family-123";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `/api/parent/overview?studentId=${studentId}&familyId=${familyId}`
        );

        if (!response.ok) {
          throw new Error("Failed to load parent overview");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-center text-gray-700">
            {error || "No se pudo cargar la información"}
          </p>
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-50 border-red-200 text-red-900";
      case "medium":
        return "bg-yellow-50 border-yellow-200 text-yellow-900";
      case "low":
        return "bg-blue-50 border-blue-200 text-blue-900";
      default:
        return "bg-gray-50 border-gray-200 text-gray-900";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "medium":
        return <TrendingDown className="w-5 h-5 text-yellow-500" />;
      case "low":
        return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getRecommendation = () => {
    if (data.alerts.length > 0) {
      const highSeverityAlert = data.alerts.find((a) => a.severity === "high");
      if (highSeverityAlert) {
        return "Necesita atención inmediata. Considera contactar a tu hijo o al coordinador.";
      }
      return "Hay algunos puntos a revisar. Dedica 10 minutos hoy para una conversación.";
    }

    if (data.latestSummary) {
      return "Continúa apoyando el ritmo actual. Una pequeña conversación diaria ayuda mucho.";
    }

    return "Aún no hay datos. Espera a que tu hijo complete una sesión.";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Hola, {data.student.name}
          </h1>
          <p className="text-gray-600">
            Aquí está el resumen de hoy de {data.student.name}
          </p>
        </div>

        {/* BLOQUE 1: RESUMEN PRINCIPAL */}
        {data.latestSummary ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border-l-4 border-indigo-500">
            <div className="flex items-start gap-4 mb-4">
              <BookOpen className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                  Resumen de Hoy
                </h2>
                <p className="text-xl text-gray-800 leading-relaxed font-medium">
                  {data.latestSummary.content}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 text-right">
              {new Date(data.latestSummary.createdAt).toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border-l-4 border-gray-300">
            <p className="text-gray-600 italic">
              Aún no hay resumen disponible. Espera a que {data.student.name} complete una sesión.
            </p>
          </div>
        )}

        {/* BLOQUE 2: ALERTAS */}
        {data.alerts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Puntos de Atención
            </h3>
            <div className="space-y-3">
              {data.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-lg border-2 p-4 flex gap-3 ${getSeverityColor(
                    alert.severity
                  )}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm mb-1">{alert.type}</p>
                    <p className="text-sm leading-relaxed">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BLOQUE 3: EVOLUCIÓN */}
        {data.summaryHistory.length > 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Últimos Días
            </h3>
            <div className="space-y-3">
              {data.summaryHistory.slice(1, 4).map((summary, idx) => (
                <div key={summary.id} className="pb-3 border-b border-gray-200 last:border-0">
                  <p className="text-xs text-gray-500 mb-1">
                    {new Date(summary.createdAt).toLocaleDateString("es-ES", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {summary.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BLOQUE 4: RECOMENDACIÓN */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-6 mb-6 text-white">
          <h3 className="text-sm font-semibold uppercase tracking-wide mb-2">
            Qué Puedes Hacer Hoy
          </h3>
          <p className="text-lg leading-relaxed font-medium">
            {getRecommendation()}
          </p>
        </div>

        {/* BLOQUE 5: ESTADÍSTICAS RÁPIDAS */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <p className="text-xs text-gray-600 font-semibold">Sesiones esta semana</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {data.stats.totalSessionsThisWeek}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <p className="text-xs text-gray-600 font-semibold">Actividades esta semana</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {data.stats.totalActivitiesThisWeek}
            </p>
          </div>
        </div>

        {/* BLOQUE 6: ACCIÓN */}
        <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-colors duration-200">
          Ver Cómo Ayudarle
        </button>

        {/* FOOTER */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Última actualización:{" "}
          {new Date(data.lastUpdated).toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
