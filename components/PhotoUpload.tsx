"use client";

import { useRef, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

interface PhotoUploadProps {
  plotId: string;
  currentPhotoUrl?: string | null;
  onUploadComplete: (url: string) => void;
  onDelete: () => void;
}

export default function PhotoUpload({
  plotId,
  currentPhotoUrl,
  onUploadComplete,
  onDelete,
}: PhotoUploadProps) {
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
      if (!file.type.startsWith("image/")) {
        setError("Only image files are allowed");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be under 10MB");
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

        // Convert file to base64
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
    if (!confirm("Delete this photo?")) return;
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
        body: JSON.stringify({ photo_url: null }),
      });

      onDelete();
    } catch {
      setError("Delete failed");
    }
  }, [plotId, onDelete]);

  return (
    <div className="space-y-2">
      {currentPhotoUrl && (
        <div className="relative group">
          <img
            src={currentPhotoUrl}
            alt="Plot photo"
            className="w-full h-40 object-cover rounded-lg border border-[var(--border)]"
          />
          <button
            onClick={handleDelete}
            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete photo"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.webp,.png,.jpg,.jpeg,.gif,.bmp,.svg+xml"
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
        {uploading ? `Uploading ${progress}%...` : currentPhotoUrl ? "Replace Photo" : "Upload Photo"}
      </button>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}