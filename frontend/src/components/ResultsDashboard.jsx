import { useState, useEffect } from "react";
import { TrendingDown, TrendingUp, RotateCcw, Download } from "lucide-react";

/**
 * Dashboard de resultados da análise capilar
 */
export default function ResultsDashboard({ results, onNewAnalysis }) {
  const [animatedMetrics, setAnimatedMetrics] = useState({
    confidence: 0,
    clarity: 0,
    consistency: 0,
  });
  const [displayedReport, setDisplayedReport] = useState("");
  const [reportDone, setReportDone] = useState(false);

  const { metrics, verdict, verdict_label, segmentation_map, report, stats } =
    results;

  const isPositive = verdict === "reduction";

  // Animar métricas
  useEffect(() => {
    const duration = 1200;
    const steps = 60;
    const interval = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      setAnimatedMetrics({
        confidence: Math.round(metrics.confidence * eased),
        clarity: Math.round(metrics.clarity * eased),
        consistency: Math.round(metrics.consistency * eased),
      });

      if (step >= steps) clearInterval(timer);
    }, interval);

    return () => clearInterval(timer);
  }, [metrics]);

  // Efeito de digitação do laudo
  useEffect(() => {
    if (!report) return;
    let idx = 0;
    const timer = setInterval(() => {
      idx++;
      setDisplayedReport(report.substring(0, idx));
      if (idx >= report.length) {
        clearInterval(timer);
        setReportDone(true);
      }
    }, 18);
    return () => clearInterval(timer);
  }, [report]);

  function getBarColor(value) {
    if (value >= 70) return "#22c55e";
    if (value >= 40) return "#f59e0b";
    return "#ef4444";
  }

  function MetricBar({ label, value, animated }) {
    return (
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: getBarColor(value),
            }}
          >
            {animated}%
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: "#f1f5f9",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${animated}%`,
              borderRadius: 4,
              background: `linear-gradient(90deg, ${getBarColor(value)}88, ${getBarColor(value)})`,
              transition: "width 0.3s ease-out",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: "slideUp 0.5s ease" }}>
      <style>{`
        @keyframes slideUp { 
          from { opacity: 0; transform: translateY(20px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
        }}
      >
        {/* Mapa de Segmentação */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid #f1f5f9",
              fontSize: 13,
              fontWeight: 600,
              color: "#1e293b",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            🔬 Mapa de Segmentação
          </div>

          <div
            style={{
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 260,
            }}
          >
            {segmentation_map ? (
              <img
                src={`data:image/png;base64,${segmentation_map}`}
                alt="Mapa de segmentação"
                style={{
                  maxWidth: "100%",
                  maxHeight: 300,
                  borderRadius: 8,
                }}
              />
            ) : (
              <div style={{ color: "#94a3b8", fontSize: 13 }}>
                Mapa não disponível
              </div>
            )}
          </div>

          {/* Legenda */}
          <div
            style={{
              padding: "12px 18px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            {[
              { color: "#22c55e", label: "Grande Melhoria" },
              { color: "#8b5cf6", label: "Melhoria Leve" },
              { color: "#f59e0b", label: "Sem Alteração" },
              { color: "#ec4899", label: "Piora" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "#64748b",
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: item.color,
                  }}
                />
                {item.label}
              </div>
            ))}
          </div>

          {/* Stats */}
          {stats && (
            <div
              style={{
                padding: "10px 18px",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                gap: 20,
                fontSize: 11,
                color: "#94a3b8",
              }}
            >
              <span>
                Melhoria: <strong style={{ color: "#22c55e" }}>{stats.improved_pct}%</strong>
              </span>
              <span>
                Piora: <strong style={{ color: "#ec4899" }}>{stats.worse_pct}%</strong>
              </span>
              <span>
                Sem alteração: <strong style={{ color: "#f59e0b" }}>{stats.unchanged_pct}%</strong>
              </span>
            </div>
          )}
        </div>

        {/* Métricas + Laudo */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header com veredicto */}
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#1e293b",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              📊 Métricas
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 14px",
                borderRadius: 20,
                background: isPositive ? "#ecfdf5" : "#fef2f2",
                color: isPositive ? "#10b981" : "#ef4444",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {isPositive ? (
                <TrendingDown size={13} />
              ) : (
                <TrendingUp size={13} />
              )}
              {verdict_label}
            </span>
          </div>

          {/* Barras de métricas */}
          <div style={{ padding: "22px 20px", flex: 1 }}>
            <MetricBar
              label="Confiança"
              value={metrics.confidence}
              animated={animatedMetrics.confidence}
            />
            <MetricBar
              label="Clareza"
              value={metrics.clarity}
              animated={animatedMetrics.clarity}
            />
            <MetricBar
              label="Consistência"
              value={metrics.consistency}
              animated={animatedMetrics.consistency}
            />
          </div>

          {/* Laudo IA */}
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid #f1f5f9",
              background: "#fafbfc",
            }}
          >
            <h4
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              🧠 Laudo Gerado por IA
            </h4>
            <p
              style={{
                fontSize: 13,
                color: "#475569",
                lineHeight: 1.7,
                minHeight: 60,
              }}
            >
              {displayedReport}
              {!reportDone && (
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 14,
                    background: "#6366f1",
                    verticalAlign: "middle",
                    marginLeft: 2,
                    animation: "blink 0.8s infinite",
                  }}
                />
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Botão nova análise */}
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <button
          onClick={onNewAnalysis}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 28px",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            background: "#fff",
            color: "#1e293b",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = "#6366f1";
            e.target.style.color = "#6366f1";
            e.target.style.background = "#eef2ff";
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = "#e2e8f0";
            e.target.style.color = "#1e293b";
            e.target.style.background = "#fff";
          }}
        >
          <RotateCcw size={14} />
          Nova Análise
        </button>
      </div>
    </div>
  );
}
