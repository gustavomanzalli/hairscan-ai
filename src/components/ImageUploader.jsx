import { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";

/**
 * Componente de upload de imagem com drag-and-drop
 */
export default function ImageUploader({ type, label, onImageSelected, disabled }) {
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef(null);

  const isRef = type === "reference";
  const accentColor = isRef ? "#6366f1" : "#ec4899";
  const bgColor = isRef ? "#eef2ff" : "#fdf2f8";

  function handleFile(file) {
    if (!file) return;

    // Validar
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Formato não suportado. Use PNG, JPG ou WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);

    onImageSelected(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleInputChange(e) {
    handleFile(e.target.files[0]);
  }

  function removeImage(e) {
    e.stopPropagation();
    setPreview(null);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
    onImageSelected(null);
  }

  if (preview) {
    return (
      <div
        style={{
          position: "relative",
          borderRadius: 14,
          overflow: "hidden",
          border: `2px solid ${accentColor}40`,
          background: "#fff",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}
      >
        {/* Label badge */}
        <span
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            zIndex: 2,
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            padding: "4px 10px",
            borderRadius: 6,
            background: accentColor,
            color: "#fff",
          }}
        >
          {label}
        </span>

        {/* Remove button */}
        {!disabled && (
          <button
            onClick={removeImage}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              zIndex: 2,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.background = "#ef4444")}
            onMouseLeave={(e) => (e.target.style.background = "rgba(0,0,0,0.6)")}
          >
            <X size={14} />
          </button>
        )}

        <img
          src={preview}
          alt={label}
          style={{
            width: "100%",
            height: 220,
            objectFit: "cover",
            display: "block",
          }}
        />

        {/* File name */}
        <div
          style={{
            padding: "8px 12px",
            fontSize: 11,
            color: "#64748b",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ImageIcon size={12} />
          {fileName}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        border: `2px dashed ${isDragging ? accentColor : "#e2e8f0"}`,
        borderRadius: 14,
        padding: "36px 20px",
        textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.25s",
        background: isDragging ? bgColor : "#fff",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleInputChange}
        style={{ display: "none" }}
      />

      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: bgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 14px",
        }}
      >
        <Upload size={22} color={accentColor} />
      </div>

      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#1e293b",
          marginBottom: 4,
        }}
      >
        {label}
      </h3>
      <p style={{ fontSize: 12, color: "#94a3b8" }}>
        Clique ou arraste a imagem
      </p>
      <p style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>
        PNG, JPG até 10MB
      </p>
    </div>
  );
}
