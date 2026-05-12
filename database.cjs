let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('[DB] better-sqlite3 加载失败，将使用 JSON 文件模式：', e.message);
  Database = null;
}
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, 'data', 'jinyu.db');
console.log('[DB] 数据库路径:', dbPath);

let db = null;
if (Database) {
  try {
    db = new Database(dbPath);
    // 启用 WAL 模式（提升并发性能）
    db.pragma('journal_mode = WAL');
  } catch (e) {
    console.error('[DB] 数据库连接失败，将使用 JSON 文件模式：', e.message);
    db = null;
  }
}

// 如果 db 可用，初始化表；否则跳过
if (db) {
  // 创建 products 表（如果不存在）
  db.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name_en TEXT,
      name_zh TEXT,
      name_vi TEXT,
      name_tl TEXT,
      category_id TEXT,
      description_en TEXT,
      description_zh TEXT,
      description_vi TEXT,
      description_tl TEXT,
      specs TEXT,
      features_en TEXT,
      features_zh TEXT,
      features_vi TEXT,
      features_tl TEXT,
      images TEXT,
      main_image INTEGER DEFAULT 0,
      img TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 创建 categories 表（如果不存在）
  db.prepare(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name_en TEXT,
      name_zh TEXT,
      name_vi TEXT,
      name_tl TEXT,
      description_en TEXT,
      description_zh TEXT,
      description_vi TEXT,
      description_tl TEXT
    )
  `).run();

  // 创建 news 表（如果不存在）
  db.prepare(`
    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY,
      date TEXT,
      status TEXT DEFAULT 'draft',
      views INTEGER DEFAULT 0,
      images TEXT,
      category TEXT,
      title_en TEXT,
      title_zh TEXT,
      title_vi TEXT,
      title_tl TEXT,
      slug_en TEXT,
      slug_zh TEXT,
      slug_vi TEXT,
      slug_tl TEXT,
      content_en TEXT,
      content_zh TEXT,
      content_vi TEXT,
      content_tl TEXT,
      seo_title_en TEXT,
      seo_title_zh TEXT,
      seo_title_vi TEXT,
      seo_title_tl TEXT,
      alt_en TEXT,
      alt_zh TEXT,
      alt_vi TEXT,
      alt_tl TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 创建 cases 表（如果不存在）
  db.prepare(`
    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE,
      region_en TEXT,
      region_zh TEXT,
      region_vi TEXT,
      region_tl TEXT,
      category_en TEXT,
      category_zh TEXT,
      category_vi TEXT,
      category_tl TEXT,
      date TEXT,
      video TEXT,
      images TEXT,
      client_en TEXT,
      client_zh TEXT,
      client_vi TEXT,
      client_tl TEXT,
      status TEXT DEFAULT 'draft',
      title_en TEXT,
      title_zh TEXT,
      title_vi TEXT,
      title_tl TEXT,
      content_en TEXT,
      content_zh TEXT,
      content_vi TEXT,
      content_tl TEXT,
      outcomes_en TEXT,
      outcomes_zh TEXT,
      outcomes_vi TEXT,
      outcomes_tl TEXT,
      materials_en TEXT,
      materials_zh TEXT,
      materials_vi TEXT,
      materials_tl TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 创建 scenarios 表（如果不存在）
  db.prepare(`
    CREATE TABLE IF NOT EXISTS scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image TEXT,
      order_num INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      title_en TEXT,
      title_zh TEXT,
      title_vi TEXT,
      title_tl TEXT,
      description_en TEXT,
      description_zh TEXT,
      description_vi TEXT,
      description_tl TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      products TEXT
    )
  `).run();

  // 创建 about 表（如果不存在）
  db.prepare(`
    CREATE TABLE IF NOT EXISTS about (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT,
      key TEXT,
      value_en TEXT,
      value_zh TEXT,
      value_vi TEXT,
      value_tl TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 创建 contacts 表（如果不存在）
  db.prepare(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      company TEXT,
      product TEXT,
      message TEXT,
      lang TEXT DEFAULT 'en',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 创建 social_links 表（如果不存在）
  db.prepare(`
    CREATE TABLE IF NOT EXISTS social_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT UNIQUE,
      url TEXT,
      icon TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 创建 translations 表（如果不存在）
  db.prepare(`
    CREATE TABLE IF NOT EXISTS translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lang TEXT,
      key TEXT,
      value TEXT,
      UNIQUE(lang, key)
    )
  `).run();

  // 创建 accounts 表（如果不存在）
  db.prepare(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'editor',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 创建 team_members 表（如果不存在）
  db.prepare(`
    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE,
      visible INTEGER DEFAULT 1,
      order_num INTEGER DEFAULT 0,
      name_en TEXT,
      name_zh TEXT,
      name_vi TEXT,
      name_tl TEXT,
      role_en TEXT,
      role_zh TEXT,
      role_vi TEXT,
      role_tl TEXT,
      desc_en TEXT,
      desc_zh TEXT,
      desc_vi TEXT,
      desc_tl TEXT,
      photo TEXT,
      email TEXT,
      color TEXT DEFAULT '#2563eb',
      initial TEXT
    )
  `).run();
}

module.exports = db;
