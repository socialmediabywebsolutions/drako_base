"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import { AppWindow, FileText, Plus, ScanSearch, Upload } from "lucide-react";
import { Table, TableWrap, TBody, TD, TH, THead } from "@/components/ui/table";
import { MentoriaAppSectionNav } from "@/components/mentoria-app/app-section-nav";
import type { MentoriaAcademicDocument, MentoriaAcademicRecord } from "@/lib/mentoria/academic-types";
import type { StudentProfile } from "@/lib/mentoria/types";

type AcademicResponse = {
  ok?: boolean;
  student?: StudentProfile | null;
  records?: MentoriaAcademicRecord[];
  documents?: MentoriaAcademicDocument[];
  error?: string;
};

const RECORD_TYPES = [
  { value: "", label: "Todos" },
  { value: "exam", label: "Examen" },
  { value: "homework", label: "Tarea" },
  { value: "project", label: "Trabajo" },
  { value: "notebook", label: "Cuaderno" },
  { value: "behavior", label: "Actitud" },
  { value: "presentation", label: "Higiene / presentación" },
  { value: "custom", label: "Otro" },
] as const;

export function MentoriaAcademicHub() {
  const searchParams = useSearchParams();
  const selectedStudentId = searchParams.get("studentId")?.trim() || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [records, setRecords] = useState<MentoriaAcademicRecord[]>([]);
  const [documents, setDocuments] = useState<MentoriaAcademicDocument[]>([]);
  const [subjectSlug, setSubjectSlug] = useState("");
  const [recordTypeFilter, setRecordTypeFilter] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualRecordType, setManualRecordType] = useState("custom");
  const [manualTitle, setManualTitle] = useState("");
  const [manualComment, setManualComment] = useState("");
  const [manualScore, setManualScore] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzingDocumentId, setAnalyzingDocumentId] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const requestQuery = useMemo(() => {
    const url = new URL("https://mentoria.drako.systems/api/mentoria/academic/records");
    if (selectedStudentId) url.searchParams.set("studentId", selectedStudentId);
    if (subjectSlug) url.searchParams.set("subjectSlug", subjectSlug);
    if (recordTypeFilter) url.searchParams.set("recordType", recordTypeFilter);
    return `${url.pathname}${url.search}`;
  }, [recordTypeFilter, selectedStudentId, subjectSlug]);

  async function load() {
    setLoading(true);
    setError(null);
    const response = await fetch(requestQuery, { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/app/academic";
      return;
    }
    if (response.status === 409) {
      window.location.href = "/mentoria/onboarding";
      return;
    }
    if (response.status === 403) {
      setError("STUDENT_ACCESS_DENIED");
      setLoading(false);
      return;
    }
    const body = (await response.json().catch(() => null)) as AcademicResponse | null;
    if (!response.ok || !body) {
      setError(body?.error ?? "MENTORIA_ACADEMIC_LOAD_FAILED");
      setLoading(false);
      return;
    }
    setStudent(body.student ?? null);
    setRecords(body.records ?? []);
    setDocuments(body.documents ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [requestQuery]);

  async function createManualRecord() {
    const response = await fetch("/api/mentoria/academic/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: selectedStudentId || undefined,
        subjectSlug: subjectSlug || undefined,
        recordType: manualRecordType || "custom",
        title: manualTitle,
        teacherComment: manualComment || undefined,
        scoreValue: manualScore ? Number(manualScore) : undefined,
        scoreScale: manualScore ? 10 : undefined,
      }),
    });
    if (response.ok) {
      setManualOpen(false);
      setManualRecordType("custom");
      setManualTitle("");
      setManualComment("");
      setManualScore("");
      await load();
      return;
    }
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setError(body?.error ?? "MENTORIA_ACADEMIC_MANUAL_CREATE_FAILED");
  }

  async function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    if (selectedStudentId) formData.append("studentId", selectedStudentId);
    if (subjectSlug) formData.append("subjectSlug", subjectSlug);
    if (recordTypeFilter) formData.append("recordType", recordTypeFilter);

    const response = await fetch("/api/mentoria/academic/upload", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      setUploading(false);
      await load();
      return;
    }

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setError(body?.error ?? "MENTORIA_ACADEMIC_UPLOAD_FAILED");
    setUploading(false);
  }

  async function analyzeDocument(document: MentoriaAcademicDocument) {
    setAnalyzingDocumentId(document.id);
    setError(null);
    const response = await fetch("/api/mentoria/academic/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: selectedStudentId || student?.id || undefined,
        documentId: document.id,
        rawText: document.notesText ?? undefined,
      }),
    });

    if (response.ok) {
      setAnalyzingDocumentId(null);
      await load();
      return;
    }

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setError(body?.error ?? "MENTORIA_ACADEMIC_ANALYZE_FAILED");
    setAnalyzingDocumentId(null);
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <MentoriaAppSectionNav active="academic" />
        <div className="mb-6 flex flex-col gap-4 rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Vida académica</h1>
              <p className="text-sm text-slate-500">
                {student ? `Registros reales y documentos de ${student.fullName}.` : "Registros reales del alumno activo."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(event) => void handleUploadChange(event)}
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Subiendo..." : "Subir documento"}
              </button>
              <button
                type="button"
                onClick={() => setManualOpen((current) => !current)}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Entrada manual
              </button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-slate-600">
              Materia
              <input
                value={subjectSlug}
                onChange={(event) => setSubjectSlug(event.target.value.trim())}
                placeholder="matematicas"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-600">
              Tipo
              <select
                value={recordTypeFilter}
                onChange={(event) => setRecordTypeFilter(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              >
                {RECORD_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">Registros</div>
              <div>{records.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">Documentos</div>
              <div>{documents.length}</div>
            </div>
          </div>
          {manualOpen ? (
            <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              <label className="text-sm text-slate-600">
                Tipo de registro
                <select
                  value={manualRecordType}
                  onChange={(event) => setManualRecordType(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {RECORD_TYPES.filter((item) => item.value).map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Título
                <input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm text-slate-600">
                Nota
                <input value={manualScore} onChange={(event) => setManualScore(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm text-slate-600 md:col-span-2">
                Comentario
                <textarea value={manualComment} onChange={(event) => setManualComment(event.target.value)} className="mt-1 min-h-24 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <div className="md:col-span-2">
                <button type="button" onClick={() => void createManualRecord()} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                  Guardar registro
                </button>
              </div>
            </div>
          ) : null}
          {loading ? <div className="text-sm text-slate-500">Cargando vida académica...</div> : null}
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="rounded-[28px] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-slate-900">
              <AppWindow className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Registros académicos</h2>
            </div>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH className="px-4 py-3 text-left">Tipo</TH>
                    <TH className="px-4 py-3 text-left">Título</TH>
                    <TH className="px-4 py-3 text-left">Materia</TH>
                    <TH className="px-4 py-3 text-left">Nota</TH>
                    <TH className="px-4 py-3 text-left">Estado</TH>
                  </tr>
                </THead>
                <TBody>
                  {records.length === 0 ? (
                    <tr>
                      <TD className="px-4 py-6 text-sm text-slate-500" colSpan={5}>Aún no hay registros académicos para este filtro.</TD>
                    </tr>
                  ) : records.map((record) => (
                    <tr key={record.id} className="border-t border-slate-100">
                      <TD className="px-4 py-3 text-sm text-slate-700">{record.recordType}</TD>
                      <TD className="px-4 py-3 text-sm font-medium text-slate-950">{record.title}</TD>
                      <TD className="px-4 py-3 text-sm text-slate-700">{record.subjectSlug ?? "sin materia"}</TD>
                      <TD className="px-4 py-3 text-sm text-slate-700">{record.scoreValue !== null ? `${record.scoreValue}/${record.scoreScale ?? 10}` : "sin nota"}</TD>
                      <TD className="px-4 py-3 text-sm text-slate-700">{record.status}</TD>
                    </tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-slate-900">
              <FileText className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Documentos</h2>
            </div>
            <div className="space-y-3">
              {documents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                  Todavía no hay documentos académicos cargados.
                </div>
              ) : documents.map((document) => (
                <div key={document.id} className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{document.fileName ?? document.storageKey}</div>
                      <div className="mt-1 text-xs text-slate-500">{document.classification} · {document.subjectSlug ?? "sin materia"}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{document.analysisStatus}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <ScanSearch className="h-4 w-4" />
                    {document.notesText ?? "Sin nota contextual adicional."}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div className="text-xs text-slate-500">
                      {document.sourceChannel} · {document.documentKind.toUpperCase()}
                    </div>
                    <button
                      type="button"
                      onClick={() => void analyzeDocument(document)}
                      disabled={analyzingDocumentId === document.id}
                      className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {analyzingDocumentId === document.id
                        ? "Analizando..."
                        : document.analysisStatus === "pending"
                          ? "Analizar"
                          : "Reanalizar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
