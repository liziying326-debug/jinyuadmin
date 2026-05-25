#!/usr/bin/env node
/**
 * 从JSON文件导入数据到SQLite数据库
 * 用法：node import-json-to-db.cjs
 * 注意：此脚本应放在 jinyu1.0admin 目录下运行
 */

const path = require('path');
const fs = require('fs');
const db = require('./database.cjs');

const DATA_DIR = path.join(__dirname, 'data');

// 读取JSON文件
function loadJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${filename}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// 导入分类数据
function importCategories() {
  const categories = loadJSON('categories.json');
  if (!categories || !Array.isArray(categories)) return;
  
  console.log(`📂 导入 ${categories.length} 个分类...`);
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO categories (id, name_en, name_zh, name_vi, name_tl, description_en, description_zh, description_vi, description_tl)
    VALUES (@id, @name_en, @name_zh, @name_vi, @name_tl, @description_en, @description_zh, @description_vi, @description_tl)
  `);
  
  const insertMany = db.transaction((items) => {
    for (const c of items) {
      stmt.run({
        id: c.id,
        name_en: c.name_en || c.name || '',
        name_zh: c.name_zh || '',
        name_vi: c.name_vi || '',
        name_tl: c.name_tl || '',
        description_en: c.description_en || '',
        description_zh: c.description_zh || '',
        description_vi: c.description_vi || '',
        description_tl: c.description_tl || ''
      });
    }
  });
  
  insertMany(categories);
  console.log(`✅ 分类导入完成`);
}

// 导入产品数据
function importProducts() {
  const products = loadJSON('products.json');
  if (!products || !Array.isArray(products)) return;
  
  console.log(`📦 导入 ${products.length} 个产品...`);
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO products (
      id, category_id, status, main_image, images, img,
      name_en, name_zh, name_vi, name_tl,
      description_en, description_zh, description_vi, description_tl,
      specs, features_en, features_zh, features_vi, features_tl,
      created_at, updated_at
    ) VALUES (
      @id, @category_id, @status, @main_image, @images, @img,
      @name_en, @name_zh, @name_vi, @name_tl,
      @description_en, @description_zh, @description_vi, @description_tl,
      @specs, @features_en, @features_zh, @features_vi, @features_tl,
      @created_at, @updated_at
    )
  `);
  
  const insertMany = db.transaction((items) => {
    for (const p of items) {
      stmt.run({
        id: p.id,
        category_id: p.category_id || '',
        status: p.status || 'active',
        main_image: typeof p.main_image === 'number' ? p.main_image : 0,
        images: JSON.stringify(p.images || []),
        img: p.img || '',
        name_en: p.name_en || p.name || '',
        name_zh: p.name_zh || '',
        name_vi: p.name_vi || '',
        name_tl: p.name_tl || '',
        description_en: p.description_en || p.description || '',
        description_zh: p.description_zh || '',
        description_vi: p.description_vi || '',
        description_tl: p.description_tl || '',
        specs: JSON.stringify(p.specs || p.specs_en || []),
        features_en: JSON.stringify(p.features_en || p.features || []),
        features_zh: JSON.stringify(p.features_zh || []),
        features_vi: JSON.stringify(p.features_vi || []),
        features_tl: JSON.stringify(p.features_tl || []),
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || new Date().toISOString()
      });
    }
  });
  
  insertMany(products);
  console.log(`✅ 产品导入完成`);
}

