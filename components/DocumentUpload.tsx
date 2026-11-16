"use client";

import { useRef, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

interface DocumentUploadProps {
  plotId: string;
  currentDocumentUrl?: string | null;
  onUploadComplete: (url: string) => void;
  onDelete: () => void;
}

export default function DocumentUpload({
  plotId,
  currentDocumentUrl,
  onUploadComplete,
  onDelete,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = useCallback(
    async (file: File) => {
      const allowed = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/png",
        "image/webp",
      ];
      if (!allowed.includes(file.type)) {
        setError("PDF, DOC, DOCX, JPG, PNG, WEBP only");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError("File size must be under 20MB");
        return;
      }

      setUploading(true);
      setError(null);
      setProgress(0);

      try {
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.access_token) {
          throw new Error("Not authenticated");
        }

        setProgress(20);
        const base64 = await fileToBase64(file);
        setProgress(50);

        const res = await fetch("/api/plots/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            plot_id: plotId,
            filename: file.name,
            content_type: file.type,
            file_data: base64,
            is_document: true,
          }),
        });

        setProgress(80);

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload failed");
        }

        const { publicUrl } = await res.json();
        setProgress(100);
        onUploadComplete(publicUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [plotId, onUploadComplete]
  );

  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this document?")) return;
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;

      await fetch(`/api/plots/${plotId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ document_url: null }),
      });

      onDelete();
    } catch {
      setError("Delete failed");
    }
  }, [plotId, onDelete]);

  const isPdf = currentDocumentUrl?.toLowerCase().includes(".pdf");

  return (
    <div className="space-y-2">
      {currentDocumentUrl && (
        <div className="relative group">
          <a
            href={currentDocumentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-xs font-medium truncate">
              {isPdf ? "View PDF" : "View Document"}
            </span>
          </a>
          <button
            onClick={handleDelete}
            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete document"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors disabled:opacity-50"
      >
        {uploading ? `Uploading ${progress}%...` : currentDocumentUrl ? "Replace Document" : "Upload Document (PDF/DOC)"}
      </button>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}