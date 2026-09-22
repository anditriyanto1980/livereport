import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

// Safe directory path for both ESM (dev) and CommonJS (bundled production)
const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

// In-memory multer storage: ZERO disk storage, zero permanent image holding
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB limit
});

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

// List of vision-capable models in priority order
const CANDIDATE_VISION_MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
];

/**
 * Robust parser for Indonesian and English numeric strings:
 * - Suffix multipliers: 'jt' / 'juta' (x1,000,000), 'rb' / 'ribu' / 'k' (x1,000), 'miliar' / 'b' (x1,000,000,000)
 * - Dots as thousand separators (e.g. 626.084 -> 626084, 1.500.000 -> 1500000)
 * - Commas as decimal separators (e.g. 6,7% -> 6.7, 12,5 jt -> 12500000)
 * - Currency prefixes (Rp, IDR, $) and measurement units (pcs, %, etc.)
 */
function parseIndonesianNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'string') {
    let s = val.trim();
    if (!s || s === '-' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'null') return null;

    // Detect multiplier suffixes before cleaning characters
    let multiplier = 1;
    if (/\b(?:miliar|b)\b/i.test(s)) {
      multiplier = 1000000000;
      s = s.replace(/\b(?:miliar|b)\b/gi, '');
    } else if (/\b(?:jt|juta)\b/i.test(s) || /jt|juta/i.test(s) || (s.toLowerCase().endsWith('m') && !s.toLowerCase().endsWith('rpm'))) {
      multiplier = 1000000;
      s = s.replace(/\b(?:jt|juta)\b/gi, '').replace(/jt|juta/gi, '').replace(/m$/i, '');
    } else if (/\b(?:rb|ribu|k)\b/i.test(s) || /rb|ribu/i.test(s) || s.toLowerCase().endsWith('k')) {
      multiplier = 1000;
      s = s.replace(/\b(?:rb|ribu|k)\b/gi, '').replace(/rb|ribu/gi, '').replace(/k$/i, '');
    }

    // Clean currency prefixes, percentages, units and spaces
    let clean = s.replace(/Rp\.?|IDR|\$|\s|%|pcs|unit|penonton|orang|pesanan|kali/gi, '').trim();

    // If both dot and comma exist e.g. 1.250.000,50
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      // Indonesian decimal separator e.g. "6,7" -> "6.7"
      clean = clean.replace(',', '.');
    } else if (clean.includes('.')) {
      // Distinguish thousand separator (e.g. 626.084 or 3.948) vs English decimal (e.g. 12.5)
      const parts = clean.split('.');
      if (parts.length > 1 && parts.every((p, idx) => idx === 0 || p.length === 3)) {
        clean = clean.replace(/\./g, '');
      }
    }

    const num = parseFloat(clean);
    if (isNaN(num)) return null;
    return num * multiplier;
  }
  return null;
}

/**
 * Robust duration parser:
 * - Colon formats: "01:15:30" (4530s), "00:00:20" (20s), "02:45" (165s)
 * - Indonesian natural text: "1 jam 20 menit 30 detik", "45 menit", "20 detik"
 * - English text: "1h 20m 30s", "5 mins", "45 secs"
 */
function parseDurationSeconds(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : Math.round(val);
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s || s === '-' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'null') return null;

    // Colon format (HH:MM:SS or MM:SS)
    if (s.includes(':')) {
      const parts = s.split(':').map((p) => parseInt(p.trim(), 10) || 0);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
    }

    // Textual duration formats
    let totalSeconds = 0;
    let matched = false;

    const hoursMatch = s.match(/(\d+)\s*(?:jam|j|h|hours?)/i);
    if (hoursMatch) {
      totalSeconds += parseInt(hoursMatch[1], 10) * 3600;
      matched = true;
    }

    const minsMatch = s.match(/(\d+)\s*(?:menit|mnt|m|mins?)/i);
    if (minsMatch) {
      totalSeconds += parseInt(minsMatch[1], 10) * 60;
      matched = true;
    }

    const secsMatch = s.match(/(\d+)\s*(?:detik|dtk|d|s|secs?)/i);
    if (secsMatch) {
      totalSeconds += parseInt(secsMatch[1], 10);
      matched = true;
    }

    if (matched) return totalSeconds;

    // Plain numeric string fallback
    const plainNum = parseInt(s.replace(/\D/g, ''), 10);
    return isNaN(plainNum) ? null : plainNum;
  }
  return null;
}

