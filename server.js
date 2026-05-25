import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import multer from 'multer';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const require = createRequire(import.meta.url);
const db = require('./database.cjs');

let minioClient, uploadToMinIO, deleteFromMinIO;
try {
  const minioModule = await import('./minio-config.js');
  minioClient = minioModule.minioClient;
  uploadToMinIO = minioModule.uploadToMinIO;
  deleteFromMinIO = minioModule.deleteFromMinIO;
  minioModule.ensureBucket();
  console.log('[MinIO] Client initialized');
} catch (error) {
  console.warn('[MinIO] Failed to initialize, using local storage:', error.message);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 数据文件路径
const DATA_DIR = join(__dirname, 'data');

// 确保数据目录存在
try { mkdirSync(DATA_DIR, { recursive: true }); } catch {}

const app = express();
const PORT = process.env.PORT || 3006;

// 中间件
app.use(cors());
// 设置 body size limit 为 10MB，支持图片 base64
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== JWT 认证中间件 ==========

const JWT_SECRET = process.env.JWT_SECRET || 'jinyu_material_prod_secret_2026';
const TOKEN_EXPIRY = '24h';

function authMiddleware(req, res, next) {
  // 公开路由跳过认证
  if (req.method === 'GET') return next();
  if (req.path === '/api/contact' && req.method === 'POST') return next(); // 用户联系表单
  if (req.path === '/api/auth/login') return next();
  if (req.path === '/api/auth/register') return next(); // 注册（首次创建管理员账号）
  
  // 检查 JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未登录' });
  }
  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
  }
}

// 登录频率限制（简单内存版，防暴力破解）
const loginAttempts = new Map();
function checkLoginRate(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, firstAt: now };
  if (now - record.firstAt > 15 * 60 * 1000) {
    record.count = 0;
    record.firstAt = now;
  }
  if (record.count >= 10) {
    return res.status(429).json({ success: false, error: '登录过于频繁，请15分钟后再试' });
  }
  record.count++;
  loginAttempts.set(ip, record);
  next();
}

// 全局应用认证中间件（白名单模式：GET + 联系表单 + 登录/注册 公开）
app.use(authMiddleware);

