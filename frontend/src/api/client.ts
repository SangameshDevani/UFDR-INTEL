export interface Case {
  id: string;
  case_number: string;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  extraction_count: number;
}

export interface Extraction {
  id: string;
  case_id: string;
  filename: string;
  file_hash: string;
  file_size: number;
  status: string;
  progress: number;
  error_message: string | null;
  device_info: Record<string, string> | null;
  stats: Record<string, number> | null;
  created_at: string;
  completed_at: string | null;
}

export interface Entity {
  entity_type: string;
  value: string;
}

export interface Artifact {
  id: string;
  extraction_id: string;
  artifact_type: string;
  app_name: string | null;
  title: string | null;
  content: string | null;
  participants: string[] | null;
  timestamp: string | null;
  metadata_json: Record<string, unknown> | null;
  entities: Entity[];
}

export interface Citation {
  artifact_id: string;
  artifact_type: string;
  title: string | null;
  app_name: string | null;
  timestamp: string | null;
  excerpt: string;
  entities: Entity[];
}

export interface NLQueryResponse {
  query: string;
  intent: string;
  summary: string;
  result_count: number;
  citations: Citation[];
  filters_applied: Record<string, unknown>;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  listCases: () => request<Case[]>("/api/cases"),
  createCase: (data: { case_number: string; title: string; description?: string }) =>
    request<Case>("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  getCase: (id: string) => request<Case>(`/api/cases/${id}`),
  listExtractions: (caseId: string) => request<Extraction[]>(`/api/cases/${caseId}/extractions`),
  uploadUfdr: async (caseId: string, file: File, password?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (password) form.append("password", password);
    const res = await fetch(`/api/cases/${caseId}/extractions`, { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json() as Promise<Extraction>;
  },
  search: (caseId: string, body: Record<string, unknown>) =>
    request<Artifact[]>(`/api/cases/${caseId}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  nlQuery: (caseId: string, query: string) =>
    request<NLQueryResponse>(`/api/cases/${caseId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    }),
  exportReport: (caseId: string, query: string) =>
    fetch(`/api/cases/${caseId}/reports/export?query=${encodeURIComponent(query)}`).then((r) => r.text()),
};