// 导入新闻数据
function importNews() {
  const news = loadJSON('news.json');
  if (!news || !Array.isArray(news)) return;
  
  console.log(`📰 导入 ${news.length} 条新闻...`);
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO news (
      id, date, status, views, images, category,
      title_en, title_zh, title_vi, title_tl,
      slug_en, slug_zh, slug_vi, slug_tl,
      content_en, content_zh, content_vi, content_tl,
      seo_title_en, seo_title_zh, seo_title_vi, seo_title_tl,
      alt_en, alt_zh, alt_vi, alt_tl,
      created_at, updated_at
    ) VALUES (
      @id, @date, @status, @views, @images, @category,
      @title_en, @title_zh, @title_vi, @title_tl,
      @slug_en, @slug_zh, @slug_vi, @slug_tl,
      @content_en, @content_zh, @content_vi, @content_tl,
      @seo_title_en, @seo_title_zh, @seo_title_vi, @seo_title_tl,
      @alt_en, @alt_zh, @alt_vi, @alt_tl,
      @created_at, @updated_at
    )
  `);
  
  const insertMany = db.transaction((items) => {
    for (const n of items) {
      const langData = n.langData || {};
      stmt.run({
        id: n.id,
        date: n.date || '',
        status: n.status || 'published',
        views: n.views || 0,
        images: JSON.stringify(n.images || []),
        category: n.category || '',
        title_en: langData.en?.title || n.title_en || '',
        title_zh: langData.zh?.title || n.title_zh || '',
        title_vi: langData.vi?.title || n.title_vi || '',
        title_tl: langData.tl?.title || n.title_tl || '',
        slug_en: langData.en?.slug || n.slug_en || '',
        slug_zh: langData.zh?.slug || n.slug_zh || '',
        slug_vi: langData.vi?.slug || n.slug_vi || '',
        slug_tl: langData.tl?.slug || n.slug_tl || '',
        content_en: langData.en?.content || n.content_en || '',
        content_zh: langData.zh?.content || n.content_zh || '',
        content_vi: langData.vi?.content || n.content_vi || '',
        content_tl: langData.tl?.content || n.content_tl || '',
        seo_title_en: langData.en?.seo_title || n.seo_title_en || '',
        seo_title_zh: langData.zh?.seo_title || n.seo_title_zh || '',
        seo_title_vi: langData.vi?.seo_title || n.seo_title_vi || '',
        seo_title_tl: langData.tl?.seo_title || n.seo_title_tl || '',
        alt_en: langData.en?.alt || n.alt_en || '',
        alt_zh: langData.zh?.alt || n.alt_zh || '',
        alt_vi: langData.vi?.alt || n.alt_vi || '',
        alt_tl: langData.tl?.alt || n.alt_tl || '',
        created_at: n.created_at || new Date().toISOString(),
        updated_at: n.updated_at || new Date().toISOString()
      });
    }
  });
  
  insertMany(news);
  console.log(`✅ 新闻导入完成`);
}

// 导入案例数据
function importCases() {
  const cases = loadJSON('cases.json');
  if (!cases || !Array.isArray(cases)) return;
  
  console.log(`📁 导入 ${cases.length} 个案例...`);
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO cases (
      id, slug, status, images,
      region_en, region_zh, region_vi, region_tl,
      category_en, category_zh, category_vi, category_tl,
      date, video,
      client_en, client_zh, client_vi, client_tl,
      title_en, title_zh, title_vi, title_tl,
      content_en, content_zh, content_vi, content_tl,
      outcomes_en, outcomes_zh, outcomes_vi, outcomes_tl,
      materials_en, materials_zh, materials_vi, materials_tl,
      created_at, updated_at
    ) VALUES (
      @id, @slug, @status, @images,
      @region_en, @region_zh, @region_vi, @region_tl,
      @category_en, @category_zh, @category_vi, @category_tl,
      @date, @video,
      @client_en, @client_zh, @client_vi, @client_tl,
      @title_en, @title_zh, @title_vi, @title_tl,
      @content_en, @content_zh, @content_vi, @content_tl,
      @outcomes_en, @outcomes_zh, @outcomes_vi, @outcomes_tl,
      @materials_en, @materials_zh, @materials_vi, @materials_tl,
      @created_at, @updated_at
    )
  `);
  
  const insertMany = db.transaction((items) => {
    for (const c of items) {
      const langData = c.langData || {};
      stmt.run({
        id: c.id,
        slug: c.slug || '',
        status: c.status || 'published',
        images: JSON.stringify(c.images || []),
        region_en: langData.en?.region || c.region_en || '',
        region_zh: langData.zh?.region || c.region_zh || '',
        region_vi: langData.vi?.region || c.region_vi || '',
        region_tl: langData.tl?.region || c.region_tl || '',
        category_en: langData.en?.category || c.category_en || '',
        category_zh: langData.zh?.category || c.category_zh || '',
        category_vi: langData.vi?.category || c.category_vi || '',
        category_tl: langData.tl?.category || c.category_tl || '',
        date: c.date || '',
        video: c.video || '',
        client_en: langData.en?.client || c.client_en || '',
        client_zh: langData.zh?.client || c.client_zh || '',
        client_vi: langData.vi?.client || c.client_vi || '',
        client_tl: langData.tl?.client || c.client_tl || '',
        title_en: langData.en?.title || c.title_en || '',
        title_zh: langData.zh?.title || c.title_zh || '',
        title_vi: langData.vi?.title || c.title_vi || '',
        title_tl: langData.tl?.title || c.title_tl || '',
        content_en: langData.en?.content || c.content_en || '',
        content_zh: langData.zh?.content || c.content_zh || '',
        content_vi: langData.vi?.content || c.content_vi || '',
        content_tl: langData.tl?.content || c.content_tl || '',
        outcomes_en: langData.en?.outcomes || c.outcomes_en || '',
        outcomes_zh: langData.zh?.outcomes || c.outcomes_zh || '',
        outcomes_vi: langData.vi?.outcomes || c.outcomes_vi || '',
        outcomes_tl: langData.tl?.outcomes || c.outcomes_tl || '',
        materials_en: langData.en?.materials || c.materials_en || '',
        materials_zh: langData.zh?.materials || c.materials_zh || '',
        materials_vi: langData.vi?.materials || c.materials_vi || '',
        materials_tl: langData.tl?.materials || c.materials_tl || '',
        created_at: c.created_at || new Date().toISOString(),
        updated_at: c.updated_at || new Date().toISOString()
      });
    }
  });
  
  insertMany(cases);
  console.log(`✅ 案例导入完成`);
}