// ========== Homepage API（首页综合数据） ==========
app.get('/api/homepage', (req, res) => {
  try {
    // 1. 产品列表（前 8 个上架产品）
    const products = readDataFile('products.json', []);
    const activeProducts = products.filter(p => p.status !== 'inactive').slice(0, 8);

    // 2. FAQ 列表（从数据库读取）
    const lang = req.query.lang || 'en';
    const faqRows = db.prepare('SELECT * FROM faqs ORDER BY sort_order, id LIMIT 6').all();
    
    const langMap = { en: 'en', zh: 'zh', vi: 'vi', tl: 'tl' };
    const targetLang = langMap[lang] || 'en';
    
    const faqs = faqRows.map(f => ({
      question: f[`question_${targetLang}`] || f.question_en,
      answer: f[`answer_${targetLang}`] || f.answer_en,
    }));

    // 3. 站点配置
    const settings = readDataFile('settings.json', {});

    // 4. 社交链接
    const socialLinks = readDataFile('social-links.json', []);

    res.json({
      success: true,
      data: {
        products: activeProducts,
        faqs,
        settings,
        socialLinks
      }
    });
  } catch (err) {
    console.error('[GET /api/homepage] error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== FAQ API (Database-driven) ==========

// GET /api/faqs - 获取所有FAQ（支持语言参数）
app.get('/api/faqs', (req, res) => {
  try {
    
    if (!db) {
      console.error('[GET /api/faqs] FATAL: db object is null!');
      return res.status(503).json({ 
        success: false, 
        error: '数据库连接未初始化，请稍后重试' 
      });
    }
    
    const lang = req.query.lang || 'en';
    console.log('[GET /api/faqs] Querying FAQs for lang:', lang);
    const faqs = db.prepare('SELECT * FROM faqs ORDER BY sort_order, id').all();
    console.log('[GET /api/faqs] Found', faqs.length, 'FAQs');
    
    // 根据语言返回对应字段
    const langMap = { en: 'en', zh: 'zh', vi: 'vi', tl: 'tl' };
    const targetLang = langMap[lang] || 'en';
    
    const formatted = faqs.map(f => ({
      id: f.id,
      question: f[`question_${targetLang}`] || f.question_en,
      answer: f[`answer_${targetLang}`] || f.answer_en,
      question_en: f.question_en,
      question_zh: f.question_zh,
      question_vi: f.question_vi,
      question_tl: f.question_tl,
      answer_en: f.answer_en,
      answer_zh: f.answer_zh,
      answer_vi: f.answer_vi,
      answer_tl: f.answer_tl,
      sort_order: f.sort_order,
      tab: f.tab || 'products',
      index: f.index_num || 0
    }));
    
    res.json({ success: true, data: formatted });
  } catch (e) {
    console.error('[GET /api/faqs] ERROR:', e.message, '\nStack:', e.stack);
    res.status(500).json({ success: false, error: '获取FAQ失败: ' + e.message });
  }
});

// POST /api/faqs - 新增FAQ（自动翻译）
app.post('/api/faqs', async (req, res) => {
  try {
    const cleanBody = { ...req.body };
    Object.keys(cleanBody).forEach(key => {
      if (/_zh$|_vi$|_tl$/.test(key)) {
        delete cleanBody[key];
      }
    });
    
    const translated = await autoTranslateFAQ(cleanBody, true);
    
    const stmt = db.prepare(`
      INSERT INTO faqs (question_en, question_zh, question_vi, question_tl, 
                        answer_en, answer_zh, answer_vi, answer_tl, 
                        sort_order, tab, index_num)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      translated.question_en || translated.question || '',
      translated.question_zh || '',
      translated.question_vi || '',
      translated.question_tl || '',
      translated.answer_en || translated.answer || '',
      translated.answer_zh || '',
      translated.answer_vi || '',
      translated.answer_tl || '',
      translated.sort_order || 0,
      translated.tab || 'products',
      translated.index || 0
    );
    
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/faqs/:id - 更新FAQ（自动翻译）
app.put('/api/faqs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cleanBody = { ...req.body };
    Object.keys(cleanBody).forEach(key => {
      if (/_zh$|_vi$|_tl$/.test(key)) {
        delete cleanBody[key];
      }
    });
    
    const translated = await autoTranslateFAQ(cleanBody, true);
    
    const stmt = db.prepare(`
      UPDATE faqs 
      SET question_en = ?, question_zh = ?, question_vi = ?, question_tl = ?,
          answer_en = ?, answer_zh = ?, answer_vi = ?, answer_tl = ?,
          sort_order = ?, tab = ?, index_num = ?
      WHERE id = ?
    `);
    
    stmt.run(
      translated.question_en || translated.question || '',
      translated.question_zh || '',
      translated.question_vi || '',
      translated.question_tl || '',
      translated.answer_en || translated.answer || '',
      translated.answer_zh || '',
      translated.answer_vi || '',
      translated.answer_tl || '',
      translated.sort_order || 0,
      translated.tab || 'products',
      translated.index || 0,
      id
    );
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/faqs/:id - 删除FAQ
app.delete('/api/faqs/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM faqs WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ⚠️ 静态文件托管已移至所有 API 路由之后（见文件末尾）

// 图片上传目录
const UPLOADS_DIR = join(__dirname, 'about-uploads');
try { mkdirSync(UPLOADS_DIR, { recursive: true }); } catch {}

// 案例视频上传目录
const CASE_UPLOADS_DIR = join(__dirname, 'case-uploads');
try { mkdirSync(CASE_UPLOADS_DIR, { recursive: true }); } catch {}

// 产品图片目录
const PRODUCT_IMAGES_DIR = join(__dirname, 'product-images');
try { mkdirSync(PRODUCT_IMAGES_DIR, { recursive: true }); } catch {}

// Multer 配置（图片，10MB）- 使用内存存储以便压缩
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } 
});

// 保存图片到本地磁盘的辅助函数
async function saveImageToDisk(buffer, originalname) {
  const ext = originalname.split('.').pop() || 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filepath = join(UPLOADS_DIR, filename);
  
  try {
    writeFileSync(filepath, buffer);
    return filename;
  } catch (error) {
    console.error('[Upload] 保存图片到磁盘失败:', error.message);
    return null;
  }
}

// Multer 配置（视频，50MB）
const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CASE_UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
  },
});
const uploadVideo = multer({ storage: videoStorage, limits: { fileSize: 50 * 1024 * 1024 } });

// 图片压缩函数
let sharp;
try {
  sharp = require('sharp');
  console.log('[Image] Sharp 图片压缩库已加载');
} catch (e) {
  console.warn('[Image] Sharp 未安装，图片将不会被压缩');
}

async function compressImage(inputBuffer, mimetype) {
  if (!sharp) return inputBuffer;

  try {
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    // 如果图片大于 2000px 等比例缩小
    let targetWidth = metadata.width || 2000;
    if (targetWidth > 2000) {
      image.resize(2000, null, { withoutEnlargement: true });
    }

    // 根据格式设置质量
    if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
      return await image.jpeg({ quality: 85 }).toBuffer();
    } else if (mimetype === 'image/png') {
      return await image.png({ quality: 85, compressionLevel: 6 }).toBuffer();
    } else if (mimetype === 'image/webp') {
      return await image.webp({ quality: 85 }).toBuffer();
    }

    return await image.toBuffer();
  } catch (error) {
    console.error('[Image] 压缩失败:', error.message);
    return inputBuffer;
  }
}

// 辅助函数：读取数据文件
const readDataFile = (filename, defaultValue = []) => {
  const filepath = join(DATA_DIR, filename);
  try {
    if (existsSync(filepath)) {
      return JSON.parse(readFileSync(filepath, 'utf-8'));
    }
  } catch (e) {
    console.error(`Error reading ${filename}:`, e);
  }
  return defaultValue;
};

// 辅助函数：写入数据文件
const writeDataFile = (filename, data) => {
  const filepath = join(DATA_DIR, filename);
  try {
    writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error(`Error writing ${filename}:`, e);
    throw e; // 抛出异常，让调用方返回真实错误给前端
  }
};

// ============ API 路由 ============

// 获取所有产品（支持翻页）
app.get('/api/products', (req, res) => {
  const startTime = Date.now();
  let products = [];
  
  // 如果 db 不可用，直接走 JSON fallback
  if (!db) {
    console.log('[API] /api/products: db 不可用，使用 JSON 文件');
    products = readDataFile('products.json', []);
    // 前台请求只返回活跃产品
    const isFromFrontend = req.headers['x-from-frontend'] === '1';
    if (isFromFrontend) {
      products = products.filter(p => p.status !== 'inactive');
    }
    const elapsed = Date.now() - startTime;
    console.log(`[API] /api/products (JSON): ${products.length} items in ${elapsed}ms`);
    return res.json({ success: true, data: products });
  }
  
  // 翻页参数
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 500;  // 默认 500 条，避免加载全部 5000+ 产品
  const offset = (page - 1) * limit;
  
  // 通过自定义 header X-From-Frontend 区分来源
  // 前台请求（带header）：只显示活跃产品
  // 后台请求（不带header）：显示所有产品（含下架）
  const isFromFrontend = req.headers['x-from-frontend'] === '1';
  const statusFilter = req.query.status;  // 'all' = 后台请求所有产品
  
  // 优先从数据库读取
  try {
    let rows;
    
    if (isFromFrontend && statusFilter !== 'all') {
      // 前台：只查活跃产品（使用索引优化）
      rows = db.prepare('SELECT * FROM products WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all('active', limit, offset);
      const totalResult = db.prepare('SELECT COUNT(*) as total FROM products WHERE status = ?').get('active');
      res.set('X-Total-Count', totalResult.total);
    } else {
      // 后台：查所有产品（含下架），支持翻页（使用索引优化）
      rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
      const totalResult = db.prepare('SELECT COUNT(*) as total FROM products').get();
      res.set('X-Total-Count', totalResult.total);
    }
    
    // 解析 JSON 字段（优化：使用更快的解析）
    products = rows.map(p => ({
      ...p,
      specs: JSON.parse(p.specs || '[]'),
      features: JSON.parse(p.features_en || '[]'),
      images: JSON.parse(p.images || '[]')
    }));
    
    const elapsed = Date.now() - startTime;
    console.log(`[API] /api/products (DB): ${products.length} items in ${elapsed}ms`);
  } catch (dbErr) {
    console.error('[DB] 读取产品失败，fallback 到 JSON：', dbErr.message);
    // 失败时 fallback 到 JSON 文件（无翻页）
    products = readDataFile('products.json', []);
    const elapsed = Date.now() - startTime;
    console.log(`[API] /api/products (JSON fallback): ${products.length} items in ${elapsed}ms`);
  }
  
  // 如果是前台请求，只返回活跃产品（JSON fallback 时也需要过滤）
  if (isFromFrontend) {
    products = products.filter(p => p.status !== 'inactive');
  }
  
  const lang = req.query.lang || 'en';
  // 返回 {success, data} 格式，与其他API保持一致
  res.json({ success: true, data: products });
});

// 按 slug 查找产品（必须在 /:id 之前注册）
app.get('/api/products/by-slug/:slug', (req, res) => {
  const startTime = Date.now();
  let product = null;
  const slug = req.params.slug;
  // 将 slug 转换为可搜索的名称格式（去掉连字符和空格）
  const normalizedSlug = (slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // 优先从数据库查找（使用索引优化查询）
  try {
    // 直接使用 name_en 字段查找（没有 slug 字段）
    const row = db.prepare('SELECT * FROM products WHERE status = ? AND LOWER(REPLACE(name_en, " ", "")) = ? LIMIT 1').get('active', normalizedSlug);
    
    if (row) {
      product = {
        ...row,
        specs: JSON.parse(row.specs || '[]'),
        features: JSON.parse(row.features_en || '[]'),
        images: JSON.parse(row.images || '[]')
      };
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`[API] /api/products/by-slug (DB): ${product ? 'found' : 'not found'} in ${elapsed}ms`);
  } catch (dbErr) {
    console.error('[DB] 按 slug 查找失败，fallback 到 JSON：', dbErr.message);
  }
  
  // 数据库没找到，fallback 到 JSON
  if (!product) {
    const products = readDataFile('products.json', []);
    const targetSlug = normalizedSlug;
    product = products.find(p =>
      p.status !== 'inactive' &&
      (p.name_en && (p.name_en || '').toLowerCase().replace(/[^a-z0-9]/g, '') === targetSlug)
    );
  }
  
  if (product) {
    res.json({ success: true, data: product });
  } else {
    res.status(404).json({ success: false, error: 'Product not found' });
  }
});

// 获取单个产品
app.get('/api/products/:id', (req, res) => {
  let product = null;
  const productId = req.params.id;
  
  // 优先从数据库读取
  try {
    const row = db.prepare('SELECT * FROM products WHERE id = ? AND status = ?').get(productId, 'active');
    if (row) {
      product = {
        ...row,
        specs: JSON.parse(row.specs || '[]'),
        features: JSON.parse(row.features_en || '[]'),
        images: JSON.parse(row.images || '[]')
      };
    }
  } catch (dbErr) {
    console.error('[DB] 获取产品失败，fallback 到 JSON：', dbErr.message);
  }
  
  // 数据库没找到，fallback 到 JSON
  if (!product) {
    const products = readDataFile('products.json', []);
    product = products.find(p => String(p.id) === String(productId) && p.status !== 'inactive');
  }
  
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

// 创建产品（自动翻译）
app.post('/api/products', async (req, res) => {
  try {
    const cleanBody = { ...req.body };
    Object.keys(cleanBody).forEach(key => {
      if (/_zh$|_vi$|_tl$|_ph$/.test(key) && !Array.isArray(cleanBody[key])) {
        delete cleanBody[key];
      }
    });
    
    const translated = await autoTranslateProductFields(cleanBody, true);
    const newId = Date.now();
    
    const newProduct = {
      ...req.body,
      ...translated,
      id: newId,
      name_en: translated.name_en || translated.Name_en || req.body.name_en || req.body.name || '',
      description_en: translated.description_en || req.body.description_en || req.body.description || '',
    };
    
    try {
      const stmt = db.prepare(`
        INSERT INTO products (
          id, name_en, name_zh, name_vi, name_tl,
          category_id, description_en, description_zh, description_vi, description_tl,
          specs,
          features_en, features_zh, features_vi, features_tl,
          images, status
        ) VALUES (
          @id, @name_en, @name_zh, @name_vi, @name_tl,
          @category_id, @description_en, @description_zh, @description_vi, @description_tl,
          @specs,
          @features_en, @features_zh, @features_vi, @features_tl,
          @images, @status
        )
      `);
      
      const params = {
        id: String(newId),
        name_en: String(newProduct.name_en || ''),
        name_zh: String(newProduct.name_zh || ''),
        name_vi: String(newProduct.name_vi || ''),
        name_tl: String(newProduct.name_tl || ''),
        category_id: String(req.body.category_id || req.body.category || ''),
        description_en: String(newProduct.description_en || ''),
        description_zh: String(newProduct.description_zh || ''),
        description_vi: String(newProduct.description_vi || ''),
        description_tl: String(newProduct.description_tl || ''),
        specs: JSON.stringify(req.body.specs || []),
        features_en: JSON.stringify(req.body.features_en || req.body.features || []),
        features_zh: JSON.stringify(newProduct.features_zh || []),
        features_vi: JSON.stringify(newProduct.features_vi || []),
        features_tl: JSON.stringify(newProduct.features_tl || []),
        images: JSON.stringify(req.body.images || []),
        status: String(req.body.status || 'active')
      };
      
      stmt.run(params);
    } catch (dbErr) {
      console.error('[DB] 创建产品失败：', dbErr.message);
    }
    
    const products = readDataFile('products.json', []);
    products.push(newProduct);
    writeDataFile('products.json', products);
    
    res.json(newProduct);
  } catch (err) {
    console.error('[POST /api/products] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 更新产品（自动翻译）
app.put('/api/products/:id', async (req, res) => {
  const productId = String(req.params.id);
  
  const cleanBody = { ...req.body };
  Object.keys(cleanBody).forEach(key => {
    if (/_zh$|_vi$|_tl$|_ph$/.test(key) && !Array.isArray(cleanBody[key])) {
      delete cleanBody[key];
    }
  });
  
  const translated = await autoTranslateProductFields(cleanBody, true);
  
  const updatedProduct = {
    ...req.body,
    ...translated,
    name_en: translated.name_en || translated.Name_en || req.body.name_en || req.body.name || '',
    description_en: translated.description_en || req.body.description_en || req.body.description || '',
  };
  
  try {
    const stmt = db.prepare(`
      UPDATE products SET
        name_en = @name_en,
        name_zh = @name_zh,
        name_vi = @name_vi,
        name_tl = @name_tl,
        category_id = @category_id,
        description_en = @description_en,
        description_zh = @description_zh,
        description_vi = @description_vi,
        description_tl = @description_tl,
        specs = @specs,
        features_en = @features_en,
        features_zh = @features_zh,
        features_vi = @features_vi,
        features_tl = @features_tl,
        images = @images,
        status = @status
      WHERE id = @id
    `);
    
    const result = stmt.run({
      id: productId,
      name_en: String(updatedProduct.name_en || ''),
      name_zh: String(updatedProduct.name_zh || ''),
      name_vi: String(updatedProduct.name_vi || ''),
      name_tl: String(updatedProduct.name_tl || ''),
      category_id: String(req.body.category_id || req.body.category || ''),
      description_en: String(updatedProduct.description_en || ''),
      description_zh: String(updatedProduct.description_zh || ''),
      description_vi: String(updatedProduct.description_vi || ''),
      description_tl: String(updatedProduct.description_tl || ''),
      specs: JSON.stringify(req.body.specs || []),
      features_en: JSON.stringify(req.body.features_en || req.body.features || []),
      features_zh: JSON.stringify(updatedProduct.features_zh || []),
      features_vi: JSON.stringify(updatedProduct.features_vi || []),
      features_tl: JSON.stringify(updatedProduct.features_tl || []),
      images: JSON.stringify(req.body.images || []),
      status: String(req.body.status || 'active')
    });
    
    if (result.changes > 0) {
      const products = readDataFile('products.json', []);
      const index = products.findIndex(p => String(p.id) === productId);
      if (index !== -1) {
        products[index] = { ...products[index], ...updatedProduct };
        writeDataFile('products.json', products);
      }
      return res.json({ success: true, data: updatedProduct });
    }
  } catch (dbErr) {
    console.error('[DB] 更新产品失败：', dbErr.message);
  }
  
  try {
    const products = readDataFile('products.json', []);
    const index = products.findIndex(p => String(p.id) === productId);
    
    if (index !== -1) {
      products[index] = { ...products[index], ...updatedProduct };
      writeDataFile('products.json', products);
      res.json(products[index]);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (err) {
    console.error('[PUT /api/products/:id] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 删除产品（优先数据库，fallback到JSON）
app.delete('/api/products/:id', (req, res) => {
  const productId = String(req.params.id);
  let deleted = false;
  
  // 优先从数据库删除
  try {
    const stmt = db.prepare('DELETE FROM products WHERE id = ?');
    const result = stmt.run(productId);
    if (result.changes > 0) {
      deleted = true;
      console.log(`[DB] 删除产品：${productId}`);
    }
  } catch (dbErr) {
    console.error('[DB] 删除产品失败，fallback 到 JSON：', dbErr.message);
  }
  
  // 同时从JSON删除（保持同步）
  try {
    let products = readDataFile('products.json', []);
    const before = products.length;
    products = products.filter(p => String(p.id) !== productId);
    if (products.length < before) {
      deleted = true;
    }
    writeDataFile('products.json', products);
  } catch (jsonErr) {
    console.error('[JSON] 删除产品失败：', jsonErr.message);
  }
  
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

// ============ 翻译接口 ============

// 获取翻译数据
app.get('/api/i18n/:lang', (req, res) => {
  const lang = req.params.lang;
  const translations = readDataFile('translations.json', {});
  res.json(translations[lang] || {});
});

// 保存翻译数据
app.post('/api/i18n', (req, res) => {
  const translations = readDataFile('translations.json', {});
  const { lang, data } = req.body;
  translations[lang] = data;
  writeDataFile('translations.json', translations);
  res.json({ success: true });
});

// 写入/更新单个或多个翻译 key（用于前端翻译缓存持久化）
// PUT /api/i18n/:lang  body: { "key1": "value1", "key2": "value2" }
app.put('/api/i18n/:lang', (req, res) => {
  const lang = req.params.lang;
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Invalid body, expected object' });
  }
  const translations = readDataFile('translations.json', {});
  if (!translations[lang]) translations[lang] = {};
  let count = 0;
  Object.entries(updates).forEach(([key, value]) => {
    if (value && typeof value === 'string' && value.trim()) {
      translations[lang][key] = value.trim();
      count++;
    }
  });
  writeDataFile('translations.json', translations);
  console.log(`[i18n] PUT ${lang}: ${count} keys saved`);
  res.json({ success: true, count });
});

// ============ 翻译代理接口（前端自动翻译用） ============

// 翻译单个文本
app.post('/api/translate', async (req, res) => {
  const { text, from, to } = req.body;
  if (!text || !from || !to) {
    return res.status(400).json({ error: 'Missing text, from, or to' });
  }
  if (from === to) {
    return res.json({ translatedText: text });
  }
  try {
    const translated = await translateText(text, from, to);
    res.json({ translatedText: translated });
  } catch (err) {
    console.error('[translate] error:', err.message);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// 批量翻译：接收 { from, to, texts: { key1: text1, key2: text2 } }
// 返回 { translations: { key1: translated1, key2: translated2 } } 并自动保存到 translations.json
app.post('/api/translate/batch', async (req, res) => {
  const { from, to, texts } = req.body;
  if (!from || !to || !texts || typeof texts !== 'object') {
    return res.status(400).json({ error: 'Missing from, to, or texts' });
  }
  if (from === to) {
    return res.json({ translations: texts });
  }

  try {
    const keys = Object.keys(texts);
    const values = Object.values(texts);
    const translations = {};

    // 微软 API 支持单次请求传多个文本，效率最高
    // 分批处理（每批最多 100 条，防止请求体过大）
    const BATCH_SIZE = 50;
    const allResults = [];

    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      const batchValues = values.slice(i, i + BATCH_SIZE);
      const batchResult = await translateBatch(batchValues, from, to);
      allResults.push(...batchResult);
    }

    for (let i = 0; i < keys.length; i++) {
      const translated = allResults[i];
      if (translated && translated.trim()) {
        translations[keys[i]] = translated.trim();
      } else {
        translations[keys[i]] = values[i]; // fallback 原文
      }
    }

    // 自动保存翻译结果到 translations.json
    const allTranslations = readDataFile('translations.json', {});
    if (!allTranslations[to]) allTranslations[to] = {};
    Object.entries(translations).forEach(([key, value]) => {
      if (value && value !== key) {
        allTranslations[to][key] = value;
      }
    });
    writeDataFile('translations.json', allTranslations);

    console.log(`[translate] batch: ${from} → ${to}, ${keys.length} keys saved`);
    // 返回有序数组（供脚本使用）+ key-value 对象（自动保存用）
    res.json({ translations, ordered: keys.map(k => translations[k]) });
  } catch (err) {
    console.error('[translate] batch error:', err.message);
    res.status(500).json({ error: 'Batch translation failed' });
  }
});

// 翻译函数：优先微软 Edge 翻译（国内可访问、免费、支持中越菲英），备选 MyMemory
// 微软 Edge Translate 无需密钥，动态获取 token
let _msToken = null;
let _msTokenExpiry = 0;

async function getMsToken() {
  if (_msToken && Date.now() < _msTokenExpiry) return _msToken;
  const res = await fetch('https://edge.microsoft.com/translate/auth', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`MS token HTTP ${res.status}`);
  const token = await res.text();
  _msToken = token.trim();
  _msTokenExpiry = Date.now() + 9 * 60 * 1000; // token 有效约10分钟，提前1分钟刷新
  return _msToken;
}

async function translateText(text, from, to) {
  // 语言代码映射：微软 API 用 zh-Hans，菲律宾语用 fil（注意：前台传 tl，需映射为 fil）
  const msLangMap = { 'en': 'en', 'zh': 'zh-Hans', 'vi': 'vi', 'tl': 'fil', 'fil': 'fil', 'ph': 'fil' };
  const myLangMap = { 'en': 'en', 'zh': 'zh-CN', 'vi': 'vi', 'tl': 'tl', 'fil': 'tl', 'ph': 'ph' };

  // ── 方法1：微软 Edge 翻译（国内可直接访问，无配额限制）──
  try {
    const token = await getMsToken();
    const msFrom = msLangMap[from] || from;
    const msTo   = msLangMap[to]   || to;

    const msUrl = `https://api-edge.cognitive.microsofttranslator.com/translate?from=${msFrom}&to=${msTo}&api-version=3.0&textType=plain`;
    console.log(`[translate] MS request: from=${msFrom} to=${msTo} text="${text.substring(0,20)}" tokenLen=${token.length}`);
    const msRes = await fetch(msUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify([{ Text: text }]),
      signal: AbortSignal.timeout(10000)
    });
    console.log(`[translate] MS response status: ${msRes.status}`);

    if (!msRes.ok) throw new Error(`MS translate HTTP ${msRes.status}`);
    const msData = await msRes.json();
    const result = msData?.[0]?.translations?.[0]?.text;
    if (result && result.trim()) {
      return result.trim();
    }
    throw new Error('MS returned empty result');
  } catch (err1) {
    console.warn('[translate] MS Edge failed:', err1.message, '- trying MyMemory fallback');

    // ── 方法2：MyMemory（备选，有每日配额限制）──
    try {
      const sl = myLangMap[from] || from;
      const tl = myLangMap[to]   || to;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sl}|${tl}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
      const data = await response.json();
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        let result = data.responseData.translatedText;
        // 质量检测：过滤 MyMemory 社区脏数据（邮箱、URL、过短匹配）
        const isGarbage = (
          result === result.toUpperCase() && result.length > 20 && text !== text.toUpperCase()
        ) || /[\w.-]+@[\w.-]+\.\w+/.test(result)  // 包含邮箱
          || /^https?:\/\//i.test(result)           // 以 URL 开头
          || (result.match && result.match < 0.5);   // 匹配度过低（MyMemory matches 数据）
        if (isGarbage) {
          console.warn('[translate] MyMemory garbage detected, falling back to original:', result.substring(0, 40));
          return text; // 返回原文，不用翻译
        }
        if (data.responseDetails?.includes('AVAILABLE FREE TRANSLATIONS')) {
          throw new Error('MYMEMORY_QUOTA');
        }
        return result;
      }
      throw new Error(`MyMemory status ${data.responseStatus}`);
    } catch (err2) {
      console.error('[translate] all methods failed:', err1.message, '|', err2.message);
      throw new Error('All translation APIs failed');
    }
  }
}

// 批量翻译多个文本（利用微软 API 原生多文本请求，效率最高）
// 返回与输入数组等长的翻译结果数组
async function translateBatch(texts, from, to) {
  // 微软 API 语言代码：菲律宾语用 fil（前台传 tl，需映射为 fil）
  const msLangMap = { 'en': 'en', 'zh': 'zh-Hans', 'vi': 'vi', 'tl': 'fil', 'fil': 'fil', 'ph': 'fil' };
  const myLangMap = { 'en': 'en', 'zh': 'zh-CN', 'vi': 'vi', 'tl': 'tl', 'fil': 'tl', 'ph': 'tl' };

  // ── 方法1：微软 Edge 翻译，一次请求多个文本 ──
  try {
    const token = await getMsToken();
    const msFrom = msLangMap[from] || from;
    const msTo   = msLangMap[to]   || to;

    const msUrl = `https://api-edge.cognitive.microsofttranslator.com/translate?from=${msFrom}&to=${msTo}&api-version=3.0&textType=plain`;
    const msRes = await fetch(msUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify(texts.map(t => ({ Text: t || '' }))),
      signal: AbortSignal.timeout(15000)
    });

    if (!msRes.ok) throw new Error(`MS batch HTTP ${msRes.status}`);
    const msData = await msRes.json();

    if (Array.isArray(msData)) {
      return msData.map((item, i) => item?.translations?.[0]?.text || texts[i] || '');
    }
    throw new Error('MS batch returned unexpected format');
  } catch (err1) {
    console.warn('[translate] MS batch failed:', err1.message, '- falling back to single translate');
    // 备选：逐条翻译（性能稍低但保证正确性）
    const results = [];
    for (const text of texts) {
      try {
        results.push(await translateText(text, from, to));
      } catch {
        results.push(text); // 失败时保留原文
      }
    }
    return results;
  }
}

// ============ 产品自动翻译辅助函数 ============
// 当只提供英文字段时，自动翻译生成其他语言版本
async function autoTranslateProductFields(product, force = false) {
  const targetLangs = ['zh', 'vi', 'tl'];
  const result = { ...product };

  const nameEn = product.name_en || product.Name_en || '';
  const descEn = product.description_en || product.description || '';

  if (nameEn) {
    for (const lang of targetLangs) {
      const langKey = lang === 'tl' ? 'tl' : lang;
      const hasExisting = !force && product[`name_${langKey}`] && product[`name_${langKey}`].trim();
      if (!hasExisting) {
        try {
          result[`name_${langKey}`] = await translateText(nameEn, 'en', lang);
        } catch (e) {
          console.warn(`[auto-translate] name failed: ${lang}`, e.message);
        }
      }
    }
  }

  if (descEn) {
    for (const lang of targetLangs) {
      const langKey = lang === 'tl' ? 'tl' : lang;
      const hasExisting = !force && product[`description_${langKey}`] && product[`description_${langKey}`].trim();
      if (!hasExisting) {
        try {
          result[`description_${langKey}`] = await translateText(descEn, 'en', lang);
        } catch (e) {
          console.warn(`[auto-translate] description failed: ${lang}`, e.message);
        }
      }
    }
  }

  const featuresEn = product.features_en || product.features || [];
  if (featuresEn && Array.isArray(featuresEn) && featuresEn.length > 0) {
    for (const lang of targetLangs) {
      const langKey = lang === 'tl' ? 'tl' : lang;
      const targetKey = `features_${langKey}`;
      const hasExisting = !force && product[targetKey] && product[targetKey].length > 0;
      if (!hasExisting) {
        try {
          result[targetKey] = await translateBatch(featuresEn, 'en', lang);
        } catch (e) {
          console.warn(`[auto-translate] features failed: ${lang}`, e.message);
        }
      }
    }
  }

  return result;
}

// ============ 通用翻译辅助函数 ============
// 将任何包含 _en 字段的对象自动翻译为 _zh / _vi / _tl
// 只翻译目标语言为空字符串的字段，避免覆盖已有内容（除非 force=true）
// 支持简单字符串字段和复杂数组字段
async function autoTranslateObject(obj, fieldConfig, force = false) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };
  const targetLangs = ['zh', 'vi', 'tl'];

  for (const [enField, fieldType] of Object.entries(fieldConfig)) {
    const enValue = obj[enField];
    if (!enValue || typeof enValue !== 'string' || enValue.trim() === '') continue;

    for (const lang of targetLangs) {
      const targetField = enField.replace('_en', `_${lang}`);
      if (!force && result[targetField] && result[targetField].trim() !== '') continue;

      try {
        if (fieldType === 'text') {
          result[targetField] = await translateText(enValue, 'en', lang);
        } else if (fieldType === 'array') {
          if (Array.isArray(enValue) && enValue.length > 0) {
            result[targetField] = await translateBatch(enValue, 'en', lang);
          }
        } else if (fieldType === 'markdown') {
          result[targetField] = await translateText(enValue, 'en', lang);
        }
      } catch (e) {
        console.warn(`[auto-translate] ${targetField} failed:`, e.message);
      }
    }
  }
  return result;
}

// ============ 各实体自动翻译函数 ============

async function autoTranslateFAQ(faq, force = false) {
  const mapped = {
    ...faq,
    question_en: faq.question_en || faq.question || '',
    answer_en: faq.answer_en || faq.answer || '',
  };
  return autoTranslateObject(mapped, {
    question_en: 'text',
    answer_en: 'markdown',
  }, force);
}

