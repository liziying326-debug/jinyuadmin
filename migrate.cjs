const fs = require('fs');
const path = require('path');
const db = require('./database.cjs');

// 读取 JSON 文件
const productsPath = path.join(__dirname, 'data', 'products.json');
const categoriesPath = path.join(__dirname, 'data', 'categories.json');

let products = [];
let categories = [];

try {
  products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  console.log(`✅ 读取 ${products.length} 个产品`);
} catch (e) {
  console.error('❌ 读取 products.json 失败：', e.message);
  process.exit(1);
}

try {
  categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
  console.log(`✅ 读取 ${categories.length} 个分类`);
} catch (e) {
  console.error('❌ 读取 categories.json 失败：', e.message);
  // 不退出，categories 可能不存在
}

// 迁移 categories
if (categories.length > 0) {
  const catStmt = db.prepare(`
    INSERT OR REPLACE INTO categories (id, name_en, name_zh, name_vi, name_tl)
    VALUES (@id, @name_en, @name_zh, @name_vi, @name_tl)
  `);

  const catInsert = db.transaction((cats) => {
    for (const cat of cats) {
      catStmt.run({
        id: cat.id,
        name_en: cat.name_en || cat.name || '',  // 修复：优先使用name_en
        name_zh: cat.name_zh || '',
        name_vi: cat.name_vi || '',
        name_tl: cat.name_tl || ''
      });
    }
  });

  try {
    catInsert(categories);
    console.log(`✅ 迁移 ${categories.length} 个分类到数据库`);
  } catch (e) {
    console.error('❌ 迁移分类失败：', e.message);
  }
}

// 迁移 products
const prodStmt = db.prepare(`
  INSERT OR REPLACE INTO products (
    id, name_en, name_zh, name_vi, name_tl,
    category_id, description_en, description_zh, description_vi, description_tl,
    specs, features_en, features_zh, features_vi, features_tl,
    images, main_image, img, status
  ) VALUES (
    @id, @name_en, @name_zh, @name_vi, @name_tl,
    @category_id, @description_en, @description_zh, @description_vi, @description_tl,
    @specs, @features_en, @features_zh, @features_vi, @features_tl,
    @images, @main_image, @img, @status
  )
`);

const prodInsert = db.transaction((prods) => {
  for (const p of prods) {
    // 正确处理 specs（可能是对象数组）
    let specsStr = '[]';
    if (Array.isArray(p.specs)) {
      specsStr = JSON.stringify(p.specs);
    }
    
    // 正确处理 features（可能是字符串数组或对象）
    let featuresStr = '[]';
    if (Array.isArray(p.features)) {
      featuresStr = JSON.stringify(p.features);
    }
    
    // 正确处理 images
    let imagesStr = '[]';
    if (Array.isArray(p.images)) {
      imagesStr = JSON.stringify(p.images);
    }
    
    prodStmt.run({
      id: String(p.id || ''),
      name_en: String(p.name || ''),
      name_zh: String(p.name_zh || ''),
      name_vi: String(p.name_vi || ''),
      name_tl: String(p.name_tl || ''),
      category_id: String(p.category_id || p.category || ''),
      description_en: String(p.description || ''),
      description_zh: String(p.description_zh || ''),
      description_vi: String(p.description_vi || ''),
      description_tl: String(p.description_tl || ''),
      specs: specsStr,
      features_en: featuresStr,
      features_zh: JSON.stringify(p.features_zh || []),
      features_vi: JSON.stringify(p.features_vi || []),
      features_tl: JSON.stringify(p.features_tl || []),
      images: imagesStr,
      main_image: parseInt(p.main_image) || 0,
      img: String(p.img || ''),
      status: String(p.status || 'active')
    });
  }
});

try {
  prodInsert(products);
  console.log(`✅ 迁移 ${products.length} 个产品到数据库`);
  console.log('✅ 迁移完成！');
  console.log(`数据库文件：${path.join(__dirname, 'data', 'jinyu.db')}`);
} catch (e) {
  console.error('❌ 迁移产品失败：', e.message);
  process.exit(1);
}