// 导入场景数据
function importScenarios() {
  const scenarios = loadJSON('scenarios.json');
  if (!scenarios || !Array.isArray(scenarios)) return;
  
  console.log(`🎯 导入 ${scenarios.length} 个场景...`);
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO scenarios (id, image, order_num, is_active, title_en, title_zh, title_vi, title_tl, description_en, description_zh, description_vi, description_tl)
    VALUES (@id, @image, @order_num, @is_active, @title_en, @title_zh, @title_vi, @title_tl, @description_en, @description_zh, @description_vi, @description_tl)
  `);
  
  const insertMany = db.transaction((items) => {
    for (const s of items) {
      stmt.run({
        id: s.id,
        image: s.image || '',
        order_num: s.order_num || s.sort_order || 0,
        is_active: s.is_active !== false ? 1 : 0,
        title_en: s.title_en || s.name_en || '',
        title_zh: s.title_zh || s.name_zh || '',
        title_vi: s.title_vi || s.name_vi || '',
        title_tl: s.title_tl || s.name_tl || '',
        description_en: s.description_en || s.description || '',
        description_zh: s.description_zh || '',
        description_vi: s.description_vi || '',
        description_tl: s.description_tl || ''
      });
    }
  });
  
  insertMany(scenarios);
  console.log(`✅ 场景导入完成`);
}

// 导入about数据（键值存储）
function importAbout() {
  const about = loadJSON('about.json');
  if (!about) return;
  
  console.log(`🏢 导入公司信息...`);
  
  // about.json可能是对象或数组
  const data = Array.isArray(about) ? about[0] : about;
  
  // 将对象拆分成键值对存入about表
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO about (section, key, value_en, value_zh, value_vi, value_tl)
    VALUES (@section, @key, @value_en, @value_zh, @value_vi, @value_tl)
  `);
  
  const insertMany = db.transaction((obj) => {
    // 处理数组字段（存在单独的列中）
    const arrayFields = ['factory_images', 'milestones', 'capacity_cards', 'certifications', 'team_members', 'team_members_zh', 'team_members_vi', 'team_members_tl'];
    
    for (const [key, value] of Object.entries(obj)) {
      // 跳过数组字段（这些需要从about.json单独读取）
      if (arrayFields.includes(key)) {
        continue;
      }
      
      // 判断是字符串还是对象（多语言）
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // 多语言对象
        stmt.run({
          section: 'about',
          key,
          value_en: value.en || '',
          value_zh: value.zh || '',
          value_vi: value.vi || '',
          value_tl: value.tl || ''
        });
      } else {
        // 字符串或数组（转JSON）
        const val = typeof value === 'string' ? value : JSON.stringify(value);
        stmt.run({
          section: 'about',
          key,
          value_en: val,
          value_zh: '',
          value_vi: '',
          value_tl: ''
        });
      }
    }
  });
  
  insertMany(data);
  console.log(`✅ 公司信息导入完成`);
}

// 导入社交链接
function importSocialLinks() {
  const links = loadJSON('social-links.json');
  if (!links || !Array.isArray(links)) return;
  
  console.log(`🔗 导入 ${links.length} 个社交链接...`);
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO social_links (id, platform, url, icon, is_active)
    VALUES (@id, @platform, @url, @icon, @is_active)
  `);
  
  const insertMany = db.transaction((items) => {
    for (const l of items) {
      stmt.run({
        id: l.id,
        platform: l.platform || '',
        url: l.url || '',
        icon: l.icon || '',
        is_active: l.is_active !== false ? 1 : 0
      });
    }
  });
  
  insertMany(links);
  console.log(`✅ 社交链接导入完成`);
}

// 主函数
function main() {
  console.log('===== 开始导入数据 =====\n');
  
  try {
    importCategories();
    importProducts();
    importNews();
    importCases();
    importScenarios();
    importAbout();
    importSocialLinks();
    
    console.log('\n===== ✅ 所有数据导入完成 =====');
    
    // 显示统计
    console.log('\n📊 数据统计：');
    const tables = ['products', 'categories', 'news', 'cases', 'scenarios', 'about', 'social_links'];
    for (const table of tables) {
      try {
        const count = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
        console.log(`  ${table}: ${count.c} 条`);
      } catch (e) {
        // 表可能不存在
        console.log(`  ${table}: 表不存在`);
      }
    }
    
  } catch (error) {
    console.error('❌ 导入失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