async function autoTranslateNews(news, force = false) {
  const langData = news.langData || {};
  const en = langData.en || {};
  
  const enFields = {
    title: en.title || en.title_en || '',
    content: en.content || en.content_en || '',
    slug: en.slug || en.slug_en || '',
    seo_title: en.seoTitle || en.seo_title || en.seo_title_en || '',
    alt: en.alt || en.alt_en || '',
  };
  
  const targetLangs = ['zh', 'vi', 'tl'];
  const result = { ...news };
  result.langData = { en: { ...enFields } };
  
  for (const lang of targetLangs) {
    result.langData[lang] = result.langData[lang] || {};
    const existingTitle = langData[lang]?.title || langData[lang]?.title_en || '';
    const existingContent = langData[lang]?.content || langData[lang]?.content_en || '';
    const existingSlug = langData[lang]?.slug || langData[lang]?.slug_en || '';
    const existingSeo = langData[lang]?.seoTitle || langData[lang]?.seo_title || langData[lang]?.seo_title_en || '';
    const existingAlt = langData[lang]?.alt || langData[lang]?.alt_en || '';
    
    try {
      result.langData[lang].title = (!force && existingTitle) ? existingTitle : (enFields.title ? await translateText(enFields.title, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].title = existingTitle;
    }
    try {
      result.langData[lang].content = (!force && existingContent) ? existingContent : (enFields.content ? await translateText(enFields.content, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].content = existingContent;
    }
    try {
      result.langData[lang].slug = (!force && existingSlug) ? existingSlug : (enFields.slug ? await translateText(enFields.slug, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].slug = existingSlug;
    }
    try {
      result.langData[lang].seoTitle = (!force && existingSeo) ? existingSeo : (enFields.seo_title ? await translateText(enFields.seo_title, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].seoTitle = existingSeo;
    }
    try {
      result.langData[lang].alt = (!force && existingAlt) ? existingAlt : (enFields.alt ? await translateText(enFields.alt, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].alt = existingAlt;
    }
  }
  
  return result;
}

async function autoTranslateCase(caseItem, force = false) {
  const langData = caseItem.langData || {};
  const en = langData.en || {};
  
  const enFields = {
    region: en.region || en.region_en || caseItem.region || '',
    category: en.category || en.category_en || caseItem.category || '',
    client: en.client || en.client_en || caseItem.client || '',
    title: en.title || en.title_en || caseItem.title || '',
    desc: en.desc || en.desc_en || caseItem.desc || '',
    content: en.content || en.content_en || '',
    outcomes: en.outcomes || en.outcomes_en || '',
    materials: en.materials || en.materials_en || '',
    h1Title: en.h1Title || en.h1_title || '',
    seoTitle: en.seoTitle || en.seo_title || '',
    slug: en.slug || en.slug_en || '',
    alt: en.alt || en.alt_en || '',
  };
  
  const targetLangs = ['zh', 'vi', 'tl'];
  const result = { ...caseItem };
  result.langData = { en: { ...enFields } };
  
  for (const lang of targetLangs) {
    result.langData[lang] = result.langData[lang] || {};
    const existingRegion = langData[lang]?.region || langData[lang]?.region_en || '';
    const existingCategory = langData[lang]?.category || langData[lang]?.category_en || '';
    const existingClient = langData[lang]?.client || langData[lang]?.client_en || '';
    const existingTitle = langData[lang]?.title || langData[lang]?.title_en || '';
    const existingDesc = langData[lang]?.desc || langData[lang]?.desc_en || '';
    const existingContent = langData[lang]?.content || langData[lang]?.content_en || '';
    const existingOutcomes = langData[lang]?.outcomes || langData[lang]?.outcomes_en || '';
    const existingMaterials = langData[lang]?.materials || langData[lang]?.materials_en || '';
    const existingH1Title = langData[lang]?.h1Title || langData[lang]?.h1_title || '';
    const existingSeoTitle = langData[lang]?.seoTitle || langData[lang]?.seo_title || '';
    const existingSlug = langData[lang]?.slug || langData[lang]?.slug_en || '';
    const existingAlt = langData[lang]?.alt || langData[lang]?.alt_en || '';
    
    try {
      result.langData[lang].region = (!force && existingRegion) ? existingRegion : (enFields.region ? await translateText(enFields.region, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].region = existingRegion;
    }
    try {
      result.langData[lang].category = (!force && existingCategory) ? existingCategory : (enFields.category ? await translateText(enFields.category, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].category = existingCategory;
    }
    try {
      result.langData[lang].client = (!force && existingClient) ? existingClient : (enFields.client ? await translateText(enFields.client, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].client = existingClient;
    }
    try {
      result.langData[lang].title = (!force && existingTitle) ? existingTitle : (enFields.title ? await translateText(enFields.title, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].title = existingTitle;
    }
    try {
      result.langData[lang].desc = (!force && existingDesc) ? existingDesc : (enFields.desc ? await translateText(enFields.desc, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].desc = existingDesc;
    }
    try {
      result.langData[lang].content = (!force && existingContent) ? existingContent : (enFields.content ? await translateText(enFields.content, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].content = existingContent;
    }
    try {
      result.langData[lang].outcomes = (!force && existingOutcomes) ? existingOutcomes : (enFields.outcomes ? await translateText(enFields.outcomes, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].outcomes = existingOutcomes;
    }
    try {
      result.langData[lang].materials = (!force && existingMaterials) ? existingMaterials : (enFields.materials ? await translateText(enFields.materials, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].materials = existingMaterials;
    }
    try {
      result.langData[lang].h1Title = (!force && existingH1Title) ? existingH1Title : (enFields.h1Title ? await translateText(enFields.h1Title, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].h1Title = existingH1Title;
    }
    try {
      result.langData[lang].seoTitle = (!force && existingSeoTitle) ? existingSeoTitle : (enFields.seoTitle ? await translateText(enFields.seoTitle, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].seoTitle = existingSeoTitle;
    }
    try {
      result.langData[lang].slug = (!force && existingSlug) ? existingSlug : (enFields.slug ? await translateText(enFields.slug, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].slug = existingSlug;
    }
    try {
      result.langData[lang].alt = (!force && existingAlt) ? existingAlt : (enFields.alt ? await translateText(enFields.alt, 'en', lang) : '');
    } catch (e) {
      result.langData[lang].alt = existingAlt;
    }
  }
  
  return result;
}

async function autoTranslateScenario(scenario) {
  // 兼容两种字段名：title_en 和 name_en 都支持
  const data = {...scenario};
  if (data.name_en && !data.title_en) data.title_en = data.name_en;
  
  const translated = await autoTranslateObject(data, {
    title_en: 'text',
    description_en: 'markdown',
  });
  
  // 把翻译结果同步回name_*字段
  translated.name_zh = translated.title_zh || translated.name_zh;
  translated.name_vi = translated.title_vi || translated.name_vi;
  translated.name_tl = translated.title_tl || translated.name_tl;
  
  return translated;
}

async function autoTranslateCategory(category, force = false) {
  const mapped = {
    ...category,
    name_en: category.name_en || category.name || '',
    description_en: category.desc_en || category.description_en || category.description || '',
  };
  return autoTranslateObject(mapped, {
    name_en: 'text',
    description_en: 'markdown',
  }, force);
}

async function autoTranslateAbout(about, force = false) {
  console.log(`[auto-translate] about = ${JSON.stringify(about)}`);
  const result = { ...about };
  const targetLangs = ['zh', 'vi', 'tl'];
  const stringFields = [
    'intro_title', 'intro_desc', 'business_desc', 'export_desc',
    'mission', 'vision', 'values',
    'founded', 'location', 'certification', 'contact_email',
  ];
  for (const field of stringFields) {
    const enField = field.endsWith('_en') ? field : `${field}_en`;
    const enValue = about[enField] || about[field];
    console.log(`[auto-translate] about.${enField} = ${enValue}`);
    if (!enValue || typeof enValue !== 'string' || enValue.trim() === '') continue;
    const baseField = field.endsWith('_en') ? field.replace('_en', '') : field;

    for (const lang of targetLangs) {
      const targetField = `${baseField}_${lang}`;
      if (!force && result[targetField] && result[targetField].trim() !== '') continue;
      try {
        result[targetField] = await translateText(enValue, 'en', lang);
      } catch (e) {
        console.warn(`[auto-translate] about.${targetField} failed:`, e.message);
      }
    }
  }

  if (about.milestones && Array.isArray(about.milestones)) {
    for (const lang of targetLangs) {
      const targetField = `milestones_${lang}`;
      if (!force && result[targetField] && result[targetField].length > 0) continue;
      try {
        const translated = [];
        for (const m of about.milestones) {
          const title = m.title_en || m.title || '';
          const desc = m.desc_en || m.desc || '';
          const year = m.year || m.year_en || '';
         
          translated.push({
            ...m,
            year: year ? await translateText(year, 'en', lang) : '',
            title: title ? await translateText(title, 'en', lang) : '',
            desc: desc ? await translateText(desc, 'en', lang) : '',
          });
        }
        result[targetField] = translated;
      } catch (e) {
        console.warn(`[auto-translate] milestones_${lang} failed:`, e.message);
      }
    }
  }

  if (about.capacity_cards && Array.isArray(about.capacity_cards)) {
    for (const lang of targetLangs) {
      const targetField = `capacity_cards_${lang}`;
      if (!force && result[targetField] && result[targetField].length > 0) continue;
      try {
        const translated = [];
        for (const c of about.capacity_cards) {
          const title = c.title_en || c.title || '';
          const desc = c.desc_en || c.desc || '';
          const titleField = lang === 'zh' ? 'title_zh' : lang === 'vi' ? 'title_vi' : 'title_tl';
          const descField = lang === 'zh' ? 'desc_zh' : lang === 'vi' ? 'desc_vi' : 'desc_tl';
          const obj = { ...c };
          obj[titleField] = title ? await translateText(title, 'en', lang) : '';
          obj[descField] = desc ? await translateText(desc, 'en', lang) : '';
          translated.push(obj);
        }
        result[targetField] = translated;
      } catch (e) {
        console.warn(`[auto-translate] capacity_cards_${lang} failed:`, e.message);
      }
    }
  }

  if (about.team_members && Array.isArray(about.team_members)) {
    result.team_members = about.team_members.map(m => {
      const name = m.name_en || m.name || '';
      const role = m.role_en || m.role || '';
      const desc = m.desc_en || m.desc || '';
      return { ...m, name, role, desc };
    });
    
    for (const lang of targetLangs) {
      const nameField = `name_${lang}`;
      const roleField = `role_${lang}`;
      const descField = `desc_${lang}`;
      
      if (!force) {
        const hasAll = result.team_members.every(m => 
          m[nameField] && m[nameField].trim() !== '' &&
          m[roleField] && m[roleField].trim() !== ''
        );
        if (hasAll) continue;
      }
      
      try {
        for (const m of result.team_members) {
          const enName = m.name || '';
          const enRole = m.role || '';
          const enDesc = m.desc || '';
          if (!m[nameField] || !m[nameField].trim()) {
            m[nameField] = enName ? await translateText(enName, 'en', lang) : '';
          }
          if (!m[roleField] || !m[roleField].trim()) {
            m[roleField] = enRole ? await translateText(enRole, 'en', lang) : '';
          }
          if (!m[descField] || !m[descField].trim()) {
            m[descField] = enDesc ? await translateText(enDesc, 'en', lang) : '';
          }
        }
      } catch (e) {
        console.warn(`[auto-translate] team_members ${lang} failed:`, e.message);
      }
    }
  }

  return result;
}

// ============ 统一自动翻译接口 ============
// POST /api/translate/auto
// Body: { type: 'faq'|'news'|'cases'|'scenarios'|'categories'|'about'|'product', data: {...} }
// 返回：自动翻译了所有空目标语言字段的新对象
app.post('/api/translate/auto', async (req, res) => {
  const { type, data } = req.body;
  if (!type || !data) {
    return res.status(400).json({ success: false, error: '缺少 type 或 data 参数' });
  }

  try {
    let translated;
    switch (type) {
      case 'faq':
        translated = await autoTranslateFAQ(data);
        break;
      case 'news':
        translated = await autoTranslateNews(data);
        break;
      case 'cases':
        translated = await autoTranslateCase(data);
        break;
      case 'scenarios':
        translated = await autoTranslateScenario(data);
        break;
      case 'categories':
        translated = await autoTranslateCategory(data);
        break;
      case 'about':
        translated = await autoTranslateAbout(data);
        break;
      case 'product':
        translated = await autoTranslateProductFields(data);
        break;
      default:
        return res.status(400).json({ success: false, error: `未知类型: ${type}` });
    }
    res.json({ success: true, data: translated });
  } catch (err) {
    console.error('[auto-translate] error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 设置接口 ============

// 获取设置
app.get('/api/settings', (req, res) => {
  const settings = readDataFile('settings.json', {
    site_name: 'Jinyu Material',
    seo_title: 'Jinyu Advertising Material',
    seo_description: 'Professional advertising material manufacturer'
  });
  res.json(settings);
});

// 保存设置
app.post('/api/settings', (req, res) => {
  const settings = req.body;
  writeDataFile('settings.json', settings);
  res.json({ success: true });
});

// ============ 社交媒体链接接口 ============

// ============ 社交媒体链接接口 ============

app.get('/api/social-links', (req, res) => {
  // 优先从数据库读取
  try {
    const rows = db.prepare('SELECT * FROM social_links WHERE is_active = 1 ORDER BY id').all();
    if (rows && rows.length > 0) {
      const links = rows.map(row => ({
        id: row.id,
        name: row.icon || '',  // 数据库中 icon 字段存的是平台名称（迁移时弄反了）
        icon: row.icon || '',  // 暂时用同一个值，或者可以根据平台映射到 CSS 类名
        url: row.url || '',
        sort_order: row.id,
        enabled: row.is_active === 1
      }));
      return res.json(links);
    }
  } catch (dbErr) {
    console.error('[DB] 读取社交链接失败，fallback 到 JSON：', dbErr.message);
  }
  // 数据库失败或为空，fallback 到 JSON
  const links = readDataFile('social-links.json', []);
  res.json(links);
});

app.post('/api/social-links', (req, res) => {
  try {
    const { name, icon, url, sort_order, enabled } = req.body;
    if (!name || !icon || !url) return res.status(400).json({ error: 'Missing name, icon, or url' });
    
    // 优先保存到数据库
    try {
      const stmt = db.prepare(`
        INSERT INTO social_links (platform, url, icon, is_active)
        VALUES (@platform, @url, @icon, @is_active)
      `);
      const result = stmt.run({
        platform: String(name || ''),
        url: String(url || ''),
        icon: String(icon || ''),
        is_active: enabled !== false ? 1 : 0
      });
      const newId = result.lastInsertRowid;
      
      // 同时保存到 JSON（保持同步/备份）
      const links = readDataFile('social-links.json', []);
      const newLink = { id: newId, name, icon, url, sort_order: sort_order ?? newId, enabled: enabled !== false };
      links.push(newLink);
      writeDataFile('social-links.json', links);
      
      res.json({ success: true, data: newLink });
    } catch (dbErr) {
      console.error('[DB] 创建社交链接失败，fallback 到 JSON：', dbErr.message);
      // fallback 到 JSON
      const links = readDataFile('social-links.json', []);
      const newId = links.length > 0 ? Math.max(...links.map(l => l.id || 0)) + 1 : 1;
      const newLink = { id: newId, name, icon, url, sort_order: sort_order ?? newId, enabled: enabled !== false };
      links.push(newLink);
      writeDataFile('social-links.json', links);
      res.json({ success: true, data: newLink });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/social-links', (req, res) => {
  try {
    const links = Array.isArray(req.body) ? req.body : [req.body];
    
    // 优先保存到数据库
    try {
      // 清空表并重新插入（批量更新）
      db.prepare('DELETE FROM social_links').run();
      const stmt = db.prepare(`
        INSERT INTO social_links (id, platform, url, icon, is_active)
        VALUES (@id, @platform, @url, @icon, @is_active)
      `);
      const insert = db.transaction((links) => {
        links.forEach(link => {
          stmt.run({
            id: parseInt(link.id) || 0,
            platform: String(link.name || ''),
            url: String(link.url || ''),
            icon: String(link.icon || ''),
            is_active: link.enabled !== false ? 1 : 0
          });
        });
      });
      insert(links);
    } catch (dbErr) {
      console.error('[DB] 更新社交链接失败：', dbErr.message);
    }
    
    // 同时保存到 JSON（保持同步/备份）
    writeDataFile('social-links.json', links);
    res.json({ success: true, data: links });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/social-links/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // 优先更新数据库
    try {
      const stmt = db.prepare(`
        UPDATE social_links SET
          platform = @platform,
          url = @url,
          icon = @icon,
          is_active = @is_active
        WHERE id = @id
      `);
      stmt.run({
        id,
        platform: String(req.body.name || ''),
        url: String(req.body.url || ''),
        icon: String(req.body.icon || ''),
        is_active: req.body.enabled !== false ? 1 : 0
      });
    } catch (dbErr) {
      console.error('[DB] 更新社交链接失败：', dbErr.message);
    }
    
    // 同时更新 JSON（保持同步/备份）
    const links = readDataFile('social-links.json', []);
    const idx = links.findIndex(l => l.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    links[idx] = { ...links[idx], ...req.body, id };
    writeDataFile('social-links.json', links);
    res.json({ success: true, data: links[idx] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/social-links/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // 优先从数据库删除
    try {
      db.prepare('DELETE FROM social_links WHERE id = ?').run(id);
    } catch (dbErr) {
      console.error('[DB] 删除社交链接失败：', dbErr.message);
    }
    
    // 同时从 JSON 删除（保持同步/备份）
    let links = readDataFile('social-links.json', []);
    links = links.filter(l => l.id !== id);
    writeDataFile('social-links.json', links);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ 联系表单接口 ============

// 提交联系表单
app.post('/api/contact', (req, res) => {
  const now = new Date();
  const newContact = {
    ...req.body,
    id: Date.now(),
    date: now.toISOString().slice(0, 10),      // 确保 date 字段存在（YYYY-MM-DD）
    createdAt: now.toISOString(),
    isRead: false,
  };
  
  // 优先保存到数据库
  try {
    const stmt = db.prepare(`
      INSERT INTO contacts (id, name, email, company, product, message, lang, is_read)
      VALUES (@id, @name, @email, @company, @product, @message, @lang, @is_read)
    `);
    stmt.run({
      id: newContact.id,
      name: String(req.body.name || ''),
      email: String(req.body.email || ''),
      company: String(req.body.company || ''),
      product: String(req.body.product || ''),
      message: String(req.body.message || ''),
      lang: String(req.body.lang || 'en'),
      is_read: 0
    });
    console.log('[DB] 联系表单已保存到数据库');
  } catch (dbErr) {
    console.error('[DB] 保存联系表单失败：', dbErr.message);
  }
  
  // 同时保存到 JSON（保持同步/备份）
  const contacts = readDataFile('contacts.json', []);
  contacts.push(newContact);
  writeDataFile('contacts.json', contacts);
  
  console.log('New contact:', newContact);
  res.json({ success: true, message: 'Thank you for your message!' });
});

// 获取所有联系人
app.get('/api/contacts', (req, res) => {
  // 优先从数据库读取
  try {
    const rows = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
    if (rows && rows.length > 0) {
      const contacts = rows.map(row => ({
        id: row.id,
        name: row.name || '',
        email: row.email || '',
        company: row.company || '',
        product: row.product || '',
        message: row.message || '',
        lang: row.lang || 'en',
        isRead: row.is_read === 1,
        date: row.created_at ? row.created_at.slice(0, 10) : '',
        createdAt: row.created_at || ''
      }));
      return res.json(contacts);
    }
  } catch (dbErr) {
    console.error('[DB] 读取联系人失败，fallback 到 JSON：', dbErr.message);
  }
  // 数据库失败或为空，fallback 到 JSON
  const contacts = readDataFile('contacts.json', []);
  res.json(contacts);
});

// 标记联系人已读
app.patch('/api/contacts/:id/read', (req, res) => {
  const contactId = String(req.params.id);
  
  // 优先更新数据库
  try {
    db.prepare('UPDATE contacts SET is_read = 1 WHERE id = ?').run(contactId);
    console.log(`[DB] 标记联系人已读：${contactId}`);
  } catch (dbErr) {
    console.error('[DB] 标记已读失败：', dbErr.message);
  }
  
  // 同时更新 JSON（保持同步/备份）
  try {
    let contacts = readDataFile('contacts.json', []);
    const idx = contacts.findIndex(c => String(c.id) === contactId);
    if (idx !== -1) {
      contacts[idx].isRead = true;
      writeDataFile('contacts.json', contacts);
    }
  } catch {}
  
  res.json({ success: true });
});

// ============ 应用场景接口（从数据库 scenarios 表读取） ============

app.get('/api/applications', (req, res) => {
  // 优先从数据库读取
  try {
    const rows = db.prepare('SELECT * FROM scenarios ORDER BY sort_order, id').all();
    if (rows && rows.length > 0) {
      const scenarios = rows.map(row => ({
        id: row.id,
        slug: row.slug || `scenario-${row.id}`,
        image: row.image || '',
        name: row.name_en || '',           // 前端期望直接有 name 字段
        description: row.description_en || '', // 前端期望直接有 description 字段
        langData: {
          en: { name: row.name_en || '', description: row.description_en || '' },
          zh: { name: row.name_zh || '', description: row.description_zh || '' },
          vi: { name: row.name_vi || '', description: row.description_vi || '' },
          tl: { name: row.name_tl || '', description: row.description_tl || '' }
        },
        materials: []  // 暂时为空，后续可以从产品关联表读取
      }));
      return res.json({ success: true, data: scenarios });
    }
  } catch (dbErr) {
    console.error('[DB] 读取应用场景失败，fallback 到 JSON：', dbErr.message);
  }
  // 数据库失败或为空，fallback 到 JSON
  const scenarios = readDataFile('scenarios.json', []);
  res.json({ success: true, data: scenarios });
});

// ============ 新闻接口 ============

app.get('/api/news', (req, res) => {
  // 优先从数据库读取
  try {
    const rows = db.prepare('SELECT * FROM news ORDER BY created_at DESC').all();
    if (rows && rows.length > 0) {
      const news = rows.map(row => ({
        id: row.id,
        date: row.date || '',
        status: row.status || 'draft',
        views: row.views || 0,
        images: JSON.parse(row.images || '[]'),
        category: row.category || '',
        langData: {
          en: { title: row.title_en || '', slug: row.slug_en || '', content: row.content_en || '', seoTitle: row.seo_title_en || '', alt: row.alt_en || '' },
          zh: { title: row.title_zh || '', slug: row.slug_zh || '', content: row.content_zh || '', seoTitle: row.seo_title_zh || '', alt: row.alt_zh || '' },
          vi: { title: row.title_vi || '', slug: row.slug_vi || '', content: row.content_vi || '', seoTitle: row.seo_title_vi || '', alt: row.alt_vi || '' },
          ph: { title: row.title_tl || '', slug: row.slug_tl || '', content: row.content_tl || '', seoTitle: row.seo_title_tl || '', alt: row.alt_tl || '' }
        }
      }));
      return res.json(news);
    }
  } catch (dbErr) {
    console.error('[DB] 读取新闻失败，fallback 到 JSON：', dbErr.message);
  }
  // 数据库失败或为空，fallback 到 JSON
  const news = readDataFile('news.json', []);
  res.json(news);
});

app.post('/api/news', async (req, res) => {
  const now = new Date().toISOString().slice(0, 10);
  const cleanBody = { ...req.body };
  Object.keys(cleanBody).forEach(key => {
    if (key !== 'langData' && /_zh$|_vi$|_tl$/.test(key)) {
      delete cleanBody[key];
    }
  });
  if (cleanBody.langData) {
    ['zh', 'vi', 'tl', 'ph'].forEach(lang => {
      if (cleanBody.langData[lang]) {
        Object.keys(cleanBody.langData[lang]).forEach(key => {
          if (/_zh$|_vi$|_tl$/.test(key)) {
            delete cleanBody.langData[lang][key];
          }
        });
      }
    });
  }
  
  const translated = await autoTranslateNews(cleanBody, true);
  const newItem = {
    ...req.body,
    ...translated,
    id: Date.now()
  };
  
  try {
    const stmt = db.prepare(`
      INSERT INTO news (
        id, date, status, views, images, category,
        title_en, title_zh, title_vi, title_tl,
        slug_en, slug_zh, slug_vi, slug_tl,
        content_en, content_zh, content_vi, content_tl,
        seo_title_en, seo_title_zh, seo_title_vi, seo_title_tl,
        alt_en, alt_zh, alt_vi, alt_tl
      ) VALUES (
        @id, @date, @status, @views, @images, @category,
        @title_en, @title_zh, @title_vi, @title_tl,
        @slug_en, @slug_zh, @slug_vi, @slug_tl,
        @content_en, @content_zh, @content_vi, @content_tl,
        @seo_title_en, @seo_title_zh, @seo_title_vi, @seo_title_tl,
        @alt_en, @alt_zh, @alt_vi, @alt_tl
      )
    `);
    
    const langData = newItem.langData || {};
    stmt.run({
      id: newItem.id,
      date: newItem.date || now,
      status: newItem.status || 'draft',
      views: newItem.views || 0,
      images: JSON.stringify(newItem.images || []),
      category: newItem.category || '',
      title_en: String(langData.en?.title || ''),
      title_zh: String(langData.zh?.title || ''),
      title_vi: String(langData.vi?.title || ''),
      title_tl: String(langData.ph?.title || langData.tl?.title || ''),
      slug_en: String(langData.en?.slug || ''),
      slug_zh: String(langData.zh?.slug || ''),
      slug_vi: String(langData.vi?.slug || ''),
      slug_tl: String(langData.ph?.slug || langData.tl?.slug || ''),
      content_en: String(langData.en?.content || ''),
      content_zh: String(langData.zh?.content || ''),
      content_vi: String(langData.vi?.content || ''),
      content_tl: String(langData.ph?.content || langData.tl?.content || ''),
      seo_title_en: String(langData.en?.seo_title || langData.en?.seoTitle || ''),
      seo_title_zh: String(langData.zh?.seo_title || langData.zh?.seoTitle || ''),
      seo_title_vi: String(langData.vi?.seo_title || langData.vi?.seoTitle || ''),
      seo_title_tl: String(langData.ph?.seo_title || langData.ph?.seoTitle || langData.tl?.seo_title || langData.tl?.seoTitle || ''),
      alt_en: String(langData.en?.alt || ''),
      alt_zh: String(langData.zh?.alt || ''),
      alt_vi: String(langData.vi?.alt || ''),
      alt_tl: String(langData.ph?.alt || langData.tl?.alt || '')
    });
    console.log(`[DB] 创建新闻：${newItem.id}`);
  } catch (dbErr) {
    console.error('[DB] 创建新闻失败，fallback 到 JSON：', dbErr.message);
  }
  
  const news = readDataFile('news.json', []);
  news.push(newItem);
  writeDataFile('news.json', news);
  
  res.json(newItem);
});

app.put('/api/news/:id', async (req, res) => {
  const newsId = parseInt(req.params.id);
  const cleanBody = { ...req.body };
  Object.keys(cleanBody).forEach(key => {
    if (key !== 'langData' && /_zh$|_vi$|_tl$/.test(key)) {
      delete cleanBody[key];
    }
  });
  if (cleanBody.langData) {
    ['zh', 'vi', 'tl', 'ph'].forEach(lang => {
      if (cleanBody.langData[lang]) {
        Object.keys(cleanBody.langData[lang]).forEach(key => {
          if (/_zh$|_vi$|_tl$/.test(key)) {
            delete cleanBody.langData[lang][key];
          }
        });
      }
    });
  }
  
  const translated = await autoTranslateNews(cleanBody, true);
  const updatedItem = {
    ...req.body,
    ...translated,
  };
  const langData = updatedItem.langData || {};
  
  try {
    const stmt = db.prepare(`
      UPDATE news SET
        date = @date,
        status = @status,
        views = @views,
        images = @images,
        category = @category,
        title_en = @title_en,
        title_zh = @title_zh,
        title_vi = @title_vi,
        title_tl = @title_tl,
        slug_en = @slug_en,
        slug_zh = @slug_zh,
        slug_vi = @slug_vi,
        slug_tl = @slug_tl,
        content_en = @content_en,
        content_zh = @content_zh,
        content_vi = @content_vi,
        content_tl = @content_tl,
        seo_title_en = @seo_title_en,
        seo_title_zh = @seo_title_zh,
        seo_title_vi = @seo_title_vi,
        seo_title_tl = @seo_title_tl,
        alt_en = @alt_en,
        alt_zh = @alt_zh,
        alt_vi = @alt_vi,
        alt_tl = @alt_tl
      WHERE id = @id
    `);
    
    const result = stmt.run({
      id: newsId,
      date: updatedItem.date || '',
      status: updatedItem.status || 'draft',
      views: updatedItem.views || 0,
      images: JSON.stringify(updatedItem.images || []),
      category: updatedItem.category || '',
      title_en: String(langData.en?.title || ''),
      title_zh: String(langData.zh?.title || ''),
      title_vi: String(langData.vi?.title || ''),
      title_tl: String(langData.ph?.title || langData.tl?.title || ''),
      slug_en: String(langData.en?.slug || ''),
      slug_zh: String(langData.zh?.slug || ''),
      slug_vi: String(langData.vi?.slug || ''),
      slug_tl: String(langData.ph?.slug || langData.tl?.slug || ''),
      content_en: String(langData.en?.content || ''),
      content_zh: String(langData.zh?.content || ''),
      content_vi: String(langData.vi?.content || ''),
      content_tl: String(langData.ph?.content || langData.tl?.content || ''),
      seo_title_en: String(langData.en?.seo_title || langData.en?.seoTitle || ''),
      seo_title_zh: String(langData.zh?.seo_title || langData.zh?.seoTitle || ''),
      seo_title_vi: String(langData.vi?.seo_title || langData.vi?.seoTitle || ''),
      seo_title_tl: String(langData.ph?.seo_title || langData.ph?.seoTitle || langData.tl?.seo_title || langData.tl?.seoTitle || ''),
      alt_en: String(langData.en?.alt || ''),
      alt_zh: String(langData.zh?.alt || ''),
      alt_vi: String(langData.vi?.alt || ''),
      alt_tl: String(langData.ph?.alt || langData.tl?.alt || '')
    });
    
    if (result.changes > 0) {
      console.log(`[DB] 更新新闻：${newsId}`);
    }
  } catch (dbErr) {
    console.error('[DB] 更新新闻失败：', dbErr.message);
  }
  
  const news = readDataFile('news.json', []);
  const index = news.findIndex(n => n.id === newsId);
  if (index !== -1) {
    news[index] = { ...news[index], ...updatedItem };
    writeDataFile('news.json', news);
    res.json(news[index]);
  } else {
    res.status(404).json({ error: 'News not found' });
  }
});

app.delete('/api/news/:id', (req, res) => {
  const newsId = parseInt(req.params.id);
  let deleted = false;
  
  // 优先从数据库删除
  try {
    const result = db.prepare('DELETE FROM news WHERE id = ?').run(newsId);
    if (result.changes > 0) {
      deleted = true;
      console.log(`[DB] 删除新闻：${newsId}`);
    }
  } catch (dbErr) {
    console.error('[DB] 删除新闻失败：', dbErr.message);
  }
  
  // 同时从 JSON 删除（保持同步/备份）
  let news = readDataFile('news.json', []);
  const before = news.length;
  news = news.filter(n => n.id !== newsId);
  if (news.length < before) deleted = true;
  writeDataFile('news.json', news);
  
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'News not found' });
  }
});

// 新闻真实浏览量（从前台写的 news-views.json 读取）
app.get('/api/news-views', (req, res) => {
  const viewsFile = join(__dirname, 'data', 'news-views.json');
  try {
    if (existsSync(viewsFile)) {
      const data = JSON.parse(readFileSync(viewsFile, 'utf-8'));
      res.json(data);
    } else {
      res.json({});
    }
  } catch {
    res.json({});
  }
});

// 前台兼容：/api/blog → 返回 {success, data} 格式（与 /api/news 相同数据）
app.get('/api/blog', (req, res) => {
  // 优先从数据库读取
  try {
    const rows = db.prepare('SELECT * FROM news ORDER BY created_at DESC').all();
    if (rows && rows.length > 0) {
      const news = rows.map(row => ({
        id: row.id,
        date: row.date || '',
        status: row.status || 'draft',
        views: row.views || 0,
        images: JSON.parse(row.images || '[]'),
        category: row.category || '',
        langData: {
          en: { title: row.title_en || '', slug: row.slug_en || '', content: row.content_en || '' },
          zh: { title: row.title_zh || '', slug: row.slug_zh || '', content: row.content_zh || '' },
          vi: { title: row.title_vi || '', slug: row.slug_vi || '', content: row.content_vi || '' },
          ph: { title: row.title_tl || '', slug: row.slug_tl || '', content: row.content_tl || '' }
        }
      }));
      return res.json({ success: true, data: news });
    }
  } catch (dbErr) {
    console.error('[DB] 读取新闻失败，fallback 到 JSON：', dbErr.message);
  }
  // 数据库失败或为空，fallback 到 JSON
  const news = readDataFile('news.json', []);
  res.json({ success: true, data: news });
});

// 前台兼容：/api/blog/:slug → 按 slug 查找单条新闻
app.get('/api/blog/:slug', (req, res) => {
  const slug = req.params.slug;
  
  // 优先从数据库查找
  try {
    const rows = db.prepare('SELECT * FROM news').all();
    const langKeys = ['en', 'zh', 'vi', 'ph', 'tl', 'fil'];
    let item = null;
    
    // 按所有语言的 slug 匹配
    for (const row of rows) {
      const match = langKeys.some(lang => {
        const slugField = row[`slug_${lang === 'ph' || lang === 'tl' || lang === 'fil' ? 'tl' : lang}`];
        return slugField === slug;
      });
      if (match) {
        item = {
          id: row.id,
          date: row.date || '',
          status: row.status || 'draft',
          views: row.views || 0,
          images: JSON.parse(row.images || '[]'),
          category: row.category || '',
          langData: {
            en: { title: row.title_en || '', slug: row.slug_en || '', content: row.content_en || '' },
            zh: { title: row.title_zh || '', slug: row.slug_zh || '', content: row.content_zh || '' },
            vi: { title: row.title_vi || '', slug: row.slug_vi || '', content: row.content_vi || '' },
            ph: { title: row.title_tl || '', slug: row.slug_tl || '', content: row.content_tl || '' }
          }
        };
        break;
      }
    }
    
    // 如果没找到，按 id 匹配
    if (!item) {
      const numericId = parseInt(slug.replace('news-', ''));
      if (!isNaN(numericId)) {
        const row = rows.find(r => r.id === numericId);
        if (row) {
          item = {
            id: row.id,
            date: row.date || '',
            status: row.status || 'draft',
            views: row.views || 0,
            images: JSON.parse(row.images || '[]'),
            category: row.category || '',
            langData: {
              en: { title: row.title_en || '', slug: row.slug_en || '', content: row.content_en || '' },
              zh: { title: row.title_zh || '', slug: row.slug_zh || '', content: row.content_zh || '' },
              vi: { title: row.title_vi || '', slug: row.slug_vi || '', content: row.content_vi || '' },
              ph: { title: row.title_tl || '', slug: row.slug_tl || '', content: row.content_tl || '' }
            }
          };
        }
      }
    }
    
    if (item) {
      return res.json({ success: true, data: item });
    }
  } catch (dbErr) {
    console.error('[DB] 按 slug 查找新闻失败：', dbErr.message);
  }
  
  // 数据库没找到，fallback 到 JSON
  const news = readDataFile('news.json', []);
  const langKeys = ['en', 'zh', 'vi', 'ph', 'tl', 'fil'];
  let item = news.find(n => {
    if (!n.langData) return false;
    return langKeys.some(lang => n.langData[lang] && n.langData[lang].slug === slug);
  });
  
  // 如果没找到，按 id 匹配
  if (!item) {
    const numericId = parseInt(slug.replace('news-', ''));
    if (!isNaN(numericId)) {
      item = news.find(n => n.id === numericId);
    }
  }
  
  if (item) {
    res.json({ success: true, data: item });
  } else {
    res.status(404).json({ success: false, message: 'News not found' });
  }
});

// ============ 案例研究接口 ============

app.get('/api/cases', (req, res) => {
  // 优先从数据库读取
  try {
    const rows = db.prepare('SELECT * FROM cases ORDER BY created_at DESC').all();
    if (rows && rows.length > 0) {
      const cases = rows.map(row => ({
        id: row.id,
        slug: row.slug || '',
        date: row.date || '',
        status: row.status || 'draft',
        video: row.video || '',
        images: JSON.parse(row.images || '[]'),
        region: row.region_en || '',
        title: row.title_en || '',
        category: row.category_en || '',
        client: row.client_en || '',
        langData: {
          en: { region: row.region_en || '', category: row.category_en || '', client: row.client_en || '', title: row.title_en || '', content: row.content_en || '', outcomes: row.outcomes_en || '', materials: row.materials_en || '', seoTitle: row.seo_title_en || '', h1Title: row.h1_title_en || '', slug: row.slug_en || '', alt: row.alt_en || '' },
          zh: { region: row.region_zh || '', category: row.category_zh || '', client: row.client_zh || '', title: row.title_zh || '', content: row.content_zh || '', outcomes: row.outcomes_zh || '', materials: row.materials_zh || '', seoTitle: row.seo_title_zh || '', h1Title: row.h1_title_zh || '', slug: row.slug_zh || '', alt: row.alt_zh || '' },
          vi: { region: row.region_vi || '', category: row.category_vi || '', client: row.client_vi || '', title: row.title_vi || '', content: row.content_vi || '', outcomes: row.outcomes_vi || '', materials: row.materials_vi || '', seoTitle: row.seo_title_vi || '', h1Title: row.h1_title_vi || '', slug: row.slug_vi || '', alt: row.alt_vi || '' },
          ph: { region: row.region_tl || '', category: row.category_tl || '', client: row.client_tl || '', title: row.title_tl || '', content: row.content_tl || '', outcomes: row.outcomes_tl || '', materials: row.materials_tl || '', seoTitle: row.seo_title_tl || '', h1Title: row.h1_title_tl || '', slug: row.slug_tl || '', alt: row.alt_tl || '' }
        }
      }));
      return res.json({ success: true, data: cases });
    }
  } catch (dbErr) {
    console.error('[DB] 读取案例失败，fallback 到 JSON：', dbErr.message);
  }
  const cases = readDataFile('cases.json', []);
  res.json({ success: true, data: cases });
});

// 获取单个案例（用于编辑）
app.get('/api/cases/:id', (req, res) => {
  const caseId = parseInt(req.params.id);
  
  // 优先从数据库读取
  try {
    const row = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId);
    if (row) {
      const caseData = {
        id: row.id,
        slug: row.slug || '',
        date: row.date || '',
        status: row.status || 'draft',
        video: row.video || '',
        images: JSON.parse(row.images || '[]'),
        region: row.region_en || '',
        title: row.title_en || '',
        category: row.category_en || '',
        client: row.client_en || '',
        langData: {
          en: { region: row.region_en || '', category: row.category_en || '', client: row.client_en || '', title: row.title_en || '', content: row.content_en || '', outcomes: row.outcomes_en || '', materials: row.materials_en || '', seoTitle: row.seo_title_en || '', h1Title: row.h1_title_en || '', slug: row.slug_en || '', alt: row.alt_en || '' },
          zh: { region: row.region_zh || '', category: row.category_zh || '', client: row.client_zh || '', title: row.title_zh || '', content: row.content_zh || '', outcomes: row.outcomes_zh || '', materials: row.materials_zh || '', seoTitle: row.seo_title_zh || '', h1Title: row.h1_title_zh || '', slug: row.slug_zh || '', alt: row.alt_zh || '' },
          vi: { region: row.region_vi || '', category: row.category_vi || '', client: row.client_vi || '', title: row.title_vi || '', content: row.content_vi || '', outcomes: row.outcomes_vi || '', materials: row.materials_vi || '', seoTitle: row.seo_title_vi || '', h1Title: row.h1_title_vi || '', slug: row.slug_vi || '', alt: row.alt_vi || '' },
          ph: { region: row.region_tl || '', category: row.category_tl || '', client: row.client_tl || '', title: row.title_tl || '', content: row.content_tl || '', outcomes: row.outcomes_tl || '', materials: row.materials_tl || '', seoTitle: row.seo_title_tl || '', h1Title: row.h1_title_tl || '', slug: row.slug_tl || '', alt: row.alt_tl || '' }
        }
      };
      return res.json(caseData);
    }
  } catch (dbErr) {
    console.error('[DB] 读取案例失败，fallback 到 JSON：', dbErr.message);
  }
  
  const cases = readDataFile('cases.json', []);
  const caseData = cases.find(c => c.id === caseId || c.id === String(caseId));
  if (!caseData) {
    return res.status(404).json({ error: 'Case not found' });
  }
  res.json(caseData);
});

app.post('/api/cases', async (req, res) => {
  const now = new Date().toISOString().slice(0, 10);
  const cleanBody = { ...req.body };
  Object.keys(cleanBody).forEach(key => {
    if (key !== 'langData' && /_zh$|_vi$|_tl$/.test(key)) {
      delete cleanBody[key];
    }
  });
  if (cleanBody.langData) {
    ['zh', 'vi', 'tl', 'ph'].forEach(lang => {
      if (cleanBody.langData[lang]) {
        Object.keys(cleanBody.langData[lang]).forEach(key => {
          if (/_zh$|_vi$|_tl$/.test(key)) {
            delete cleanBody.langData[lang][key];
          }
        });
      }
    });
  }
  
  const translated = await autoTranslateCase(cleanBody, true);
  
  let slug = req.body.slug || translated.slug || '';
  if (!slug) {
    slug = 'case-' + Date.now();
  }
  
  const newItem = {
    ...req.body,
    ...translated,
    slug,
    id: Date.now()
  };
  
  try {
    const stmt = db.prepare(`
      INSERT INTO cases (
        id, slug, date, status, video, images,
        region_en, region_zh, region_vi, region_tl,
        category_en, category_zh, category_vi, category_tl,
        client_en, client_zh, client_vi, client_tl,
        title_en, title_zh, title_vi, title_tl,
        content_en, content_zh, content_vi, content_tl,
        outcomes_en, outcomes_zh, outcomes_vi, outcomes_tl,
        materials_en, materials_zh, materials_vi, materials_tl,
        slug_en, slug_zh, slug_vi, slug_tl,
        h1_title_en, h1_title_zh, h1_title_vi, h1_title_tl,
        seo_title_en, seo_title_zh, seo_title_vi, seo_title_tl,
        alt_en, alt_zh, alt_vi, alt_tl
      ) VALUES (
        @id, @slug, @date, @status, @video, @images,
        @region_en, @region_zh, @region_vi, @region_tl,
        @category_en, @category_zh, @category_vi, @category_tl,
        @client_en, @client_zh, @client_vi, @client_tl,
        @title_en, @title_zh, @title_vi, @title_tl,
        @content_en, @content_zh, @content_vi, @content_tl,
        @outcomes_en, @outcomes_zh, @outcomes_vi, @outcomes_tl,
        @materials_en, @materials_zh, @materials_vi, @materials_tl,
        @slug_en, @slug_zh, @slug_vi, @slug_tl,
        @h1_title_en, @h1_title_zh, @h1_title_vi, @h1_title_tl,
        @seo_title_en, @seo_title_zh, @seo_title_vi, @seo_title_tl,
        @alt_en, @alt_zh, @alt_vi, @alt_tl
      )
    `);
    
    const langData = newItem.langData || {};
    stmt.run({
      id: newItem.id,
      slug: newItem.slug || '',
      date: newItem.date || now,
      status: newItem.status || 'draft',
      video: newItem.video || '',
      images: JSON.stringify(newItem.images || []),
      region_en: String(langData.en?.region || ''),
      region_zh: String(langData.zh?.region || ''),
      region_vi: String(langData.vi?.region || ''),
      region_tl: String(langData.ph?.region || langData.tl?.region || ''),
      category_en: String(langData.en?.category || ''),
      category_zh: String(langData.zh?.category || ''),
      category_vi: String(langData.vi?.category || ''),
      category_tl: String(langData.ph?.category || langData.tl?.category || ''),
      client_en: String(langData.en?.client || ''),
      client_zh: String(langData.zh?.client || ''),
      client_vi: String(langData.vi?.client || ''),
      client_tl: String(langData.ph?.client || langData.tl?.client || ''),
      title_en: String(langData.en?.title || ''),
      title_zh: String(langData.zh?.title || ''),
      title_vi: String(langData.vi?.title || ''),
      title_tl: String(langData.ph?.title || langData.tl?.title || ''),
      content_en: String(langData.en?.content || ''),
      content_zh: String(langData.zh?.content || ''),
      content_vi: String(langData.vi?.content || ''),
      content_tl: String(langData.ph?.content || langData.tl?.content || ''),
      outcomes_en: String(langData.en?.outcomes || ''),
      outcomes_zh: String(langData.zh?.outcomes || ''),
      outcomes_vi: String(langData.vi?.outcomes || ''),
      outcomes_tl: String(langData.ph?.outcomes || langData.tl?.outcomes || ''),
      materials_en: String(langData.en?.materials || ''),
      materials_zh: String(langData.zh?.materials || ''),
      materials_vi: String(langData.vi?.materials || ''),
      materials_tl: String(langData.ph?.materials || langData.tl?.materials || ''),
      slug_en: String(langData.en?.slug || ''),
      slug_zh: String(langData.zh?.slug || ''),
      slug_vi: String(langData.vi?.slug || ''),
      slug_tl: String(langData.ph?.slug || langData.tl?.slug || ''),
      h1_title_en: String(langData.en?.h1Title || ''),
      h1_title_zh: String(langData.zh?.h1Title || ''),
      h1_title_vi: String(langData.vi?.h1Title || ''),
      h1_title_tl: String(langData.ph?.h1Title || langData.tl?.h1Title || ''),
      seo_title_en: String(langData.en?.seoTitle || ''),
      seo_title_zh: String(langData.zh?.seoTitle || ''),
      seo_title_vi: String(langData.vi?.seoTitle || ''),
      seo_title_tl: String(langData.ph?.seoTitle || langData.tl?.seoTitle || ''),
      alt_en: String(langData.en?.alt || ''),
      alt_zh: String(langData.zh?.alt || ''),
      alt_vi: String(langData.vi?.alt || ''),
      alt_tl: String(langData.ph?.alt || langData.tl?.alt || '')
    });
    
    console.log(`[DB] 创建案例：${newItem.id}`);
  } catch (dbErr) {
    console.error('[DB] 创建案例失败，fallback 到 JSON：', dbErr.message);
  }
  
  const cases = readDataFile('cases.json', []);
  cases.push(newItem);
  writeDataFile('cases.json', cases);
  
  res.json(newItem);
});

app.put('/api/cases/:id', async (req, res) => {
  const caseId = parseInt(req.params.id);
  const cleanBody = { ...req.body };
  Object.keys(cleanBody).forEach(key => {
    if (key !== 'langData' && /_zh$|_vi$|_tl$/.test(key)) {
      delete cleanBody[key];
    }
  });
  if (cleanBody.langData) {
    ['zh', 'vi', 'tl', 'ph'].forEach(lang => {
      if (cleanBody.langData[lang]) {
        Object.keys(cleanBody.langData[lang]).forEach(key => {
          if (/_zh$|_vi$|_tl$/.test(key)) {
            delete cleanBody.langData[lang][key];
          }
        });
      }
    });
  }
  
  const translated = await autoTranslateCase(cleanBody, true);
  
  let slug = req.body.slug || translated.slug || '';
  if (!slug) {
    slug = 'case-' + Date.now();
  }
  
  const updatedItem = {
    ...req.body,
    ...translated,
    slug,
  };
  const langData = updatedItem.langData || {};
  
  try {
    const stmt = db.prepare(`
      UPDATE cases SET
        slug = @slug,
        date = @date,
        status = @status,
        video = @video,
        images = @images,
        region_en = @region_en,
        region_zh = @region_zh,
        region_vi = @region_vi,
        region_tl = @region_tl,
        category_en = @category_en,
        category_zh = @category_zh,
        category_vi = @category_vi,
        category_tl = @category_tl,
        client_en = @client_en,
        client_zh = @client_zh,
        client_vi = @client_vi,
        client_tl = @client_tl,
        title_en = @title_en,
        title_zh = @title_zh,
        title_vi = @title_vi,
        title_tl = @title_tl,
        content_en = @content_en,
        content_zh = @content_zh,
        content_vi = @content_vi,
        content_tl = @content_tl,
        outcomes_en = @outcomes_en,
        outcomes_zh = @outcomes_zh,
        outcomes_vi = @outcomes_vi,
        outcomes_tl = @outcomes_tl,
        materials_en = @materials_en,
        materials_zh = @materials_zh,
        materials_vi = @materials_vi,
        materials_tl = @materials_tl,
        slug_en = @slug_en,
        slug_zh = @slug_zh,
        slug_vi = @slug_vi,
        slug_tl = @slug_tl,
        h1_title_en = @h1_title_en,
        h1_title_zh = @h1_title_zh,
        h1_title_vi = @h1_title_vi,
        h1_title_tl = @h1_title_tl,
        seo_title_en = @seo_title_en,
        seo_title_zh = @seo_title_zh,
        seo_title_vi = @seo_title_vi,
        seo_title_tl = @seo_title_tl,
        alt_en = @alt_en,
        alt_zh = @alt_zh,
        alt_vi = @alt_vi,
        alt_tl = @alt_tl
      WHERE id = @id
    `);
    
    const result = stmt.run({
      id: caseId,
      slug: updatedItem.slug || '',
      date: updatedItem.date || '',
      status: updatedItem.status || 'draft',
      video: updatedItem.video || '',
      images: JSON.stringify(updatedItem.images || []),
      region_en: String(langData.en?.region || ''),
      region_zh: String(langData.zh?.region || ''),
      region_vi: String(langData.vi?.region || ''),
      region_tl: String(langData.ph?.region || langData.tl?.region || ''),
      category_en: String(langData.en?.category || ''),
      category_zh: String(langData.zh?.category || ''),
      category_vi: String(langData.vi?.category || ''),
      category_tl: String(langData.ph?.category || langData.tl?.category || ''),
      client_en: String(langData.en?.client || ''),
      client_zh: String(langData.zh?.client || ''),
      client_vi: String(langData.vi?.client || ''),
      client_tl: String(langData.ph?.client || langData.tl?.client || ''),
      title_en: String(langData.en?.title || ''),
      title_zh: String(langData.zh?.title || ''),
      title_vi: String(langData.vi?.title || ''),
      title_tl: String(langData.ph?.title || langData.tl?.title || ''),
      content_en: String(langData.en?.content || ''),
      content_zh: String(langData.zh?.content || ''),
      content_vi: String(langData.vi?.content || ''),
      content_tl: String(langData.ph?.content || langData.tl?.content || ''),
      outcomes_en: String(langData.en?.outcomes || ''),
      outcomes_zh: String(langData.zh?.outcomes || ''),
      outcomes_vi: String(langData.vi?.outcomes || ''),
      outcomes_tl: String(langData.ph?.outcomes || langData.tl?.outcomes || ''),
      materials_en: String(langData.en?.materials || ''),
      materials_zh: String(langData.zh?.materials || ''),
      materials_vi: String(langData.vi?.materials || ''),
      materials_tl: String(langData.ph?.materials || langData.tl?.materials || ''),
      slug_en: String(langData.en?.slug || ''),
      slug_zh: String(langData.zh?.slug || ''),
      slug_vi: String(langData.vi?.slug || ''),
      slug_tl: String(langData.ph?.slug || langData.tl?.slug || ''),
      h1_title_en: String(langData.en?.h1Title || ''),
      h1_title_zh: String(langData.zh?.h1Title || ''),
      h1_title_vi: String(langData.vi?.h1Title || ''),
      h1_title_tl: String(langData.ph?.h1Title || langData.tl?.h1Title || ''),
      seo_title_en: String(langData.en?.seoTitle || ''),
      seo_title_zh: String(langData.zh?.seoTitle || ''),
      seo_title_vi: String(langData.vi?.seoTitle || ''),
      seo_title_tl: String(langData.ph?.seoTitle || langData.tl?.seoTitle || ''),
      alt_en: String(langData.en?.alt || ''),
      alt_zh: String(langData.zh?.alt || ''),
      alt_vi: String(langData.vi?.alt || ''),
      alt_tl: String(langData.ph?.alt || langData.tl?.alt || '')
    });
    
    if (result.changes > 0) {
      console.log(`[DB] 更新案例：${caseId}`);
    }
  } catch (dbErr) {
    console.error('[DB] 更新案例失败：', dbErr.message);
  }
  
  const cases = readDataFile('cases.json', []);
  const index = cases.findIndex(c => c.id === caseId);
  if (index !== -1) {
    cases[index] = { ...cases[index], ...updatedItem };
    writeDataFile('cases.json', cases);
    res.json(cases[index]);
  } else {
    res.status(404).json({ error: 'Case not found' });
  }
});

app.delete('/api/cases/:id', (req, res) => {
  const caseId = parseInt(req.params.id);
  let deleted = false;
  
  // 优先从数据库删除
  try {
    const result = db.prepare('DELETE FROM cases WHERE id = ?').run(caseId);
    if (result.changes > 0) {
      deleted = true;
      console.log(`[DB] 删除案例：${caseId}`);
    }
  } catch (dbErr) {
    console.error('[DB] 删除案例失败：', dbErr.message);
  }
  
  // 同时从 JSON 删除（保持同步/备份）
  let cases = readDataFile('cases.json', []);
  const before = cases.length;
  cases = cases.filter(c => c.id !== caseId);
  if (cases.length < before) deleted = true;
  writeDataFile('cases.json', cases);
  
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Case not found' });
  }
});

// 前台兼容：/api/case-studies → 返回 {success, data} 格式（与 /api/cases 相同数据）
app.get('/api/case-studies', (req, res) => {
  // 优先从数据库读取
  try {
    const rows = db.prepare('SELECT * FROM cases ORDER BY created_at DESC').all();
    if (rows && rows.length > 0) {
      const cases = rows.map(row => ({
        id: row.id,
        slug: row.slug || '',
        date: row.date || '',
        status: row.status || 'draft',
        video: row.video || '',
        images: JSON.parse(row.images || '[]'),
        // 添加顶层字段，方便列表显示（使用英语作为默认）
        region: row.region_en || '',
        title: row.title_en || '',
        category: row.category_en || '',
        client: row.client_en || '',
        // 完整多语言数据（用于编辑）
        langData: {
          en: { region: row.region_en || '', category: row.category_en || '', client: row.client_en || '', title: row.title_en || '', content: row.content_en || '' },
          zh: { region: row.region_zh || '', category: row.category_zh || '', client: row.client_zh || '', title: row.title_zh || '', content: row.content_zh || '' },
          vi: { region: row.region_vi || '', category: row.category_vi || '', client: row.client_vi || '', title: row.title_vi || '', content: row.content_vi || '' },
          ph: { region: row.region_tl || '', category: row.category_tl || '', client: row.client_tl || '', title: row.title_tl || '', content: row.content_tl || '' }
        }
      }));
      return res.json({ success: true, data: cases });
    }
  } catch (dbErr) {
    console.error('[DB] 读取案例失败，fallback 到 JSON：', dbErr.message);
  }
  // 数据库失败或为空，fallback 到 JSON
  const cases = readDataFile('cases.json', []);
  res.json({ success: true, data: cases });
});

// ============ 视频上传接口（使用 MinIO） ============

app.post('/api/upload/video', uploadVideo.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '未检测到视频文件' });
  }

  if (uploadToMinIO) {
    const result = await uploadToMinIO(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (result.success) {
      return res.json({ success: true, url: result.url, filename: result.filename });
    }
    console.error('[Video Upload] MinIO upload failed, falling back to local:', result.error);
  }

  const url = `/case-uploads/${req.file.filename}`;
  res.json({ success: true, url });
});

// ============ 分类接口 ============

// 获取所有分类（优先数据库，fallback到JSON）
app.get('/api/categories', (req, res) => {
  console.log(req.query);
  // 优先从数据库读取
  try {
    const rows = db.prepare('SELECT * FROM categories ORDER BY id').all();
    console.log(rows);
    if (rows && rows.length > 0) {
      // 统计每个分类下的产品数（含下架产品）
      const categories = rows.map(c => {
        const productCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(c.id);
        return {
          ...c,
          description_en: c.description_en || '',
          description_zh: c.description_zh || '',
          description_vi: c.description_vi || '',
          description_tl: c.description_tl || '',
          productCount: productCount ? productCount.count : 0
        };
      });
      console.log(categories);
      return res.json(categories);
    }
  } catch (dbErr) {
    console.error('[DB] 读取分类失败，fallback 到 JSON：', dbErr.message);
  }
  
  // 数据库失败或为空，fallback到JSON
  const categories = readDataFile('categories.json', []);
  res.json(categories);
});

app.post('/api/categories', async (req, res) => {
  const rawId = req.body.id;
  let id;
  id = 'category-' + Date.now();
  
  const cleanBody = { ...req.body };
  Object.keys(cleanBody).forEach(key => {
    if (/_zh$|_vi$|_tl$/.test(key)) {
      delete cleanBody[key];
    }
  });
  
  const translated = await autoTranslateCategory(cleanBody, true);
  
  const newItem = {
    ...req.body,
    ...translated,
    id,
    name_en: translated.name_en || translated.name || req.body.name_en || req.body.Name_en || '',
    desc_en: translated.description_en || translated.desc_en || translated.description || translated.desc || req.body.desc_en || req.body.desc || req.body.description_en || req.body.description || '',
  };
  
  try {
    const stmt = db.prepare(`
      INSERT INTO categories (id, name_en, name_zh, name_vi, name_tl, description_en, description_zh, description_vi, description_tl)
      VALUES (@id, @name_en, @name_zh, @name_vi, @name_tl, @description_en, @description_zh, @description_vi, @description_tl)
    `);
    
    stmt.run({
      id: String(id),
      name_en: String(newItem.name_en || ''),
      name_zh: String(newItem.name_zh || ''),
      name_vi: String(newItem.name_vi || ''),
      name_tl: String(newItem.name_tl || ''),
      description_en: String(newItem.desc_en || newItem.description_en || ''),
      description_zh: String(newItem.description_zh || ''),
      description_vi: String(newItem.description_vi || ''),
      description_tl: String(newItem.description_tl || '')
    });
    
    console.log(`[DB] 创建分类：${id}`);
  } catch (dbErr) {
    console.error('[DB] 创建分类失败，fallback 到 JSON：', dbErr.message);
  }
  
  try {
    const categories = readDataFile('categories.json', []);
    categories.push(newItem);
    writeDataFile('categories.json', categories);
  } catch (jsonErr) {
    console.error('[JSON] 保存分类失败：', jsonErr.message);
  }
  
  res.json(newItem);
});

app.put('/api/categories/:id', async (req, res) => {
  const catId = String(req.params.id);
  
  const cleanBody = { ...req.body };
  Object.keys(cleanBody).forEach(key => {
    if (/_zh$|_vi$|_tl$/.test(key)) {
      delete cleanBody[key];
    }
  });
  
  const translated = await autoTranslateCategory(cleanBody, true);
  
  const updatedItem = {
    ...req.body,
    ...translated,
    name_en: translated.name_en || translated.name || req.body.name_en || req.body.Name_en || '',
    desc_en: translated.description_en || translated.desc_en || translated.description || translated.desc || req.body.desc_en || req.body.desc || req.body.description_en || req.body.description || '',
  };
  
  try {
    const stmt = db.prepare(`
      UPDATE categories SET
        name_en = @name_en,
        name_zh = @name_zh,
        name_vi = @name_vi,
        name_tl = @name_tl,
        description_en = @description_en,
        description_zh = @description_zh,
        description_vi = @description_vi,
        description_tl = @description_tl
      WHERE id = @id
    `);
    
    const result = stmt.run({
      id: catId,
      name_en: String(updatedItem.name_en || ''),
      name_zh: String(updatedItem.name_zh || ''),
      name_vi: String(updatedItem.name_vi || ''),
      name_tl: String(updatedItem.name_tl || ''),
      description_en: String(updatedItem.desc_en || updatedItem.description_en || ''),
      description_zh: String(updatedItem.description_zh || ''),
      description_vi: String(updatedItem.description_vi || ''),
      description_tl: String(updatedItem.description_tl || '')
    });
    
    if (result.changes > 0) {
      console.log(`[DB] 更新分类：${catId}`);
    }
  } catch (dbErr) {
    console.error('[DB] 更新分类失败，fallback 到 JSON：', dbErr.message);
  }
  
  try {
    const categories = readDataFile('categories.json', []);
    const index = categories.findIndex(c => String(c.id) === catId);
    if (index !== -1) {
      categories[index] = { ...categories[index], ...updatedItem };
      writeDataFile('categories.json', categories);
      return res.json(categories[index]);
    } else {
      return res.status(404).json({ error: 'Category not found' });
    }
  } catch (jsonErr) {
    console.error('[JSON] 更新分类失败：', jsonErr.message);
    return res.status(500).json({ error: jsonErr.message });
  }
});

app.delete('/api/categories/:id', (req, res) => {
  const catId = String(req.params.id);
  let deleted = false;
  
  // 优先从数据库删除
  try {
    const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
    const result = stmt.run(catId);
    if (result.changes > 0) {
      deleted = true;
      console.log(`[DB] 删除分类：${catId}`);
    }
  } catch (dbErr) {
    console.error('[DB] 删除分类失败，fallback 到 JSON：', dbErr.message);
  }
  
  // 同时从JSON删除（保持同步）
  try {
    let categories = readDataFile('categories.json', []);
    const cat = categories.find(c => String(c.id) === catId);
    if (!cat && !deleted) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const before = categories.length;
    categories = categories.filter(c => String(c.id) !== catId);
    if (categories.length < before) {
      deleted = true;
    }
    writeDataFile('categories.json', categories);
    
    // 同步删除该分类下的所有产品（匹配 category_id 或 category 字段）
    let products = readDataFile('products.json', []);
    const beforeProducts = products.length;
    products = products.filter(p => String(p.category_id) !== catId && String(p.category) !== catId);
    const deletedCount = beforeProducts - products.length;
    if (deletedCount > 0) {
      writeDataFile('products.json', products);
      // 同时从数据库删除这些产品
      try {
        const delStmt = db.prepare('DELETE FROM products WHERE category_id = ?');
        delStmt.run(catId);
      } catch (dbErr2) {
        console.error('[DB] 删除分类下产品失败：', dbErr2.message);
      }
    }
    
    return res.json({ success: true, deletedProducts: deletedCount });
  } catch (jsonErr) {
    console.error('[JSON] 删除分类失败：', jsonErr.message);
    if (deleted) {
      return res.json({ success: true, deletedProducts: 0 });
    }
    return res.status(500).json({ error: jsonErr.message });
  }
});

// ============ 应用场景接口 ============

app.get('/api/scenarios', (req, res) => {
  // 优先从数据库读取
  try {
    const rows = db.prepare('SELECT * FROM scenarios WHERE is_active = 1 ORDER BY order_num').all();
    if (rows && rows.length > 0) {
      const flat = rows.map(row => ({
        id: row.id,
        slug: (row.title_en || '').toLowerCase().replace(/\s+/g, '-') || '',
        image: row.image || '',
        images: row.image ? [row.image] : [],
        name_en: row.title_en || '',
        name_zh: row.title_zh || '',
        name_vi: row.title_vi || '',
        name_tl: row.title_tl || '',
        description_en: row.description_en || '',
        description_zh: row.description_zh || '',
        description_vi: row.description_vi || '',
        description_tl: row.description_tl || '',
        // 使用数据库的 products 字段（兼容前端的 materials 字段名）
        materials: JSON.parse(row.products || '[]')
      }));
      return res.json({ success: true, data: flat });
    }
  } catch (dbErr) {
    console.error('[DB] 读取应用场景失败，fallback 到 JSON：', dbErr.message);
  }
  // 数据库失败或为空，fallback 到 JSON
  const scenarios = readDataFile('scenarios.json', []);
  const flat = scenarios.map(s => ({
    id: s.id,
    slug: s.slug || s.name?.toLowerCase().replace(/\s+/g, '-') || '',
    image: Array.isArray(s.images) ? s.images[0] : s.image || '',
    images: s.images || [],
    name_en: s.langData?.en?.name || s.name || '',
    name_zh: s.langData?.zh?.name || '',
    name_vi: s.langData?.vi?.name || '',
    name_tl: s.langData?.ph?.name || s.langData?.tl?.name || '',
    description_en: s.langData?.en?.desc || s.desc || '',
    description_zh: s.langData?.zh?.desc || '',
    description_vi: s.langData?.vi?.desc || '',
    description_tl: s.langData?.ph?.desc || s.langData?.tl?.desc || '',
    materials: s.materials || []
  }));
  res.json({ success: true, data: flat });
});

// 统一保存格式：扁平 key → nested langData
function normalizeScenario(body) {
  return {
    id: body.id || Date.now(),
    name: body.name_en || body.name || '',
    desc: body.description_en || body.desc || '',
    slug: body.slug || '',
    image: body.image || '',
    images: body.images || [],
    langData: {
      en: { name: body.name_en || body.name || '', desc: body.description_en || body.desc || '' },
      zh: { name: body.name_zh || '', desc: body.description_zh || '' },
      vi: { name: body.name_vi || '', desc: body.description_vi || '' },
      ph: { name: body.name_tl || body.name_ph || '', desc: body.description_tl || body.description_ph || '' },
    },
    // 保留推荐材料
    materials: Array.isArray(body.materials) ? body.materials.map(m => ({
      id: m.id || String(Date.now()),
      name: m.name || m.name_en || '',
      desc: m.desc || m.description_en || '',
      langData: {
        en:  { name: m.name_en  || m.name || '', desc: m.description_en  || m.desc || '' },
        zh:  { name: m.name_zh  || '', desc: m.description_zh  || '' },
        vi:  { name: m.name_vi  || '', desc: m.description_vi  || '' },
        ph:  { name: m.name_tl  || m.name_ph || '', desc: m.description_tl  || m.description_ph || '' },
      }
    })) : []
  };
}

app.post('/api/scenarios', async (req, res) => {
  const newItem = normalizeScenario(req.body);
  const langData = req.body.langData || {};
  const topName = langData.en?.name || req.body.name_en || req.body.name || '';
  const topDesc = langData.en?.desc || req.body.description_en || req.body.desc || '';
  const productsData = JSON.stringify(req.body.products || req.body.materials || []);
  
  try {
    const stmt = db.prepare(`
      INSERT INTO scenarios (title_en, title_zh, title_vi, title_tl, description_en, description_zh, description_vi, description_tl, image, order_num, is_active, products)
      VALUES (@title_en, @title_zh, @title_vi, @title_tl, @description_en, @description_zh, @description_vi, @description_tl, @image, @order_num, @is_active, @products)
    `);
    const result = stmt.run({
      title_en: String(topName || ''),
      title_zh: String(langData.zh?.name || ''),
      title_vi: String(langData.vi?.name || ''),
      title_tl: String(langData.ph?.name || langData.tl?.name || ''),
      description_en: String(topDesc || ''),
      description_zh: String(langData.zh?.desc || ''),
      description_vi: String(langData.vi?.desc || ''),
      description_tl: String(langData.ph?.desc || langData.tl?.desc || ''),
      image: String(newItem.image || ''),
      order_num: parseInt(newItem.order_num) || 0,
      is_active: newItem.is_active !== false ? 1 : 0,
      products: productsData
    });
    newItem.id = result.lastInsertRowid;
    console.log(`[DB] 创建应用场景：${newItem.id}`);
  } catch (dbErr) {
    console.error('[DB] 创建应用场景失败：', dbErr.message);
    res.status(500).json({ error: dbErr.message });
    return;
  }
  
  const scenarios = readDataFile('scenarios.json', []);
  scenarios.push(newItem);
  writeDataFile('scenarios.json', scenarios);
  
  res.json({ success: true, data: newItem });
});

app.put('/api/scenarios/:id', async (req, res) => {
  const scenarioId = parseInt(req.params.id);
  // 先自动翻译所有空字段
  const translated = await autoTranslateScenario(req.body);
  const origLangData = req.body.langData || {};
  const topName = origLangData.en?.name || req.body.name_en || req.body.name || '';
  const topDesc = origLangData.en?.desc || req.body.description_en || req.body.desc || '';
  // 兼容 materials 和 products 字段名
  const productsData = JSON.stringify(translated.products || translated.materials || []);
  
  // 优先更新数据库
  try {
    const stmt = db.prepare(`
      UPDATE scenarios SET
        title_en = @title_en,
        title_zh = @title_zh,
        title_vi = @title_vi,
        title_tl = @title_tl,
        description_en = @description_en,
        description_zh = @description_zh,
        description_vi = @description_vi,
        description_tl = @description_tl,
        image = @image,
        order_num = @order_num,
        is_active = @is_active,
        products = @products
      WHERE id = @id
    `);
    
    const result = stmt.run({
      id: scenarioId,
      title_en: String(topName || translated.name_en || translated.title_en || ''),
      title_zh: String(origLangData.zh?.name || translated.name_zh || translated.title_zh || ''),
      title_vi: String(origLangData.vi?.name || translated.name_vi || translated.title_vi || ''),
      title_tl: String(origLangData.ph?.name || origLangData.tl?.name || translated.name_tl || translated.title_tl || ''),
      description_en: String(topDesc || translated.description_en || ''),
      description_zh: String(origLangData.zh?.desc || translated.description_zh || ''),
      description_vi: String(origLangData.vi?.desc || translated.description_vi || ''),
      description_tl: String(origLangData.ph?.desc || origLangData.tl?.desc || translated.description_tl || ''),
      image: translated.image || (Array.isArray(translated.images) ? translated.images[0] : '') || '',
      order_num: parseInt(translated.order_num) || 0,
      is_active: translated.is_active !== false ? 1 : 0,
      products: productsData
    });
    
    if (result.changes > 0) {
      console.log(`[DB] 更新应用场景：${scenarioId}`);
    }
  } catch (dbErr) {
    console.error('[DB] 更新应用场景失败：', dbErr.message);
  }
  
  // 同时更新 JSON（保持同步/备份）
  const scenarios = readDataFile('scenarios.json', []);
  const index = scenarios.findIndex(s => s.id === scenarioId);
  if (index !== -1) {
    const updated = normalizeScenario({ ...scenarios[index], ...req.body });
    scenarios[index] = updated;
    writeDataFile('scenarios.json', scenarios);
    res.json({ success: true, data: updated });
  } else {
    res.status(404).json({ error: 'Scenario not found' });
  }
});

app.delete('/api/scenarios/:id', (req, res) => {
  const scenarioId = parseInt(req.params.id);
  let deleted = false;
  
  // 优先从数据库删除（软删除，设置 is_active = 0）
  try {
    const result = db.prepare('UPDATE scenarios SET is_active = 0 WHERE id = ?').run(scenarioId);
    if (result.changes > 0) {
      deleted = true;
      console.log(`[DB] 删除应用场景：${scenarioId}`);
    }
  } catch (dbErr) {
    console.error('[DB] 删除应用场景失败：', dbErr.message);
  }
  
  // 同时从 JSON 删除（保持同步/备份）
  let scenarios = readDataFile('scenarios.json', []);
  const before = scenarios.length;
  scenarios = scenarios.filter(s => s.id !== scenarioId);
  if (scenarios.length < before) deleted = true;
  writeDataFile('scenarios.json', scenarios);
  
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Scenario not found' });
  }
});

// ============ 公司信息接口 ============

app.get('/api/company', (req, res) => {
  const company = readDataFile('company.json', {
    name: 'Jinyu Advertising Material Co., Ltd.',
    description: '',
    established: 2009,
    address: '',
    phone: '',
    email: '',
    website: ''
  });
  res.json(company);
});

app.post('/api/company', (req, res) => {
  const company = req.body;
  writeDataFile('company.json', company);
  res.json({ success: true });
});

// ============ About Us 接口（前台 about.html 使用） ============

app.get('/api/about', (_req, res) => {
  // 优先从数据库读取
  try {
    const rows = db.prepare('SELECT * FROM about').all();
    if (rows && rows.length > 0) {
      // 将数据库行转换为扁平格式（与 about.json 格式一致）
      const about = {};
      rows.forEach(row => {
        const key = row.key;
        // 尝试解析 JSON 字段（factory_images, team_members, capacity_cards 等）
        const fieldsToParse = ['factory_images', 'team_members', 'capacity_cards', 'certifications', 'timeline_image', 'factory_image', 'company_image'];
        
        if (fieldsToParse.includes(key)) {
          try {
            about[key] = JSON.parse(row.value_en || '[]');
          } catch {
            about[key] = row.value_en || '';
          }
          try {
            about[`${key}_zh`] = JSON.parse(row.value_zh || '[]');
          } catch {
            about[`${key}_zh`] = row.value_zh || '';
          }
          try {
            about[`${key}_vi`] = JSON.parse(row.value_vi || '[]');
          } catch {
            about[`${key}_vi`] = row.value_vi || '';
          }
          try {
            about[`${key}_tl`] = JSON.parse(row.value_tl || '[]');
          } catch {
            about[`${key}_tl`] = row.value_tl || '';
          }
        } else {
          about[key] = row.value_en || '';
          about[`${key}_zh`] = row.value_zh || '';
          about[`${key}_vi`] = row.value_vi || '';
          about[`${key}_tl`] = row.value_tl || '';
        }
      });
      
      // 从新的 team_members 表读取团队成员，覆盖 about 表的旧数据
      try {
        const tmRows = db.prepare('SELECT * FROM team_members WHERE visible = 1 ORDER BY order_num').all();
        const tmEn = tmRows.map(r => ({
          visible: true,
          name: r.name_en || '',
          role: r.role_en || '',
          desc: r.desc_en || '',
          photo: r.photo || '',
          color: r.color || '#2563eb',
          initial: r.initial || (r.name_en || '?')[0].toUpperCase(),
          email: r.email || '',
          name_zh: r.name_zh || '',
          role_zh: r.role_zh || '',
          desc_zh: r.desc_zh || '',
          name_vi: r.name_vi || '',
          role_vi: r.role_vi || '',
          desc_vi: r.desc_vi || '',
          name_tl: r.name_tl || '',
          role_tl: r.role_tl || '',
          desc_tl: r.desc_tl || '',
        }));
        about['team_members'] = tmEn;
        about['team_members_zh'] = tmRows.map(r => ({
          visible: true,
          name: r.name_zh || '',
          role: r.role_zh || '',
          desc: r.desc_zh || '',
          photo: r.photo || '',
          color: r.color || '#2563eb',
          initial: r.initial || (r.name_zh || '?')[0].toUpperCase(),
          email: r.email || '',
        }));
        about['team_members_vi'] = tmRows.map(r => ({
          visible: true,
          name: r.name_vi || '',
          role: r.role_vi || '',
          desc: r.desc_vi || '',
          photo: r.photo || '',
          color: r.color || '#2563eb',
          initial: r.initial || (r.name_vi || '?')[0].toUpperCase(),
          email: r.email || '',
        }));
        about['team_members_tl'] = tmRows.map(r => ({
          visible: true,
          name: r.name_tl || '',
          role: r.role_tl || '',
          desc: r.desc_tl || '',
          photo: r.photo || '',
          color: r.color || '#2563eb',
          initial: r.initial || (r.name_tl || '?')[0].toUpperCase(),
          email: r.email || '',
        }));
      } catch (tmErr) {
        console.error('[DB] 读取 team_members 表失败：', tmErr.message);
      }
      
      // 补充数组字段（数据库键值存储不支持数组，从 about.json 读取）
      try {
        const jsonData = readDataFile('about.json', {});
        const arrayFields = ['factory_images', 'milestones', 'capacity_cards', 'certifications', 'team_members', 'team_members_zh', 'team_members_vi', 'team_members_tl'];
        arrayFields.forEach(field => {
          if (!about[field] || about[field].length === 0) {
            about[field] = jsonData[field] || [];
          }
        });
      } catch (jsonErr) {
        console.error('[DB] 从 about.json 补充数组字段失败：', jsonErr.message);
      }
      
      return res.json({ success: true, data: about });
    }
  } catch (dbErr) {
    console.error('[DB] 读取 About 数据失败，fallback 到 JSON：', dbErr.message);
  }
  // 数据库失败或为空，fallback 到 JSON
  const about = readDataFile('about.json', {});
  res.json({ success: true, data: about });
});

// ============ About 新增保存接口（自动翻译） ============
app.post('/api/about', (req, res) => {
  const about = req.body;
  const isArrayFormat = Array.isArray(about);
  
  const cleanAbout = { ...about };
  Object.keys(cleanAbout).forEach(key => {
    if (/_zh$|_vi$|_tl$/.test(key)) {
      delete cleanAbout[key];
    }
  });
  
  const cleanArrayItems = (arr) => {
    if (!Array.isArray(arr)) return arr;
    return arr.map(item => {
      if (typeof item !== 'object' || item === null) return item;
      const cleaned = { ...item };
      Object.keys(cleaned).forEach(key => {
        if (/_zh$|_vi$|_tl$/.test(key)) {
          delete cleaned[key];
        }
      });
      return cleaned;
    });
  };
  
  if (cleanAbout.team_members && Array.isArray(cleanAbout.team_members)) {
    cleanAbout.team_members = cleanArrayItems(cleanAbout.team_members);
  }
  if (cleanAbout.capacity_cards && Array.isArray(cleanAbout.capacity_cards)) {
    cleanAbout.capacity_cards = cleanArrayItems(cleanAbout.capacity_cards);
  }

  const getValue = (v) => typeof v === 'string' ? v : JSON.stringify(v);

  try {
    db.prepare('DELETE FROM about').run();
    
    const stmt = db.prepare('INSERT INTO about (section, key, value_en, value_zh, value_vi, value_tl) VALUES (@section, @key, @value_en, @value_zh, @value_vi, @value_tl)');
    const processedKeys = new Set();
    
    Object.entries(cleanAbout).forEach(([key, value]) => {
      if (key === 'team_members' || key.startsWith('team_members_')) return;
      const baseKey = key.replace(/_(zh|vi|tl)$/, '');
      if (baseKey !== key) {
        if (processedKeys.has(baseKey)) return;
        processedKeys.add(baseKey);
        stmt.run({
          section: 'main', key: baseKey,
          value_en: getValue(cleanAbout[baseKey]),
          value_zh: '', value_vi: '', value_tl: ''
        });
      } else {
        if (processedKeys.has(key)) return;
        processedKeys.add(key);
        stmt.run({
          section: 'main', key: key,
          value_en: getValue(value),
          value_zh: '', value_vi: '', value_tl: ''
        });
      }
    });
    
    db.prepare('DELETE FROM team_members').run();
    
    const tmArray = isArrayFormat ? cleanAbout : (cleanAbout['team_members'] || []);
    if (Array.isArray(tmArray) && tmArray.length > 0) {
      const tmStmt = db.prepare('INSERT INTO team_members (slug, visible, order_num, name_en, name_zh, name_vi, name_tl, role_en, role_zh, role_vi, role_tl, desc_en, desc_zh, desc_vi, desc_tl, photo, email, color, initial) VALUES (@slug, @visible, @order_num, @name_en, @name_zh, @name_vi, @name_tl, @role_en, @role_zh, @role_vi, @role_tl, @desc_en, @desc_zh, @desc_vi, @desc_tl, @photo, @email, @color, @initial)');
      
      tmArray.forEach((m, i) => {
        try {
          const nameEn = String(m.name_en || m.name || '');
          const slug = nameEn.toLowerCase().replace(/\s+/g, '-') || 'member-' + (i+1);
          const initialChar = (m.initial && typeof m.initial === 'string' && m.initial[0]) || nameEn[0] || '?';
          tmStmt.run({
            slug, visible: m.visible !== false ? 1 : 0, order_num: i,
            name_en: nameEn, name_zh: '', name_vi: '', name_tl: '',
            role_en: String(m.role_en || m.role || ''), role_zh: '', role_vi: '', role_tl: '',
            desc_en: String(m.desc_en || m.desc || ''), desc_zh: '', desc_vi: '', desc_tl: '',
            photo: String(m.photo || ''), email: String(m.email || ''),
            color: String(m.color || '#2563eb'), initial: String(initialChar).toUpperCase()
          });
        } catch (insertErr) {
          console.error('[DB] 插入团队成员失败：', insertErr.message);
        }
      });
    }
    
    writeDataFile('about.json', cleanAbout);
    res.json({ success: true, message: 'Data saved, translation in progress' });
  } catch (dbErr) {
    console.error('[DB] 保存 About 数据失败：', dbErr.message);
    res.status(500).json({ success: false, error: dbErr.message });
    return;
  }
  
  setImmediate(async () => {
    try {
      const translated = await autoTranslateAbout(cleanAbout, true);
      
      db.prepare('DELETE FROM about').run();
      db.prepare('DELETE FROM team_members').run();
      
      const getValue = (v) => typeof v === 'string' ? v : JSON.stringify(v);
      const processedKeys = new Set();
      const stmt = db.prepare('INSERT INTO about (section, key, value_en, value_zh, value_vi, value_tl) VALUES (@section, @key, @value_en, @value_zh, @value_vi, @value_tl)');
      
      Object.entries(translated).forEach(([key, value]) => {
        if (key === 'team_members' || key.startsWith('team_members_')) return;
        const baseKey = key.replace(/_(zh|vi|tl)$/, '');
        if (baseKey !== key) {
          if (processedKeys.has(baseKey)) return;
          processedKeys.add(baseKey);
          stmt.run({
            section: 'main', key: baseKey,
            value_en: getValue(translated[baseKey]),
            value_zh: getValue(translated[`${baseKey}_zh`]),
            value_vi: getValue(translated[`${baseKey}_vi`]),
            value_tl: getValue(translated[`${baseKey}_tl`])
          });
        } else {
          if (processedKeys.has(key)) return;
          processedKeys.add(key);
          stmt.run({
            section: 'main', key: key,
            value_en: getValue(value),
            value_zh: getValue(translated[`${key}_zh`]),
            value_vi: getValue(translated[`${key}_vi`]),
            value_tl: getValue(translated[`${key}_tl`])
          });
        }
      });
      
      const tmArray = isArrayFormat ? translated : (translated['team_members'] || []);
      if (Array.isArray(tmArray) && tmArray.length > 0) {
        const tmStmt = db.prepare('INSERT INTO team_members (slug, visible, order_num, name_en, name_zh, name_vi, name_tl, role_en, role_zh, role_vi, role_tl, desc_en, desc_zh, desc_vi, desc_tl, photo, email, color, initial) VALUES (@slug, @visible, @order_num, @name_en, @name_zh, @name_vi, @name_tl, @role_en, @role_zh, @role_vi, @role_tl, @desc_en, @desc_zh, @desc_vi, @desc_tl, @photo, @email, @color, @initial)');
        
        tmArray.forEach((m, i) => {
          try {
            const nameEn = String(m.name_en || m.name || '');
            const slug = nameEn.toLowerCase().replace(/\s+/g, '-') || 'member-' + (i+1);
            const initialChar = (m.initial && typeof m.initial === 'string' && m.initial[0]) || nameEn[0] || '?';
            tmStmt.run({
              slug, visible: m.visible !== false ? 1 : 0, order_num: i,
              name_en: nameEn, name_zh: String(m.name_zh || ''), name_vi: String(m.name_vi || ''), name_tl: String(m.name_tl || ''),
              role_en: String(m.role_en || m.role || ''), role_zh: String(m.role_zh || ''), role_vi: String(m.role_vi || ''), role_tl: String(m.role_tl || ''),
              desc_en: String(m.desc_en || m.desc || ''), desc_zh: String(m.desc_zh || ''), desc_vi: String(m.desc_vi || ''), desc_tl: String(m.desc_tl || ''),
              photo: String(m.photo || ''), email: String(m.email || ''),
              color: String(m.color || '#2563eb'), initial: String(initialChar).toUpperCase()
            });
          } catch (e) { console.error('[BG] 翻译后保存团队成员失败：', e.message); }
        });
      }
      
      writeDataFile('about.json', translated);
      console.log('[BG] About 翻译完成并保存');
    } catch (e) {
      console.error('[BG] About 翻译失败：', e.message);
    }
  });
});

app.put('/api/about', (req, res) => {
  const about = req.body;
  const isArrayFormat = Array.isArray(about);
  
  const cleanAbout = { ...about };
  Object.keys(cleanAbout).forEach(key => {
    if (/_zh$|_vi$|_tl$/.test(key)) {
      delete cleanAbout[key];
    }
  });
  if (cleanAbout.team_members && Array.isArray(cleanAbout.team_members)) {
    cleanAbout.team_members = cleanAbout.team_members.map(m => {
      const cleaned = { ...m };
      Object.keys(cleaned).forEach(key => {
        if (/_zh$|_vi$|_tl$/.test(key)) {
          delete cleaned[key];
        }
      });
      return cleaned;
    });
  }

  const getValue = (v) => typeof v === 'string' ? v : JSON.stringify(v);

  try {
    db.prepare('DELETE FROM about').run();
    const stmt = db.prepare('INSERT INTO about (section, key, value_en, value_zh, value_vi, value_tl) VALUES (@section, @key, @value_en, @value_zh, @value_vi, @value_tl)');
    const processedKeys = new Set();
    
    Object.entries(cleanAbout).forEach(([key, value]) => {
      if (key === 'team_members' || key.startsWith('team_members_')) return;
      const baseKey = key.replace(/_(zh|vi|tl)$/, '');
      if (baseKey !== key) {
        if (processedKeys.has(baseKey)) return;
        processedKeys.add(baseKey);
        stmt.run({
          section: 'main', key: baseKey,
          value_en: getValue(cleanAbout[baseKey]),
          value_zh: '', value_vi: '', value_tl: ''
        });
      } else {
        if (processedKeys.has(key)) return;
        processedKeys.add(key);
        stmt.run({
          section: 'main', key: key,
          value_en: getValue(value),
          value_zh: '', value_vi: '', value_tl: ''
        });
      }
    });
    
    db.prepare('DELETE FROM team_members').run();
    
    const tmArray = isArrayFormat ? cleanAbout : (cleanAbout['team_members'] || []);
    if (Array.isArray(tmArray) && tmArray.length > 0) {
      const tmStmt = db.prepare('INSERT INTO team_members (slug, visible, order_num, name_en, name_zh, name_vi, name_tl, role_en, role_zh, role_vi, role_tl, desc_en, desc_zh, desc_vi, desc_tl, photo, email, color, initial) VALUES (@slug, @visible, @order_num, @name_en, @name_zh, @name_vi, @name_tl, @role_en, @role_zh, @role_vi, @role_tl, @desc_en, @desc_zh, @desc_vi, @desc_tl, @photo, @email, @color, @initial)');
      
      tmArray.forEach((m, i) => {
        try {
          const nameEn = String(m.name_en || m.name || '');
          const slug = nameEn.toLowerCase().replace(/\s+/g, '-') || 'member-' + (i+1);
          const initialChar = (m.initial && typeof m.initial === 'string' && m.initial[0]) || nameEn[0] || '?';
          tmStmt.run({
            slug, visible: m.visible !== false ? 1 : 0, order_num: i,
            name_en: nameEn, name_zh: '', name_vi: '', name_tl: '',
            role_en: String(m.role_en || m.role || ''), role_zh: '', role_vi: '', role_tl: '',
            desc_en: String(m.desc_en || m.desc || ''), desc_zh: '', desc_vi: '', desc_tl: '',
            photo: String(m.photo || ''), email: String(m.email || ''),
            color: String(m.color || '#2563eb'), initial: String(initialChar).toUpperCase()
          });
        } catch (e) { console.error('[DB] 插入团队成员失败：', e.message); }
      });
    }
    
    writeDataFile('about.json', cleanAbout);
    res.json({ success: true, message: 'Data saved, translation in progress' });
  } catch (dbErr) {
    console.error('[DB] 保存 About 数据失败：', dbErr.message);
    res.status(500).json({ success: false, error: dbErr.message });
    return;
  }
  
  setImmediate(async () => {
    try {
      const translated = await autoTranslateAbout(cleanAbout, true);
      
      db.prepare('DELETE FROM about').run();
      db.prepare('DELETE FROM team_members').run();
      
      const getValue = (v) => typeof v === 'string' ? v : JSON.stringify(v);
      const processedKeys = new Set();
      const stmt = db.prepare('INSERT INTO about (section, key, value_en, value_zh, value_vi, value_tl) VALUES (@section, @key, @value_en, @value_zh, @value_vi, @value_tl)');
      
      Object.entries(translated).forEach(([key, value]) => {
        if (key === 'team_members' || key.startsWith('team_members_')) return;
        const baseKey = key.replace(/_(zh|vi|tl)$/, '');
        if (baseKey !== key) {
          if (processedKeys.has(baseKey)) return;
          processedKeys.add(baseKey);
          stmt.run({
            section: 'main', key: baseKey,
            value_en: getValue(translated[baseKey]),
            value_zh: getValue(translated[`${baseKey}_zh`]),
            value_vi: getValue(translated[`${baseKey}_vi`]),
            value_tl: getValue(translated[`${baseKey}_tl`])
          });
        } else {
          if (processedKeys.has(key)) return;
          processedKeys.add(key);
          stmt.run({
            section: 'main', key: key,
            value_en: getValue(value),
            value_zh: getValue(translated[`${key}_zh`]),
            value_vi: getValue(translated[`${key}_vi`]),
            value_tl: getValue(translated[`${key}_tl`])
          });
        }
      });
      
      const tmArray = isArrayFormat ? translated : (translated['team_members'] || []);
      if (Array.isArray(tmArray) && tmArray.length > 0) {
        const tmStmt = db.prepare('INSERT INTO team_members (slug, visible, order_num, name_en, name_zh, name_vi, name_tl, role_en, role_zh, role_vi, role_tl, desc_en, desc_zh, desc_vi, desc_tl, photo, email, color, initial) VALUES (@slug, @visible, @order_num, @name_en, @name_zh, @name_vi, @name_tl, @role_en, @role_zh, @role_vi, @role_tl, @desc_en, @desc_zh, @desc_vi, @desc_tl, @photo, @email, @color, @initial)');
        
        tmArray.forEach((m, i) => {
          try {
            const nameEn = String(m.name_en || m.name || '');
            const slug = nameEn.toLowerCase().replace(/\s+/g, '-') || 'member-' + (i+1);
            const initialChar = (m.initial && typeof m.initial === 'string' && m.initial[0]) || nameEn[0] || '?';
            tmStmt.run({
              slug, visible: m.visible !== false ? 1 : 0, order_num: i,
              name_en: nameEn, name_zh: String(m.name_zh || ''), name_vi: String(m.name_vi || ''), name_tl: String(m.name_tl || ''),
              role_en: String(m.role_en || m.role || ''), role_zh: String(m.role_zh || ''), role_vi: String(m.role_vi || ''), role_tl: String(m.role_tl || ''),
              desc_en: String(m.desc_en || m.desc || ''), desc_zh: String(m.desc_zh || ''), desc_vi: String(m.desc_vi || ''), desc_tl: String(m.desc_tl || ''),
              photo: String(m.photo || ''), email: String(m.email || ''),
              color: String(m.color || '#2563eb'), initial: String(initialChar).toUpperCase()
            });
          } catch (e) { console.error('[BG] 翻译后保存团队成员失败：', e.message); }
        });
      }
      
      writeDataFile('about.json', translated);
      console.log('[BG] About 翻译完成并保存');
    } catch (e) {
      console.error('[BG] About 翻译失败：', e.message);
    }
  });
});

// About 图片上传（使用 MinIO + 压缩）
app.post('/api/about/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // 压缩图片
  let fileBuffer = req.file.buffer;
  let originalSize = fileBuffer.length;
  if (sharp) {
    fileBuffer = await compressImage(fileBuffer, req.file.mimetype);
    const compressedSize = fileBuffer.length;
    if (compressedSize < originalSize) {
      console.log(`[Image] 压缩完成: ${(originalSize / 1024).toFixed(1)}KB -> ${(compressedSize / 1024).toFixed(1)}KB (节省 ${((1 - compressedSize / originalSize) * 100).toFixed(1)}%)`);
    }
  }

  if (uploadToMinIO) {
    const result = await uploadToMinIO(fileBuffer, req.file.originalname, req.file.mimetype);
    if (result.success) {
      return res.json({ success: true, url: result.url, filename: result.filename });
    }
    console.error('[Upload] MinIO upload failed, falling back to local:', result.error);
  }

  // MinIO 不可用时，保存到本地磁盘
  const localFilename = await saveImageToDisk(fileBuffer, req.file.originalname);
  if (localFilename) {
    res.json({ success: true, url: `/about-uploads/${localFilename}`, filename: localFilename });
  } else {
    res.status(500).json({ error: 'Failed to save image' });
  }
});

// About 图片列表
app.get('/api/about/images', (_req, res) => {
  try {
    const files = readdirSync(UPLOADS_DIR);
    const images = files.filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f))
      .map(f => ({ name: f, url: `/about-uploads/${f}` }));
    res.json(images);
  } catch { res.json([]); }
});

// 删除 About 图片
app.delete('/api/about/images/:name', (req, res) => {
  const filePath = join(UPLOADS_DIR, req.params.name);
  try { unlinkSync(filePath); res.json({ success: true }); }
  catch { res.status(404).json({ error: 'File not found' }); }
});

// ============ 账号接口 ============

app.get('/api/auth', (req, res) => {
  // 优先从数据库读取
  try {
    const rows = db.prepare('SELECT * FROM accounts').all();
    if (rows && rows.length > 0) {
      // 返回不包含密码的账号列表
      const safeAccounts = rows.map(row => ({
        id: row.id,
        username: row.username || '',
        role: row.role || 'editor',
        createdAt: row.created_at || ''
      }));
      return res.json(safeAccounts);
    }
  } catch (dbErr) {
    console.error('[DB] 读取账号失败，fallback 到 JSON：', dbErr.message);
  }
  // 数据库失败或为空，fallback 到 JSON
  const accounts = readDataFile('accounts.json', [
    {
      id: 1,
      username: 'admin',
      password: btoa('admin123'),
      role: 'admin',
      createdAt: new Date().toISOString()
    }
  ]);
  // 返回不包含密码的账号列表
  const safeAccounts = accounts.map(({ password, ...rest }) => rest);
  res.json(safeAccounts);
});

app.post('/api/auth/login', checkLoginRate, (req, res) => {
  const { username, password } = req.body;
  
  // 优先从数据库查找
  try {
    const row = db.prepare('SELECT * FROM accounts WHERE username = ? AND password = ?').get(username, btoa(password));
    if (row) {
      const { password: _, ...safeUser } = row;
      const token = jwt.sign({ id: safeUser.id, username: safeUser.username, role: safeUser.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
      return res.json({ success: true, user: safeUser, token });
    }
  } catch (dbErr) {
    console.error('[DB] 登录查询失败：', dbErr.message);
  }
  
  // 数据库失败或没找到，fallback 到 JSON
  const accounts = readDataFile('accounts.json', []);
  
  // 如果没有账号，创建一个默认的
  if (accounts.length === 0) {
    const defaultAccount = {
      id: 1,
      username: 'admin',
      password: btoa('admin123'),
      role: 'admin',
      createdAt: new Date().toISOString()
    };
    writeDataFile('accounts.json', [defaultAccount]);
    
    if (username === 'admin' && password === 'admin123') {
      const safeUser = { id: 1, username: 'admin', role: 'admin' };
      const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
      return res.json({ success: true, user: safeUser, token });
    }
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  
  const account = accounts.find(a => a.username === username && a.password === btoa(password));
  if (account) {
    const { password: _, ...safeUser } = account;
    const token = jwt.sign({ id: safeUser.id, username: safeUser.username, role: safeUser.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.json({ success: true, user: safeUser, token });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, role = 'editor' } = req.body;
  
  // 优先保存到数据库
  try {
    const stmt = db.prepare(`
      INSERT INTO accounts (username, password, role)
      VALUES (@username, @password, @role)
    `);
    const result = stmt.run({
      username: String(username || ''),
      password: btoa(String(password || '')),
      role: String(role || 'editor')
    });
    
    const newAccount = {
      id: result.lastInsertRowid,
      username,
      role,
      createdAt: new Date().toISOString()
    };
    
    console.log(`[DB] 创建账号：${username}`);
    
    // 同时保存到 JSON（保持同步/备份）
    const accounts = readDataFile('accounts.json', []);
    accounts.push(newAccount);
    writeDataFile('accounts.json', accounts);
    
    const { password: _, ...safeUser } = newAccount;
    return res.json({ success: true, user: safeUser });
  } catch (dbErr) {
    // 如果是唯一约束违反（用户名已存在）
    if (dbErr.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }
    console.error('[DB] 创建账号失败，fallback 到 JSON：', dbErr.message);
  }
  
  // 数据库失败，fallback 到 JSON
  const accounts = readDataFile('accounts.json', []);
  
  if (accounts.find(a => a.username === username)) {
    return res.status(400).json({ success: false, error: 'Username already exists' });
  }
  
  const newAccount = {
    id: Date.now(),
    username,
    password: btoa(password),
    role,
    createdAt: new Date().toISOString()
  };
  accounts.push(newAccount);
  writeDataFile('accounts.json', accounts);
  
  const { password: _, ...safeUser } = newAccount;
  res.json({ success: true, user: safeUser });
});

// 获取账号密码（仅用于管理页面显示旧密码）
app.get('/api/auth/accounts/:id/password', (req, res) => {
  // 优先从数据库读取
  try {
    const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(parseInt(req.params.id));
    if (row) {
      try {
        res.json({ password: atob(row.password || '') });
      } catch (e) {
        res.json({ password: '(无法解码)' });
      }
      return;
    }
  } catch (dbErr) {
    console.error('[DB] 读取账号失败，fallback 到 JSON：', dbErr.message);
  }
  
  // 数据库失败或没找到，fallback 到 JSON
  const accounts = readDataFile('accounts.json', []);
  const account = accounts.find(a => a.id === parseInt(req.params.id));
  if (account) {
    try {
      res.json({ password: atob(account.password || '') });
    } catch (e) {
      res.json({ password: '(无法解码)' });
    }
  } else {
    res.status(404).json({ error: 'Account not found' });
  }
});

app.put('/api/auth/accounts/:id', (req, res) => {
  const accountId = parseInt(req.params.id);
  
  // 优先更新数据库
  try {
    const stmt = db.prepare(`
      UPDATE accounts SET
        password = @password,
        role = @role
      WHERE id = @id
    `);
    
    const params = {
      id: accountId,
      password: req.body.password ? btoa(String(req.body.password)) : db.prepare('SELECT password FROM accounts WHERE id = ?').get(accountId)?.password || '',
      role: String(req.body.role || 'editor')
    };
    
    const result = stmt.run(params);
    
    if (result.changes > 0) {
      console.log(`[DB] 更新账号：${accountId}`);
    }
  } catch (dbErr) {
    console.error('[DB] 更新账号失败：', dbErr.message);
  }
  
  // 同时更新 JSON（保持同步/备份）
  const accounts = readDataFile('accounts.json', []);
  const index = accounts.findIndex(a => a.id === accountId);
  if (index !== -1) {
    if (req.body.password) {
      accounts[index].password = btoa(req.body.password);
    }
    if (req.body.role) {
      accounts[index].role = req.body.role;
    }
    writeDataFile('accounts.json', accounts);
    const { password: _, ...safeUser } = accounts[index];
    return res.json({ success: true, user: safeUser });
  } else {
    return res.status(404).json({ error: 'Account not found' });
  }
});

app.delete('/api/auth/accounts/:id', (req, res) => {
  const accountId = parseInt(req.params.id);
  let deleted = false;
  
  // 优先从数据库删除
  try {
    const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
    if (result.changes > 0) {
      deleted = true;
      console.log(`[DB] 删除账号：${accountId}`);
    }
  } catch (dbErr) {
    console.error('[DB] 删除账号失败：', dbErr.message);
  }
  
  // 同时从 JSON 删除（保持同步/备份）
  let accounts = readDataFile('accounts.json', []);
  const before = accounts.length;
  accounts = accounts.filter(a => a.id !== accountId);
  if (accounts.length < before) deleted = true;
  writeDataFile('accounts.json', accounts);
    
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Account not found' });
  }
});

// ============ 统计汇总接口 ============

// GET /api/stats - 返回真实统计数据
app.get('/api/stats', (req, res) => {
  // 优先从数据库读取
  let productsCount = 0, categoriesCount = 0, newsCount = 0, contacts = [], todayVisits = 0;
  
  try {
    productsCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count || 0;
    categoriesCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count || 0;
    newsCount = db.prepare('SELECT COUNT(*) as count FROM news').get().count || 0;
    contacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all() || [];
  } catch (dbErr) {
    console.error('[DB] 读取统计数据失败，fallback 到 JSON：', dbErr.message);
  }
  
  // 数据库失败或为空，fallback 到 JSON
  if (productsCount === 0 && categoriesCount === 0 && newsCount === 0 && contacts.length === 0) {
    productsCount = readDataFile('products.json', []).length;
    categoriesCount = readDataFile('categories.json', []).length;
    newsCount = readDataFile('news.json', []).length;
    contacts = readDataFile('contacts.json', []);
  }
  
  // 今日日期
  const today = new Date().toISOString().slice(0, 10);
  const todayContacts = contacts.filter(c => c.date && c.date.startsWith(today));
  const unreadContacts = contacts.filter(c => c.is_read === 0 || c.isRead === false);
  
  // 访问量统计 - 前台 server.js 写入格式: { daily: {YYYY-MM-DD: count}, monthly: {YYYY-MM: count} }
  const rawPageviews = readDataFile('pageviews.json', {});
  // 兼容两种格式：带 daily 嵌套 或 直接 {date: count}
  const dailyData = (rawPageviews.daily && typeof rawPageviews.daily === 'object')
    ? rawPageviews.daily
    : rawPageviews;
  
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  // 按月聚合访问量（从 daily 数据汇总）
  const monthlyVisits = {};
  Object.entries(dailyData).forEach(([date, count]) => {
    if (typeof count === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(date) >= sixMonthsAgo) {
      const month = date.slice(0, 7); // YYYY-MM
      monthlyVisits[month] = monthlyVisits[month] || { visits: 0, inquiries: 0 };
      monthlyVisits[month].visits += count;
    }
  });
  
  // 将询盘按月统计，确保即使没有访问量数据也能显示询盘柱状图
  contacts.forEach(c => {
    if (c.date && /^\d{4}-\d{2}/.test(c.date)) {
      const month = c.date.slice(0, 7);
      if (new Date(month + '-01') >= sixMonthsAgo) {
        if (!monthlyVisits[month]) monthlyVisits[month] = { visits: 0, inquiries: 0 };
        monthlyVisits[month].inquiries = (monthlyVisits[month].inquiries || 0) + 1;
      }
    }
  });
  
  // 按周聚合（最近7天）
  const weeklyVisits = {};
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayName = `周${dayNames[d.getDay()]}`;
    weeklyVisits[dayName] = dailyData[dateStr] || 0;
  }
  
  // 今日访问量
  todayVisits = dailyData[today] || 0;
  
  res.json({
    products: productsCount,
    categories: categoriesCount,
    news: newsCount,
    contacts: contacts.length,
    unreadContacts: unreadContacts.length,
    todayContacts: todayContacts.length,
    todayVisits,
    monthlyVisits: Object.entries(monthlyVisits)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        name: month.slice(5) + '月', // MM月
        visits: typeof data === 'number' ? data : (data.visits || 0),
        inquiries: typeof data === 'number'
          ? contacts.filter(c => c.date && c.date.startsWith(month)).length
          : (data.inquiries || 0)
      })),
    weeklyVisits: Object.entries(weeklyVisits).map(([name, visits]) => ({ name, visits })),
  });
});

// SPA fallback - 所有未匹配的路由返回 index.html

// 静态文件托管（必须放在 API 路由之后）
app.use(express.static(join(__dirname, 'dist')));

// 图片上传目录
app.use('/about-uploads', express.static(UPLOADS_DIR));
app.use('/case-uploads', express.static(CASE_UPLOADS_DIR));
app.use('/product-images', express.static(PRODUCT_IMAGES_DIR));

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
console.log('=== SERVER START ===');
