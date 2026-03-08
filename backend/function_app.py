"""
HairScan AI — Azure Functions Backend
Análise Capilar por Comparação de Imagens (sem treinamento de modelo)

Endpoints:
  POST /api/upload          — Upload de imagem (referência ou teste)
  POST /api/analyze         — Disparar análise comparativa entre as 2 imagens
  GET  /api/results/{id}    — Consultar resultado de uma análise
  GET  /api/health          — Health check
"""

import azure.functions as func
import json
import logging
import os
import uuid
import base64
import io
from datetime import datetime, timedelta

import cv2
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions, ContentSettings
from openai import AzureOpenAI

# ─────────────────────────────────────────────
# App & Config
# ─────────────────────────────────────────────

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

logger = logging.getLogger("hairscan")

# In-memory results store (em produção, use Cosmos DB)
results_store = {}


def get_blob_service():
    conn_str = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    return BlobServiceClient.from_connection_string(conn_str)


def get_container_name():
    return os.environ.get("AZURE_STORAGE_CONTAINER_NAME", "hairscan-images")


def get_openai_client():
    return AzureOpenAI(
        azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT"),
        api_key=os.environ.get("AZURE_OPENAI_API_KEY"),
        api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    )


# ─────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────

@app.route(route="health", methods=["GET"])
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"status": "healthy", "service": "hairscan-ai", "timestamp": datetime.utcnow().isoformat()}),
        mimetype="application/json",
    )


# ─────────────────────────────────────────────
# Upload de Imagem
# ─────────────────────────────────────────────

@app.route(route="upload", methods=["POST"])
def upload_image(req: func.HttpRequest) -> func.HttpResponse:
    """
    Upload de uma imagem para o Blob Storage.
    
    Body (multipart/form-data):
      - file: arquivo de imagem (PNG/JPG)
      - type: "reference" ou "test"
    
    Returns:
      - blob_name: nome do arquivo no storage
      - url: URL com SAS token para acesso temporário
    """
    try:
        # Ler o arquivo do form-data
        file = req.files.get("file")
        image_type = req.form.get("type", "reference")

        if not file:
            return func.HttpResponse(
                json.dumps({"error": "Nenhum arquivo enviado. Envie um campo 'file' no form-data."}),
                status_code=400,
                mimetype="application/json",
            )

        # Validar tipo de arquivo
        allowed_extensions = {".png", ".jpg", ".jpeg", ".webp"}
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in allowed_extensions:
            return func.HttpResponse(
                json.dumps({"error": f"Formato não suportado: {file_ext}. Use PNG, JPG ou WebP."}),
                status_code=400,
                mimetype="application/json",
            )

        # Gerar nome único
        blob_name = f"{image_type}/{uuid.uuid4().hex}{file_ext}"
        file_data = file.read()

        # Validar tamanho (max 10MB)
        if len(file_data) > 10 * 1024 * 1024:
            return func.HttpResponse(
                json.dumps({"error": "Arquivo muito grande. Máximo 10MB."}),
                status_code=400,
                mimetype="application/json",
            )

        # Upload para Blob Storage
        blob_service = get_blob_service()
        container_name = get_container_name()
        container_client = blob_service.get_container_client(container_name)

        # Criar container se não existir
        try:
            container_client.create_container()
        except Exception:
            pass  # Container já existe

        blob_client = container_client.get_blob_client(blob_name)
        blob_client.upload_blob(
            file_data,
            overwrite=True,
            content_settings=ContentSettings(content_type=file.content_type or "image/jpeg")
        )

        # Gerar SAS URL (válida por 1 hora)
        sas_token = generate_blob_sas(
            account_name=blob_service.account_name,
            container_name=container_name,
            blob_name=blob_name,
            account_key=blob_service.credential.account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.utcnow() + timedelta(hours=1),
        )
        blob_url = f"{blob_client.url}?{sas_token}"

        logger.info(f"Imagem uploaded: {blob_name}")

        return func.HttpResponse(
            json.dumps({
                "success": True,
                "blob_name": blob_name,
                "url": blob_url,
                "type": image_type,
                "size": len(file_data),
            }),
            mimetype="application/json",
        )

    except Exception as e:
        logger.error(f"Erro no upload: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Erro interno: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
        )


# ─────────────────────────────────────────────
# Análise Comparativa
# ─────────────────────────────────────────────

