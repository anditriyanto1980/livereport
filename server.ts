import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Safe directory path for both ESM (dev) and CommonJS (bundled production)
const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

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

// List of vision-capable models in priority fallback order
const CANDIDATE_VISION_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

function parseIndonesianNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'string') {
    // If HH:MM:SS format (e.g. 00:00:20 or 01:15:00)
    if (val.includes(':')) {
      const parts = val.split(':').map((p) => parseInt(p.trim(), 10) || 0);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
    }

    // Clean strings like "Rp 626.084" or "6,7%" or "1.500 pcs"
    let clean = val.replace(/Rp|\s|%|pcs|menit|detik/gi, '').trim();

    // If both dot and comma exist e.g. 1.250.000,50
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      // Indonesian decimal separator e.g. "6,7" -> "6.7"
      clean = clean.replace(',', '.');
    } else if (clean.includes('.')) {
      // Could be thousand separator e.g. 626.084 or 3.948 or 158.583
      const parts = clean.split('.');
      if (parts.length > 1 && parts.every((p, idx) => idx === 0 || p.length === 3)) {
        clean = clean.replace(/\./g, '');
      }
    }

    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
  }
  return null;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Enable CORS for all origins (supporting multi-PC, shared app, iframes, and preview environments)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Support up to 25MB body for screenshot transmission (held purely in RAM)
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Health check API
  app.get(['/api/health', '/api/health/'], (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      time: new Date().toISOString(),
      port: PORT,
      env: process.env.NODE_ENV || 'development',
    });
  });

  // POST /api/extract-shopee-screenshot (and aliases)
  // Extracts all 16 KPIs from Shopee Livestream Insight screenshot using Gemini Flash Vision
  // ZERO disk storage, ZERO permanent image holding. Buffer is discarded immediately.
  const handleScreenshotExtraction = async (req: express.Request, res: express.Response) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg' } = req.body;

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({
          success: false,
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
- Read the EXACT numbers present on THIS specific uploaded screenshot image. Do NOT invent, hallucinate, or copy numbers from any other image.
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
      let lastError: any = null;
      let rawResponseText = '';
      let successfulModel = '';

      // Try candidate models in order until one succeeds
      for (const modelName of CANDIDATE_VISION_MODELS) {
        try {
          console.log(`[OCR] Trying model ${modelName}...`);
          const response = await ai.models.generateContent({
            model: modelName,
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

          if (response && response.text) {
            rawResponseText = response.text;
            successfulModel = modelName;
            console.log(`[OCR] Successfully processed with model ${modelName}`);
            break;
          }
        } catch (modelErr: any) {
          console.warn(`[OCR] Model ${modelName} failed:`, modelErr?.message || modelErr);
          lastError = modelErr;
          // Continue to next model in list
        }
      }

      if (!rawResponseText) {
        throw new Error(
          lastError?.message ||
            'Semua model AI Vision sedang mengalami lonjakan beban. Harap coba lagi atau gunakan input manual.'
        );
      }

      // Safe JSON parsing handling any markdown codeblocks or trailing characters
      let cleanJson = rawResponseText.trim();
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanJson = jsonMatch[0];
      }

      const parsedData = JSON.parse(cleanJson);

      // Normalize all numeric fields using parseIndonesianNumber
      const normalizedData = {
        platform: 'shopee',
        order_status: parsedData.order_status || 'Pesanan Siap Dikirim',
        sales: parseIndonesianNumber(parsedData.sales),
        active_viewers: parseIndonesianNumber(parsedData.active_viewers),
        comments: parseIndonesianNumber(parsedData.comments),
        add_to_cart: parseIndonesianNumber(parsedData.add_to_cart),
        views: parseIndonesianNumber(parsedData.views),
        average_watch_duration: parseIndonesianNumber(parsedData.average_watch_duration),
        comment_rate: parseIndonesianNumber(parsedData.comment_rate),
        sales_per_1000_views: parseIndonesianNumber(parsedData.sales_per_1000_views),
        orders: parseIndonesianNumber(parsedData.orders),
        sales_per_order: parseIndonesianNumber(parsedData.sales_per_order),
        viewers: parseIndonesianNumber(parsedData.viewers),
        peak_viewers: parseIndonesianNumber(parsedData.peak_viewers),
        click_rate: parseIndonesianNumber(parsedData.click_rate),
        orders_per_click: parseIndonesianNumber(parsedData.orders_per_click),
        buyers: parseIndonesianNumber(parsedData.buyers),
        products_sold: parseIndonesianNumber(parsedData.products_sold),
        extracted_date: parsedData.extracted_date || null,
        extracted_time: parsedData.extracted_time || null,
        confidence: {
          sales: parsedData.confidence?.sales ?? 0.95,
          active_viewers: parsedData.confidence?.active_viewers ?? 0.95,
          comments: parsedData.confidence?.comments ?? 0.95,
          add_to_cart: parsedData.confidence?.add_to_cart ?? 0.95,
          views: parsedData.confidence?.views ?? 0.95,
          average_watch_duration: parsedData.confidence?.average_watch_duration ?? 0.95,
          comment_rate: parsedData.confidence?.comment_rate ?? 0.95,
          sales_per_1000_views: parsedData.confidence?.sales_per_1000_views ?? 0.95,
          orders: parsedData.confidence?.orders ?? 0.95,
          sales_per_order: parsedData.confidence?.sales_per_order ?? 0.95,
          viewers: parsedData.confidence?.viewers ?? 0.95,
          peak_viewers: parsedData.confidence?.peak_viewers ?? 0.95,
          click_rate: parsedData.confidence?.click_rate ?? 0.95,
          orders_per_click: parsedData.confidence?.orders_per_click ?? 0.95,
          buyers: parsedData.confidence?.buyers ?? 0.95,
          products_sold: parsedData.confidence?.products_sold ?? 0.95,
        },
        modelUsed: successfulModel,
      };

      // Return strict structured JSON
      return res.json({
        success: true,
        data: normalizedData,
        modelUsed: successfulModel,
      });
    } catch (err: any) {
      console.error('Error in /api/extract-shopee-screenshot:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Gagal mengekstrak data dari screenshot Shopee.',
      });
    }
  };

  // Mount screenshot extraction routes
  app.post('/api/extract-shopee-screenshot', handleScreenshotExtraction);
  app.post('/api/extract-shopee-screenshot/', handleScreenshotExtraction);
  app.post('/api/extract-livestream-screenshot', handleScreenshotExtraction);

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

    // For any unhandled API calls, return JSON 404
    app.all('/api/*', (req, res) => {
      res.status(404).json({
        success: false,
        error: `Endpoint API ${req.method} ${req.path} tidak ditemukan pada server.`,
      });
    });

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