async function startServer() {
  const app = express();
  // Port 3000 is strictly mandated by AI Studio container infrastructure
  const PORT = 3000;

  // Global CORS headers for cross-origin, iframes, multi-PC and preview environments
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Support up to 30MB body for high-resolution screenshot transmission (held purely in RAM)
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // Graceful handling of body-parser errors (e.g., payload too large or invalid JSON)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      console.error('[API Error] Request body parse failed:', err.message);
      return res.status(err.status || 400).json({
        success: false,
        error: err.type === 'entity.too.large' 
          ? 'Ukuran gambar screenshot terlalu besar (maksimal 30MB). Silakan gunakan gambar yang lebih kecil.' 
          : 'Format request data screenshot tidak valid.',
        details: err.message,
      });
    }
    next();
  });

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
    const extractId = `ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Prevent any browser, reverse-proxy, or client caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
      let cleanBase64 = '';
      let mimeType = 'image/jpeg';

      // 1. Check if uploaded via multipart/form-data (multer)
      const anyReq = req as any;
      if (anyReq.file && anyReq.file.buffer) {
        cleanBase64 = anyReq.file.buffer.toString('base64');
        mimeType = anyReq.file.mimetype || 'image/jpeg';
      } else if (anyReq.files && Array.isArray(anyReq.files) && anyReq.files.length > 0 && anyReq.files[0].buffer) {
        cleanBase64 = anyReq.files[0].buffer.toString('base64');
        mimeType = anyReq.files[0].mimetype || 'image/jpeg';
      } else {
        // 2. Check JSON / URL-encoded body
        let rawImage =
          req.body?.imageBase64 ||
          req.body?.image ||
          req.body?.file ||
          req.body?.screenshot ||
          req.body?.image_base64 ||
          req.body?.data;

        if (typeof rawImage === 'object' && rawImage !== null) {
          mimeType = rawImage.type || rawImage.mimeType || mimeType;
          rawImage = rawImage.data || rawImage.base64 || rawImage.content;
        }

        if (typeof rawImage === 'string' && rawImage.trim()) {
          const match = rawImage.match(/^data:([^;]+);base64,/);
          if (match) {
            mimeType = match[1];
          }
          cleanBase64 = rawImage.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
        }

        if (req.body?.mimeType) {
          mimeType = req.body.mimeType;
        }
      }

      if (!cleanBase64) {
        return res.status(400).json({
          success: false,
          extractId,
          error: 'Format screenshot atau data upload tidak valid (HTTP 400).',
          details: 'Gambar tidak ditemukan dalam request (dukungan: base64 JSON atau multipart file upload).',
        });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          success: false,
          extractId,
          error: 'Autentikasi OCR gagal: Kunci API Gemini (GEMINI_API_KEY) belum dikonfigurasi.',
        });
      }

      console.log(`[OCR ${extractId}] Received image payload (${cleanBase64.length} base64 chars, type: ${mimeType})`);

      const prompt = `You are a high-precision AI vision OCR system specialized in extracting metrics from e-commerce analytics dashboards, specifically Shopee Live / Shopee Seller Centre ("Wawasan Livestream" or mobile "Rincian Live").

CRITICAL INSTRUCTIONS ON ZERO-HALLUCINATION & DYNAMIC EXTRACTION:
1. Examine the ACTUAL VISIBLE pixels of THIS SPECIFIC image. Read the REAL numbers present on the screenshot.
2. DO NOT output repetitive, cached, or default placeholder numbers under ANY circumstances.
3. If a metric or card is NOT visible, cropped out, covered, or absent in this screenshot, you MUST set its value to null and confidence to 0.0. DO NOT guess or infer numbers that are not visually printed.

