/**
 * HairScan AI — API Service
 * Comunicação com o backend Azure Functions
 */

import axios from "axios";

// URL base do backend — altere para a URL do seu Azure Functions em produção
const API_BASE = import.meta.env.VITE_API_URL || "https://func-hairscan-ai-ftgqdvfyceavggfn.brazilsouth-01.azurewebsites.net/ap";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2 minutos (análise pode demorar)
});

/**
 * Upload de imagem para o Azure Blob Storage via Azure Functions
 * @param {File} file - Arquivo de imagem
 * @param {"reference" | "test"} type - Tipo da imagem
 * @returns {Promise<{blob_name: string, url: string, type: string}>}
 */
export async function uploadImage(file, type) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const response = await api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round(
        (progressEvent.loaded * 100) / progressEvent.total
      );
      console.log(`Upload ${type}: ${percentCompleted}%`);
    },
  });

  return response.data;
}

/**
 * Disparar análise comparativa entre as 2 imagens
 * @param {string} referenceBlob - Nome do blob da imagem de referência
 * @param {string} testBlob - Nome do blob da imagem de teste
 * @returns {Promise<AnalysisResult>}
 */
export async function analyzeImages(referenceBlob, testBlob) {
  const response = await api.post("/analyze", {
    reference_blob: referenceBlob,
    test_blob: testBlob,
  });

  return response.data;
}

/**
 * Consultar resultado de uma análise anterior
 * @param {string} analysisId - ID da análise
 * @returns {Promise<AnalysisResult>}
 */
export async function getResults(analysisId) {
  const response = await api.get(`/results/${analysisId}`);
  return response.data;
}

/**
 * Health check do backend
 * @returns {Promise<{status: string}>}
 */
export async function healthCheck() {
  const response = await api.get("/health");
  return response.data;
}

export default api;
