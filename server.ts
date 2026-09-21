import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy Gemini AI initialization to prevent crashing if key is missing
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set. Please provide it in AI Studio settings.');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support up to 25MB body for screenshot transmission (held purely in RAM)
  app.use(express.json({ limit: '25mb' }));

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      time: new Date().toISOString(),
    });
  });

  // POST /api/extract-shopee-screenshot
  // Extracts all 16 KPIs from Shopee Livestream Insight screenshot using Gemini 3.8 Flash Vision
  // ZERO disk storage, ZERO permanent image holding. Buffer is discarded immediately.
  app.post('/api/extract-shopee-screenshot', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg' } = req.body;

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({
          error: 'Gambar tidak ditemukan dalam request.',
          details: 'Pastikan file screenshot terkirim dalam format base64.',
        });
      }

      // Clean base64 header if present (e.g. "data:image/jpeg;base64,")
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');

      const prompt = `You are an expert AI vision system specialized in reading Indonesian e-commerce analytics dashboards, specifically "Wawasan Livestream" from Shopee Seller Centre / Shopee Live.

Analyze this screenshot and extract all 16 Key Performance Indicators (KPIs) and the Order Status filter.
Here is the visual mapping of the Shopee Wawasan Livestream dashboard:
1. Header / Filter:
   - "Wawasan Livestream"
   - "Status Pesanan" (e.g., "Pesanan Siap Dikirim", "Semua", or other order status filter dropdown)
2. Main Big Card:
   - "Penjualan (Rp)" -> top large number in orange card. Indonesian dots are thousand separators (e.g., "626.084" means 626084).
3. 3 Secondary Metrics:
   - "Penonton Aktif" (e.g., "139" -> 139)
   - "Komentar" (e.g., "39" -> 39)
   - "Tambah ke Keranjang" (e.g., "105" -> 105)
4. 12 Detailed Grid Metrics:
   - "Dilihat" (e.g., "3.948" -> 3948)
   - "Durasi Rata-Rata Menonton" (e.g., "00:00:20" -> 20 seconds as integer)
   - "Persentase Komentar" (e.g., "1,0%" -> 1.0 as float percentage)
   - "Penjualan per mil (Rp)" (e.g., "158.583" -> 158583)
   - "Pesanan" (e.g., "15" -> 15)
   - "Nilai Penjualan per Pesanan" (e.g., "41.739" -> 41739)
   - "Penonton" (e.g., "3.341" -> 3341)
   - "Penonton Tertinggi" (e.g., "32" -> 32)
   - "Persentase Klik" (e.g., "6,7%" -> 6.7 as float percentage)
   - "Pesanan per Klik" (e.g., "5,7%" -> 5.7 as float percentage)
   - "Pembeli" (e.g., "15" -> 15)
   - "Produk Terjual" (e.g., "25" -> 25)

CRITICAL RULES FOR NUMERIC VALUES:
- Indonesian thousands use DOT (".") as separator: "626.084" MUST be the number 626084 (integer), NOT 626.084. "3.948" MUST be 3948.
- Indonesian decimals use COMMA (","): "1,0%" MUST be 1.0. "6,7%" MUST be 6.7. "5,7%" MUST be 5.7.
- Durations like "00:00:20" MUST be converted to integer total seconds: 20. If "01:10:30", convert to 1*3600 + 10*60 + 30 = 4230 seconds.
- Every field value MUST be a numeric number (integer or float) or null if genuinely missing. DO NOT return strings with "Rp", "%", or thousand dots.
- Also evaluate a confidence score between 0.00 and 1.00 for each field based on legibility and recognition certainty.
- If date or time is visible anywhere on the screenshot (e.g. in status bar or dashboard date picker), populate extracted_date (YYYY-MM-DD) and extracted_time (HH:mm), otherwise return null.

You MUST return a JSON object strictly matching this schema:
{
  "platform": "shopee",
  "order_status": string or null,
  "sales": number or null,
  "active_viewers": number or null,
  "comments": number or null,
  "add_to_cart": number or null,
  "views": number or null,
  "average_watch_duration": number or null,
  "comment_rate": number or null,
  "sales_per_1000_views": number or null,
  "orders": number or null,
  "sales_per_order": number or null,
  "viewers": number or null,
  "peak_viewers": number or null,
  "click_rate": number or null,
  "orders_per_click": number or null,
  "buyers": number or null,
  "products_sold": number or null,
  "extracted_date": string or null,
  "extracted_time": string or null,
  "confidence": {
    "sales": number between 0 and 1,
    "active_viewers": number between 0 and 1,
    "comments": number between 0 and 1,
    "add_to_cart": number between 0 and 1,
    "views": number between 0 and 1,
    "average_watch_duration": number between 0 and 1,
    "comment_rate": number between 0 and 1,
    "sales_per_1000_views": number between 0 and 1,
    "orders": number between 0 and 1,
    "sales_per_order": number between 0 and 1,
    "viewers": number between 0 and 1,
    "peak_viewers": number between 0 and 1,
    "click_rate": number between 0 and 1,
    "orders_per_click": number between 0 and 1,
    "buyers": number between 0 and 1,
    "products_sold": number between 0 and 1
  }
}`;

      const ai = getAi();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = response.text || '{}';
      const parsedData = JSON.parse(responseText);

      // Return strict structured JSON
      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (err: any) {
      console.error('Error in /api/extract-shopee-screenshot:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Gagal mengekstrak data dari screenshot Shopee.',
      });
    }
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
