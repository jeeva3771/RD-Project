import React, { useState } from "react";

export default function DocumentPreviewModal({ attachment, onClose }) {
  const [imgError, setImgError] = useState(false);

  if (!attachment || !attachment.url) return null;

  const rawUrl = attachment.url;
  // If URL is an R2 key or needs backend proxy, format accordingly
  const viewUrl = rawUrl.startsWith("http")
    ? rawUrl
    : `${import.meta.env.VITE_BACKEND_URL}/image/view?url=${encodeURIComponent(rawUrl)}`;

  const name = attachment.name || rawUrl.split("/").pop().split("?")[0] || "Document";
  const isPdf = /\.pdf($|\?)/i.test(rawUrl) || /\.pdf($|\?)/i.test(name);
  const isImage = /\.(png|jpe?g|webp|gif|bmp|svg)($|\?)/i.test(rawUrl) || /\.(png|jpe?g|webp|gif|bmp|svg)($|\?)/i.test(name);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.85)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backdropFilter: "blur(2px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          width: 900,
          maxWidth: "96vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: "#0F172A",
            color: "white",
            padding: "12px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
            <span style={{ fontSize: 16 }}>📎</span>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "60vw",
              }}
              title={name}
            >
              {name}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "white",
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 800,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
              title="Open document in a new browser tab"
            >
              ↗ Open in New Window
            </a>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: 20,
                fontWeight: 900,
                cursor: "pointer",
                lineHeight: 1,
                marginLeft: 4,
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div
          style={{
            padding: 16,
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#F8FAFC",
            minHeight: 450,
          }}
        >
          {isPdf ? (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
              <iframe
                src={viewUrl}
                title={name}
                style={{
                  width: "100%",
                  height: "75vh",
                  border: "1px solid #CBD5E1",
                  borderRadius: 8,
                  background: "white",
                }}
              />
              <div style={{ textAlign: "center", marginTop: 8, fontSize: 11.5, color: "#64748B" }}>
                Can't see the PDF preview?{" "}
                <a
                  href={viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0D9488", fontWeight: 800, textDecoration: "underline" }}
                >
                  Click here to open in new tab
                </a>
              </div>
            </div>
          ) : isImage ? (
            imgError ? (
              <div style={{ textAlign: "center", padding: "30px 20px" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#1E293B", marginBottom: 6 }}>
                  Unable to render image inline
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>
                  You can still open and view it directly.
                </div>
                <a
                  href={viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: "#0D9488",
                    color: "white",
                    padding: "8px 18px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 800,
                    textDecoration: "none",
                  }}
                >
                  ↗ Open Image in New Tab
                </a>
              </div>
            ) : (
              <img
                src={viewUrl}
                alt={name}
                onError={() => setImgError(true)}
                style={{
                  maxWidth: "100%",
                  maxHeight: "75vh",
                  objectFit: "contain",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              />
            )
          ) : (
            // Default iframe fallback for unknown file types
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
              <iframe
                src={viewUrl}
                title={name}
                style={{
                  width: "100%",
                  height: "75vh",
                  border: "1px solid #CBD5E1",
                  borderRadius: 8,
                  background: "white",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
