// 数据库查询工具
// 用法: node query-db.cjs [表名]

const db = require('./database.cjs');

if (!db) {
  console.error('数据库连接失败');
  process.exit(1);
}

const tableName = process.argv[2] || 'faqs';

console.log(`\n=== 查看表: ${tableName} ===\n`);

try {
  // 获取表数据
  const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
  
  if (rows.length === 0) {
    console.log('该表为空\n');
  } else {
    console.log(`共 ${rows.length} 条记录:\n`);
    rows.forEach((row, idx) => {
      console.log(`--- 记录 ${idx + 1} ---`);
      console.log(JSON.stringify(row, null, 2));
      console.log();
    });
  }
  
  // 如果是 milestones 表，额外检查
  if (tableName === 'milestones' || tableName === 'about') {
    console.log('\n=== 数据格式检查 ===\n');
    const milestones = db.prepare('SELECT milestones FROM about LIMIT 1').get();
    console.log('milestones 字段内容:', milestones?.milestones);
    console.log('数据类型:', typeof milestones?.milestones);
    console.log('是否为数组:', Array.isArray(milestones?.milestones));
    console.log('是否为 JSON 字符串:', typeof milestones?.milestones === 'string');
  }
  
} catch (e) {
  console.error(`查询失败: ${e.message}`);
}

// 查看所有表
console.log('\n=== 所有表 ===\n');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(t => console.log('-', t.name));

db.close();
