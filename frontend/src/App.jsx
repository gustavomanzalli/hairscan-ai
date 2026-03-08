import { useState } from "react";
import { Scan, CheckCircle2 } from "lucide-react";
import ImageUploader from "./components/ImageUploader";
import ResultsDashboard from "./components/ResultsDashboard";
import { uploadImage, analyzeImages } from "./services/api";

/**
 * HairScan AI — App Principal
 * Fluxo: Upload → Análise → Resultados
 */
export default function App() {
  // Estado global
  const [step, setStep] = useState(1); // 1=upload, 2=loading, 3=results
  const [refFile, setRefFile] = useState(null);
  const [testFile, setTestFile] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState("");

  const canAnalyze = refFile && testFile;

  async function handleAnalyze() {
    if (!canAnalyze) return;
    setError(null);
    setStep(2);

    const loadingSteps = [
      "Enviando imagens para a nuvem...",
      "Alinhando imagens...",
      "Calculando diferenças pixel a pixel...",
      "Gerando mapa de segmentação...",
      "Analisando métricas de frizz...",
      "Gerando laudo com IA...",
    ];

    let stepIdx = 0;
    setLoadingMessage(loadingSteps[0]);
    const loadingInterval = setInterval(() => {
      stepIdx++;
      if (stepIdx < loadingSteps.length) {
        setLoadingMessage(loadingSteps[stepIdx]);
      }
    }, 2500);

    try {
      // 1. Upload das imagens
      setLoadingMessage(loadingSteps[0]);
      const [refResult, testResult] = await Promise.all([
        uploadImage(refFile, "reference"),
        uploadImage(testFile, "test"),
      ]);

      // 2. Disparar análise
      setLoadingMessage("Analisando diferenças entre as imagens...");
      const analysisResult = await analyzeImages(
        refResult.blob_name,
        testResult.blob_name
      );

      clearInterval(loadingInterval);
      setResults(analysisResult);
      setStep(3);
    } catch (err) {
      clearInterval(loadingInterval);
      console.error("Erro na análise:", err);
      setError(
        err.response?.data?.error ||
          "Erro ao processar a análise. Verifique se o backend está rodando."
      );
      setStep(1);
    }
  }

  function handleReset() {
    setStep(1);
    setRefFile(null);
    setTestFile(null);
    setResults(null);
    setError(null);
    setLoadingMessage("");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f9fb",
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 16,
            }}
          >
            💇
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", margin: 0 }}>
              HairScan AI
            </h1>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              Análise Capilar Inteligente
            </span>
          </div>
        </div>

        {/* Steps indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              background: step >= 2 ? "#10b981" : "#6366f1",
              color: "#fff",
              boxShadow:
                step === 1
                  ? "0 2px 8px rgba(99,102,241,0.35)"
                  : "0 2px 8px rgba(16,185,129,0.35)",
            }}
          >
            {step >= 2 ? <CheckCircle2 size={14} /> : "1"}
          </div>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Upload</span>

          <div
            style={{
              width: 32,
              height: 2,
              background: step >= 3 ? "#10b981" : "#e2e8f0",
              borderRadius: 2,
            }}
          />

          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              background: step >= 3 ? "#6366f1" : "#f1f5f9",
              color: step >= 3 ? "#fff" : "#94a3b8",
              boxShadow:
                step >= 3 ? "0 2px 8px rgba(99,102,241,0.35)" : "none",
            }}
          >
            2
          </div>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Resultado</span>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 24px" }}>
        {/* Error */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 20,
              fontSize: 13,
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 1 && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
                marginBottom: 24,
              }}
            >
              <ImageUploader
                type="reference"
                label="Imagem de Referência"
                onImageSelected={setRefFile}
                disabled={false}
              />
              <ImageUploader
                type="test"
                label="Imagem de Teste"
                onImageSelected={setTestFile}
                disabled={false}
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                maxWidth: 320,
                margin: "0 auto",
                padding: "14px 28px",
                border: "none",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: canAnalyze ? "pointer" : "not-allowed",
                color: "#fff",
                background: canAnalyze
                  ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                  : "#e2e8f0",
                boxShadow: canAnalyze
                  ? "0 4px 16px rgba(99,102,241,0.3)"
                  : "none",
                transition: "all 0.3s",
              }}
            >
              <Scan size={18} />
              Iniciar Análise
            </button>
          </div>
        )}

        {/* Step 2: Loading */}
        {step === 2 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div
              style={{
                width: 52,
                height: 52,
                border: "3px solid #eef2ff",
                borderTopColor: "#6366f1",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 20px",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "#475569",
                marginBottom: 6,
              }}
            >
              {loadingMessage}
            </p>
            <p style={{ fontSize: 12, color: "#94a3b8" }}>
              Isso pode levar alguns segundos
            </p>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && results && (
          <ResultsDashboard results={results} onNewAnalysis={handleReset} />
        )}
      </main>
    </div>
  );
}
