// 数据库连接诊断脚本
console.log('=== 数据库连接诊断 ===\n');

const path = require('path');
const fs = require('fs');

// 1. 检查 better-sqlite3 是否可用
console.log('1. 检查 better-sqlite3:');
let Database;
try {
  Database = require('better-sqlite3');
  console.log('   ✓ better-sqlite3 可用');
} catch (e) {
  console.error('   ✗ better-sqlite3 不可用:', e.message);
  process.exit(1);
}

// 2. 检查数据库文件
console.log('\n2. 检查数据库文件:');
const dbPath = path.join(__dirname, 'data', 'jinyu.db');
console.log('   数据库路径:', dbPath);
console.log('   文件存在:', fs.existsSync(dbPath));

if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log('   文件大小:', stats.size, '字节');
  console.log('   最后修改:', stats.mtime);
}

// 3. 检查 WAL 文件
console.log('\n3. 检查 WAL 文件:');
const walPath = dbPath + '-wal';
const shmPath = dbPath + '-shm';
console.log('   WAL 文件存在:', fs.existsSync(walPath));
console.log('   SHM 文件存在:', fs.existsSync(shmPath));

// 4. 尝试连接数据库
console.log('\n4. 尝试连接数据库:');
let db;
try {
  db = new Database(dbPath);
  console.log('   ✓ 连接成功');
  
  // 5. 测试查询
  console.log('\n5. 测试查询:');
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('   ✓ 表列表查询成功');
    console.log('   表:', tables.map(t => t.name).join(', '));
  } catch (e) {
    console.error('   ✗ 查询失败:', e.message);
  }
  
  try {
    const faqCount = db.prepare("SELECT COUNT(*) as count FROM faqs").get();
    console.log('   ✓ FAQ 查询成功');
    console.log('   FAQ 数量:', faqCount.count);
  } catch (e) {
    console.error('   ✗ FAQ 查询失败:', e.message);
  }
  
  db.close();
  console.log('\n6. 连接已关闭');
  
} catch (e) {
  console.error('   ✗ 连接失败:', e.message);
  console.error('   错误堆栈:', e.stack);
}

console.log('\n=== 诊断完成 ===');