LAYOUT & FIELD MAPPING (Handles Desktop Grid, Mobile App Cards, Dark & Light Mode, Indonesian & English):
Shopee layouts vary. Match the text labels on the image to the following target fields:

- sales: Primary Gross Merchandise Value / revenue.
  Look for: "Penjualan (Rp)", "Total Penjualan", "Estimasi Penjualan", "Pendapatan", "Sales (Rp)", "GMV".
- active_viewers: Active or concurrent viewers during stream.
  Look for: "Penonton Aktif", "Penonton Saat Ini", "Penonton Bersamaan", "Active Viewers", "Concurrent Viewers".
- comments: Number of comments/chat messages sent.
  Look for: "Komentar", "Jumlah Komentar", "Total Komentar", "Comments".
- add_to_cart: Items or actions added to cart/basket.
  Look for: "Tambah ke Keranjang", "Dimasukkan ke Keranjang", "Keranjang", "Add to Cart", "ATC".
- views: Total impressions or live stream views.
  Look for: "Dilihat", "Total Dilihat", "Tayangan", "Impresi", "Views", "Impressions".
- average_watch_duration: Average duration viewers spent watching. Can be "HH:MM:SS", "MM:SS", or text like "X mnt Y dtk" or seconds.
  Look for: "Durasi Rata-Rata Menonton", "Rata-rata Durasi Tonton", "Durasi Tontonan", "Average Watch Duration", "Avg Watch Time".
- comment_rate: Percentage of viewers who commented.
  Look for: "Persentase Komentar", "Tingkat Komentar", "Comment Rate", "Rasio Komentar".
- sales_per_1000_views: Sales generated per 1,000 views (RPM).
  Look for: "Penjualan per mil (Rp)", "Penjualan per 1.000 Tayangan", "RPM", "Sales per 1000 Views".
- orders: Total orders placed.
  Look for: "Pesanan", "Total Pesanan", "Jumlah Pesanan", "Orders".
- sales_per_order: Average order value / basket size (AOV).
  Look for: "Nilai Penjualan per Pesanan", "Rata-rata Nilai Pesanan", "AOV", "Sales per Order".
- viewers: Total unique viewers or cumulative audience.
  Look for: "Penonton", "Total Penonton", "Penonton Unik", "Viewers", "Unique Viewers".
- peak_viewers: Peak concurrent viewers.
  Look for: "Penonton Tertinggi", "Puncak Penonton", "Penonton Maksimum", "Peak Viewers", "Max Viewers".
- click_rate: Product / showcase click-through rate percentage (CTR).
  Look for: "Persentase Klik", "Tingkat Klik", "CTR", "Click Rate".
- orders_per_click: Conversion rate percentage from product click to purchase.
  Look for: "Pesanan per Klik", "Konversi Klik ke Pesanan", "Orders per Click".
- buyers: Unique paying buyers/customers.
  Look for: "Pembeli", "Total Pembeli", "Jumlah Pembeli", "Buyers".
- products_sold: Total units or products sold.
  Look for: "Produk Terjual", "Barang Terjual", "Unit Terjual", "Products Sold", "Qty Terjual".

ADDITIONAL METADATA:
- order_status: Look for an active order filter dropdown/text (e.g. "Pesanan Siap Dikirim", "Semua", "Pesanan Dikonfirmasi", "Pesanan Selesai"). If not found, output "Pesanan Siap Dikirim".
- extracted_date: Look for a visible date on the header, filter, or phone status bar (e.g., "21 Sep 2026", "21/09/2026", "2026-09-21"). Format as "YYYY-MM-DD" if clearly found, otherwise null.
- extracted_time: Look for a visible time on the stream banner, filter, or phone status bar (e.g., "08:27", "14:30"). Format as "HH:mm" if clearly found, otherwise null.