@app.route(route="analyze", methods=["POST"])
def analyze_images(req: func.HttpRequest) -> func.HttpResponse:
    """
    Analisa duas imagens por comparação direta (sem modelo treinado).
    
    Body (JSON):
      - reference_blob: nome do blob da imagem de referência
      - test_blob: nome do blob da imagem de teste
    
    Returns:
      - analysis_id: ID para consultar resultado
      - segmentation_map: imagem de segmentação em base64
      - metrics: { confidence, clarity, consistency }
      - verdict: "reduction" ou "increase"
      - report: laudo textual gerado por IA
    """
    try:
        body = req.get_json()
        reference_blob = body.get("reference_blob")
        test_blob = body.get("test_blob")

        if not reference_blob or not test_blob:
            return func.HttpResponse(
                json.dumps({"error": "Envie 'reference_blob' e 'test_blob' no body JSON."}),
                status_code=400,
                mimetype="application/json",
            )

        # Baixar imagens do Blob Storage
        blob_service = get_blob_service()
        container_name = get_container_name()
        container_client = blob_service.get_container_client(container_name)

        ref_data = container_client.get_blob_client(reference_blob).download_blob().readall()
        test_data = container_client.get_blob_client(test_blob).download_blob().readall()

        # Converter para OpenCV
        ref_img = cv2.imdecode(np.frombuffer(ref_data, np.uint8), cv2.IMREAD_COLOR)
        test_img = cv2.imdecode(np.frombuffer(test_data, np.uint8), cv2.IMREAD_COLOR)

        if ref_img is None or test_img is None:
            return func.HttpResponse(
                json.dumps({"error": "Não foi possível decodificar uma ou ambas as imagens."}),
                status_code=400,
                mimetype="application/json",
            )

        # ── Passo 1: Redimensionar para mesmo tamanho ──
        target_h, target_w = 600, 400
        ref_resized = cv2.resize(ref_img, (target_w, target_h))
        test_resized = cv2.resize(test_img, (target_w, target_h))

        # ── Passo 2: Converter para escala de cinza ──
        ref_gray = cv2.cvtColor(ref_resized, cv2.COLOR_BGR2GRAY)
        test_gray = cv2.cvtColor(test_resized, cv2.COLOR_BGR2GRAY)

        # ── Passo 3: Calcular SSIM (Structural Similarity) ──
        score, diff_map = ssim(ref_gray, test_gray, full=True)
        diff_map = (diff_map * 255).astype(np.uint8)

        # ── Passo 4: Análise de textura (frizz = alta variância local) ──
        ref_laplacian = cv2.Laplacian(ref_gray, cv2.CV_64F)
        test_laplacian = cv2.Laplacian(test_gray, cv2.CV_64F)

        ref_texture = np.abs(ref_laplacian)
        test_texture = np.abs(test_laplacian)

        # Diferença de textura (positivo = menos frizz no teste)
        texture_diff = ref_texture - test_texture

        # ── Passo 5: Gerar mapa de segmentação por cores ──
        seg_map = np.ones((target_h, target_w, 3), dtype=np.uint8) * 255  # fundo branco

        # Thresholds para classificação
        improvement_mask = texture_diff > 15      # Grande melhoria (verde)
        slight_mask = (texture_diff > 5) & (texture_diff <= 15)  # Melhoria leve (roxo)
        no_change_mask = (texture_diff >= -5) & (texture_diff <= 5)  # Sem alteração (laranja)
        worse_mask = texture_diff < -5             # Piora (rosa)

        # Aplicar cores
        seg_map[improvement_mask] = [96, 197, 34]    # Verde (#22C55E em BGR)
        seg_map[slight_mask] = [246, 92, 139]         # Roxo (#8B5CF6 em BGR)
        seg_map[no_change_mask] = [11, 158, 245]      # Laranja (#F59E0B em BGR)
        seg_map[worse_mask] = [153, 72, 236]           # Rosa (#EC4899 em BGR)

        # Suavizar mapa
        seg_map = cv2.GaussianBlur(seg_map, (7, 7), 0)

        # ── Passo 6: Calcular métricas ──
        total_pixels = target_h * target_w
        improved_pixels = np.sum(improvement_mask) + np.sum(slight_mask)
        worse_pixels = np.sum(worse_mask)

        # Confiança: quão consistentes são as diferenças encontradas
        confidence = min(100, int((improved_pixels / total_pixels) * 100 + score * 20))
        confidence = max(5, min(95, confidence))

        # Clareza: quão nítida é a diferença (baseado no contraste do diff_map)
        clarity = int(np.std(diff_map) / 2.55)
        clarity = max(2, min(95, clarity))

        # Consistência: uniformidade das mudanças
        consistency = int(score * 100)
        consistency = max(10, min(100, consistency))

        # Veredicto
        verdict = "reduction" if improved_pixels > worse_pixels else "increase"

        # ── Passo 7: Converter segmentation map para base64 ──
        _, seg_buffer = cv2.imencode(".png", seg_map)
        seg_base64 = base64.b64encode(seg_buffer).decode("utf-8")

        # ── Passo 8: Gerar laudo com Azure OpenAI (GPT-4o) ──
        report = generate_ai_report(
            confidence=confidence,
            clarity=clarity,
            consistency=consistency,
            verdict=verdict,
            improved_pct=round(improved_pixels / total_pixels * 100, 1),
            worse_pct=round(worse_pixels / total_pixels * 100, 1),
            ref_base64=base64.b64encode(ref_data).decode("utf-8"),
            test_base64=base64.b64encode(test_data).decode("utf-8"),
        )

        # ── Passo 9: Salvar resultado ──
        analysis_id = uuid.uuid4().hex[:12]
        result = {
            "analysis_id": analysis_id,
            "timestamp": datetime.utcnow().isoformat(),
            "segmentation_map": seg_base64,
            "metrics": {
                "confidence": confidence,
                "clarity": clarity,
                "consistency": consistency,
            },
            "verdict": verdict,
            "verdict_label": "Redução do Frizz" if verdict == "reduction" else "Aumento do Frizz",
            "report": report,
            "stats": {
                "improved_pct": round(improved_pixels / total_pixels * 100, 1),
                "worse_pct": round(worse_pixels / total_pixels * 100, 1),
                "unchanged_pct": round(np.sum(no_change_mask) / total_pixels * 100, 1),
            },
        }

        # Salvar em memória (em produção, use Cosmos DB)
        results_store[analysis_id] = result

        # Salvar resultado no Blob Storage também
        result_blob_name = f"results/{analysis_id}.json"
        result_blob = container_client.get_blob_client(result_blob_name)
        result_blob.upload_blob(json.dumps(result), overwrite=True)

        logger.info(f"Análise concluída: {analysis_id} — {result['verdict_label']}")

        return func.HttpResponse(
            json.dumps(result),
            mimetype="application/json",
        )

    except Exception as e:
        logger.error(f"Erro na análise: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Erro na análise: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
        )


