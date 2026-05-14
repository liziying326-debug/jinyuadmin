const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(
  path.join(__dirname, 'jinyu.db'),
  (err) => {
    if (err) console.error('❌ 数据库连接失败:', err.message);
    else console.log('✅ 已连接到 jinyu.db');
  }
);

db.serialize(() => {
  console.log('\n📦 开始创建数据库表...');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  1. news 表（新闻/资讯）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  db.run(`CREATE TABLE IF NOT EXISTS news (
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
  )`, (err) => {
    if (err) console.error('❌ 创建 news 表失败:', err.message);
    else console.log('✅ news 表已创建');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  2. cases 表（案例）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  db.run(`CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY,
    slug TEXT UNIQUE,
    slug_en TEXT,
    slug_zh TEXT,
    slug_vi TEXT,
    slug_tl TEXT,
    seo_title_en TEXT,
    seo_title_zh TEXT,
    seo_title_vi TEXT,
    seo_title_tl TEXT,
    alt_en TEXT,
    alt_zh TEXT,
    alt_vi TEXT,
    alt_tl TEXT,
    h1_title_en TEXT,
    h1_title_zh TEXT,
    h1_title_vi TEXT,
    h1_title_tl TEXT,
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
  )`, (err) => {
    if (err) console.error('❌ 创建 cases 表失败:', err.message);
    else console.log('✅ cases 表已创建');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  3. scenarios 表（应用场景）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  db.run(`CREATE TABLE IF NOT EXISTS scenarios (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('❌ 创建 scenarios 表失败:', err.message);
    else console.log('✅ scenarios 表已创建');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  4. about 表（关于我们）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  db.run(`CREATE TABLE IF NOT EXISTS about (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT,
    key TEXT,
    value_en TEXT,
    value_zh TEXT,
    value_vi TEXT,
    value_tl TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('❌ 创建 about 表失败:', err.message);
    else console.log('✅ about 表已创建');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  5. contacts 表（联系留言）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    company TEXT,
    product TEXT,
    message TEXT,
    lang TEXT DEFAULT 'en',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('❌ 创建 contacts 表失败:', err.message);
    else console.log('✅ contacts 表已创建');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  6. social_links 表（社交链接）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  db.run(`CREATE TABLE IF NOT EXISTS social_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT UNIQUE,
    url TEXT,
    icon TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('❌ 创建 social_links 表失败:', err.message);
    else console.log('✅ social_links 表已创建');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  7. translations 表（UI翻译）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  db.run(`CREATE TABLE IF NOT EXISTS translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lang TEXT,
    key TEXT,
    value TEXT,
    UNIQUE(lang, key)
  )`, (err) => {
    if (err) console.error('❌ 创建 translations 表失败:', err.message);
    else console.log('✅ translations 表已创建');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  8. accounts 表（后台账号）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'editor',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('❌ 创建 accounts 表失败:', err.message);
    else console.log('✅ accounts 表已创建');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  9. faqs 表（常见问题）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  db.run(`CREATE TABLE IF NOT EXISTS faqs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table TEXT,
    question_en TEXT,
    question_zh TEXT,
    question_vi TEXT,
    question_tl TEXT,
    answer_en TEXT,
    answer_zh TEXT,
    answer_vi TEXT,
    answer_tl TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('❌ 创建 faqs 表失败:', err.message);
    else console.log('✅ faqs 表已创建');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  10. faqs 表（常见问题）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  db.run(`CREATE TABLE products (
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
    )`, (err) => {
    if (err) console.error('❌ 创建 products 表失败:', err.message);
    else console.log('✅ products 表已创建');
  });

  console.log('\n📦 数据库表创建完成！\n');
});

db.close((err) => {
  if (err) console.error('❌ 关闭数据库失败:', err.message);
  else console.log('✅ 数据库连接已关闭');
});