NUMBER & FORMAT CONVERSIONS:
- Indonesian thousands dot: convert "626.084" -> 626084, "3.948" -> 3948.
- Indonesian decimal comma: convert "6,7%" -> 6.7, "1,0%" -> 1.0, "5,7%" -> 5.7.
- Indonesian/English multipliers: "1,5 jt" -> 1500000, "15 rb" -> 15000.
- For each metric, return a confidence score between 0.00 and 1.00 indicating visual certainty (0.0 if not on screen).

OUTPUT FORMAT:
Respond with ONLY a raw JSON object matching this exact schema:
{
  "platform": "shopee",
  "order_status": string,
  "sales": number | null,
  "active_viewers": number | null,
  "comments": number | null,
  "add_to_cart": number | null,
  "views": number | null,
  "average_watch_duration": number | string | null,
  "comment_rate": number | null,
  "sales_per_1000_views": number | null,
  "orders": number | null,
  "sales_per_order": number | null,
  "viewers": number | null,
  "peak_viewers": number | null,
  "click_rate": number | null,
  "orders_per_click": number | null,
  "buyers": number | null,
  "products_sold": number | null,
  "extracted_date": string | null,
  "extracted_time": string | null,
  "confidence": {
    "sales": number,
    "active_viewers": number,
    "comments": number,
    "add_to_cart": number,
    "views": number,
    "average_watch_duration": number,
    "comment_rate": number,
    "sales_per_1000_views": number,
    "orders": number,
    "sales_per_order": number,
    "viewers": number,
    "peak_viewers": number,
    "click_rate": number,
    "orders_per_click": number,
    "buyers": number,
    "products_sold": number
  }
}`;

      const ai = getAi();
      let lastError: any = null;
      let rawResponseText = '';
      let successfulModel = '';

      // Try candidate models in order until one succeeds
      for (const modelName of CANDIDATE_VISION_MODELS) {
        try {
          console.log(`[OCR ${extractId}] Trying vision model ${modelName}...`);
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
              temperature: 0.0,
            },
          });

          if (response && response.text) {
            rawResponseText = response.text;
            successfulModel = modelName;
            console.log(`[OCR ${extractId}] Successfully received vision response from ${modelName}`);
            break;
          }
        } catch (modelErr: any) {
          console.warn(`[OCR ${extractId}] Model ${modelName} error:`, modelErr?.message || modelErr);
          lastError = modelErr;
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

      // Normalize all numeric fields using enhanced parsers
      const normalizedData = {
        platform: 'shopee',
        order_status: parsedData.order_status || 'Pesanan Siap Dikirim',
        sales: parseIndonesianNumber(parsedData.sales),
        active_viewers: parseIndonesianNumber(parsedData.active_viewers),
        comments: parseIndonesianNumber(parsedData.comments),
        add_to_cart: parseIndonesianNumber(parsedData.add_to_cart),
        views: parseIndonesianNumber(parsedData.views),
        average_watch_duration: parseDurationSeconds(parsedData.average_watch_duration),
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
          sales: typeof parsedData.confidence?.sales === 'number' ? parsedData.confidence.sales : 0.95,
          active_viewers: typeof parsedData.confidence?.active_viewers === 'number' ? parsedData.confidence.active_viewers : 0.95,
          comments: typeof parsedData.confidence?.comments === 'number' ? parsedData.confidence.comments : 0.95,
          add_to_cart: typeof parsedData.confidence?.add_to_cart === 'number' ? parsedData.confidence.add_to_cart : 0.95,
          views: typeof parsedData.confidence?.views === 'number' ? parsedData.confidence.views : 0.95,
          average_watch_duration: typeof parsedData.confidence?.average_watch_duration === 'number' ? parsedData.confidence.average_watch_duration : 0.95,
          comment_rate: typeof parsedData.confidence?.comment_rate === 'number' ? parsedData.confidence.comment_rate : 0.95,
          sales_per_1000_views: typeof parsedData.confidence?.sales_per_1000_views === 'number' ? parsedData.confidence.sales_per_1000_views : 0.95,
          orders: typeof parsedData.confidence?.orders === 'number' ? parsedData.confidence.orders : 0.95,
          sales_per_order: typeof parsedData.confidence?.sales_per_order === 'number' ? parsedData.confidence.sales_per_order : 0.95,
          viewers: typeof parsedData.confidence?.viewers === 'number' ? parsedData.confidence.viewers : 0.95,
          peak_viewers: typeof parsedData.confidence?.peak_viewers === 'number' ? parsedData.confidence.peak_viewers : 0.95,
          click_rate: typeof parsedData.confidence?.click_rate === 'number' ? parsedData.confidence.click_rate : 0.95,
          orders_per_click: typeof parsedData.confidence?.orders_per_click === 'number' ? parsedData.confidence.orders_per_click : 0.95,
          buyers: typeof parsedData.confidence?.buyers === 'number' ? parsedData.confidence.buyers : 0.95,
          products_sold: typeof parsedData.confidence?.products_sold === 'number' ? parsedData.confidence.products_sold : 0.95,
        },
        modelUsed: successfulModel,
      };

      console.log(`[OCR ${extractId}] Extracted dynamic metrics:`, {
        sales: normalizedData.sales,
        orders: normalizedData.orders,
        viewers: normalizedData.viewers,
        products_sold: normalizedData.products_sold,
        status: normalizedData.order_status,
        date: normalizedData.extracted_date,
        time: normalizedData.extracted_time,
      });

      // Calculate overall average confidence score
      const confValues = Object.values(normalizedData.confidence).filter(
        (v) => typeof v === 'number'
      ) as number[];
      const overallConfidence =
        confValues.length > 0
          ? Number((confValues.reduce((a, b) => a + b, 0) / confValues.length).toFixed(2))
          : 0.95;

      // Return strict structured JSON matching frontend schema requirements
      return res.json({
        success: true,
        extractId,
        data: normalizedData,
        rawText: cleanJson,
        confidence: overallConfidence,
        modelUsed: successfulModel,
      });
    } catch (err: any) {
      console.error(`[OCR ${extractId}] Error in OCR processing:`, err);
      const isQuota =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('quota');
      const statusCode = isQuota ? 429 : 500;
      const errorMsg = isQuota
        ? 'Layanan OCR sedang mencapai batas penggunaan. Silakan coba beberapa saat lagi (HTTP 429).'
        : err.message || 'Terjadi kesalahan pada server OCR saat mengekstrak data dari screenshot.';

      return res.status(statusCode).json({
        success: false,
        extractId,
        error: errorMsg,
      });
    }
  };

  // Comprehensive OCR route list covering canonical endpoints and all aliases
  const OCR_ROUTES = [
    '/api/ocr',
    '/api/ocr/process',
    '/api/ocr/analyze',
    '/api/scan',
    '/api/extract',
    '/api/extract-shopee-screenshot',
    '/api/extract-livestream-screenshot',
    '/api/shopee-ocr',
    '/extract-shopee-screenshot',
  ];

  // Register GET probe endpoints and POST execution routes with multer support
  OCR_ROUTES.forEach((route) => {
    // GET probe endpoint
    app.get([route, `${route}/`], (req, res) => {
      res.json({
        status: 'ready',
        endpoint: route,
        method: 'POST',
        description: 'Shopee Livestream OCR & KPI Extraction API',
        supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      });
    });

    // POST execution route (accepts both JSON base64 and multipart/form-data)
    app.post([route, `${route}/`], upload.any(), handleScreenshotExtraction);
  });

  // Catch-all for unhandled /api/* routes (ALWAYS return JSON 404, never fallback to HTML)
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `Endpoint OCR tidak ditemukan. Periksa konfigurasi server OCR (HTTP 404 pada ${req.method} ${req.path}).`,
      availableEndpoints: [
        'POST /api/ocr',
        'POST /api/extract-shopee-screenshot',
        'POST /api/scan',
        'GET /api/ocr',
        'GET /api/health',
      ],
    });
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