def generate_ai_report(confidence, clarity, consistency, verdict, improved_pct, worse_pct, ref_base64, test_base64):
    """Gera laudo textual usando Azure OpenAI GPT-4o com visão."""
    try:
        client = get_openai_client()
        deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")

        prompt = f"""Você é um especialista em tricologia (ciência capilar) analisando o resultado de um tratamento capilar.

Duas imagens foram comparadas:
- Imagem 1: Mecha de cabelo ANTES do tratamento (referência)
- Imagem 2: Mecha de cabelo DEPOIS do tratamento (teste)

Resultados da análise computacional:
- Veredicto: {"Redução do Frizz" if verdict == "reduction" else "Aumento do Frizz"}
- Confiança da análise: {confidence}%
- Clareza das diferenças: {clarity}%
- Consistência das mudanças: {consistency}%
- Percentual de melhoria: {improved_pct}%
- Percentual de piora: {worse_pct}%

Com base nas imagens e nos dados acima, escreva um laudo profissional em português brasileiro (3-4 frases) sobre:
1. O resultado geral do tratamento
2. As áreas de maior impacto
3. Uma recomendação sobre o protocolo de tratamento

Seja objetivo, profissional e use termos técnicos quando apropriado. Não use markdown."""

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{ref_base64}",
                            "detail": "low",
                        },
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{test_base64}",
                            "detail": "low",
                        },
                    },
                ],
            }
        ]

        response = client.chat.completions.create(
            model=deployment,
            messages=messages,
            max_tokens=300,
            temperature=0.4,
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        logger.warning(f"Erro ao gerar laudo com IA: {str(e)}")
        # Fallback: laudo estático baseado nos dados
        if verdict == "reduction":
            return (
                f"Excelente resultado! A análise computacional indica uma redução significativa do frizz, "
                f"com {improved_pct}% da área apresentando melhoria. "
                f"O tratamento promoveu melhor alinhamento e controle dos fios. "
                f"Recomenda-se manter o protocolo atual para resultados consistentes."
            )
        else:
            return (
                f"A análise indica um aumento do frizz na mecha tratada, "
                f"com {worse_pct}% da área apresentando piora. "
                f"Recomenda-se revisar o protocolo de tratamento aplicado "
                f"e considerar ajustes na formulação ou técnica de aplicação."
            )


# ─────────────────────────────────────────────
# Consultar Resultado
# ─────────────────────────────────────────────

@app.route(route="results/{analysis_id}", methods=["GET"])
def get_results(req: func.HttpRequest) -> func.HttpResponse:
    """Consulta o resultado de uma análise pelo ID."""
    analysis_id = req.route_params.get("analysis_id")

    # Tentar memória primeiro
    if analysis_id in results_store:
        return func.HttpResponse(
            json.dumps(results_store[analysis_id]),
            mimetype="application/json",
        )

    # Tentar Blob Storage
    try:
        blob_service = get_blob_service()
        container_name = get_container_name()
        container_client = blob_service.get_container_client(container_name)
        result_blob = container_client.get_blob_client(f"results/{analysis_id}.json")
        data = result_blob.download_blob().readall()
        return func.HttpResponse(data, mimetype="application/json")
    except Exception:
        return func.HttpResponse(
            json.dumps({"error": "Análise não encontrada."}),
            status_code=404,
            mimetype="application/json",
        )