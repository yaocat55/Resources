/**
 * Live2D motion3.json 元数据修复工具
 *
 * 用途：修复从游戏提取的 .motion3.json 文件中 Meta 段
 *       TotalPointCount / TotalSegmentCount 计算错误的问题。
 *
 * 原理：Cubism SDK 的 CubismMotion.parse() 会按 Meta 声明的数量
 *       预分配数组，如果实际数据超出声明值则崩溃报错：
 *       "Cannot set properties of undefined (setting 'time')"
 *
 * 用法：
 *   node fix-motion-metadata.js <model-dir>
 *   或
 *   node fix-motion-metadata.js <model-dir>/motions
 *
 * 示例：
 *   node fix-motion-metadata.js ../model/416
 *   node fix-motion-metadata.js ../model/416/motions
 */

const fs = require('fs');
const path = require('path');

// ====== 配置 ======
const VALID_SEGMENT_TYPES = [0, 1, 2, 3]; // 0=Linear, 1=Bezier, 2=Stepped, 3=InverseStepped
const SEGMENT_SIZE = {
  0: { points: 1, advance: 3 },  // Linear
  1: { points: 3, advance: 7 },  // Bezier
  2: { points: 1, advance: 3 },  // Stepped
  3: { points: 1, advance: 3 },  // InverseStepped
};

// ====== 核心计算逻辑 ======

/**
 * 遍历曲线的 Segments 数组，计算出实际需要的点数和段数
 *
 * 注意：CubismMotion.parse() 中 totalSegmentCount 在每次循环（包括起始点）
 * 都 +1。因此 Meta.TotalSegmentCount = 曲线数 + 实际段数（不含起始点）。
 */
function calculateCounts(segments) {
  let totalPoints = 0;
  let actualSegments = 0;  // 不含起始点的实际段数
  let pos = 0;
  let isFirstSegment = true;

  while (pos < segments.length) {
    if (isFirstSegment) {
      // 第一个段：包含起始点 [time, value]
      totalPoints += 1;
      pos += 2;
      isFirstSegment = false;
    } else {
      actualSegments += 1;
    }

    const segType = segments[pos];

    if (segType === undefined || !VALID_SEGMENT_TYPES.includes(segType)) {
      throw new Error(`未知的段类型 ${segType}，位置 ${pos}`);
    }

    const info = SEGMENT_SIZE[segType];
    totalPoints += info.points;
    pos += info.advance;
  }

  return { totalPoints, actualSegments };
}

// ====== 文件处理 ======

/**
 * 修复单个 motion3.json 文件
 */
function fixMotionFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const curves = data.Curves;

  if (!curves || !data.Meta) {
    console.warn(`  ⚠️ 跳过（缺少 Curves 或 Meta）: ${filePath}`);
    return false;
  }

  let calculatedPoints = 0;
  let calculatedSegments = 0;

  for (const curve of curves) {
    if (!curve.Segments || !Array.isArray(curve.Segments)) {
      console.warn(`  ⚠️ 跳过曲线（缺少 Segments）: ${curve.Id || 'unknown'}`);
      continue;
    }

    const result = calculateCounts(curve.Segments);
    calculatedPoints += result.totalPoints;
    calculatedSegments += result.actualSegments;
  }

  // CubismMotion.parse() 中 totalSegmentCount = 每条曲线的起始点(1次) + 实际段数
  const curveCount = curves.length;
  const totalSegmentCount = curveCount + calculatedSegments;

  const oldPoints = data.Meta.TotalPointCount;
  const oldSegs = data.Meta.TotalSegmentCount;

  if (oldPoints === calculatedPoints && oldSegs === totalSegmentCount) {
    console.log(`  ✅ 无需修复: ${path.basename(filePath)}`);
    return false;
  }

  data.Meta.TotalPointCount = calculatedPoints;
  data.Meta.TotalSegmentCount = totalSegmentCount;

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  🔧 已修复: ${path.basename(filePath)}`);
  console.log(`    TotalPointCount: ${oldPoints} → ${calculatedPoints}`);
  console.log(`    TotalSegmentCount: ${oldSegs} → ${totalSegmentCount}`);
  return true;
}

/**
 * 查找目录下所有 .motion3.json 文件并修复
 */
function fixDirectory(dir) {
  // 如果传入的是 motions 子目录
  let searchDir = dir;
  let isMotionsDir = dir.endsWith('motions') || dir.endsWith('motions/');

  if (!isMotionsDir) {
    // 检查是否是模型目录（包含 motions 子目录）
    const motionsSubDir = path.join(dir, 'motions');
    if (fs.existsSync(motionsSubDir) && fs.statSync(motionsSubDir).isDirectory()) {
      searchDir = motionsSubDir;
    }
  }

  if (!fs.existsSync(searchDir)) {
    console.error(`❌ 目录不存在: ${searchDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(searchDir)
    .filter(f => f.endsWith('.motion3.json'))
    .sort();

  if (files.length === 0) {
    console.log(`在 ${searchDir} 中未找到 .motion3.json 文件`);
    return;
  }

  console.log(`找到 ${files.length} 个 motion 文件，正在检查...\n`);

  let fixed = 0;
  for (const file of files) {
    const fullPath = path.join(searchDir, file);
    try {
      if (fixMotionFile(fullPath)) {
        fixed++;
      }
    } catch (err) {
      console.error(`  ❌ 处理失败: ${file} — ${err.message}`);
    }
  }

  console.log(`\n完成！共修复 ${fixed}/${files.length} 个文件`);
}

// ====== 入口 ======

const target = process.argv[2];
if (!target) {
  console.log(`
用法: node fix-motion-metadata.js <路径>

路径可以是：
  - 模型目录（包含 motions/ 子目录）
  - motions 子目录本身
  - 单个 .motion3.json 文件

示例：
  node fix-motion-metadata.js ../model/416
  node fix-motion-metadata.js ../model/416/motions
  node fix-motion-metadata.js ../model/416/motions/daiji_idle_01.motion3.json
`);
  process.exit(0);
}

const resolvedPath = path.resolve(target);

if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
  // 单个文件
  console.log(`处理文件: ${resolvedPath}\n`);
  fixMotionFile(resolvedPath);
} else if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
  // 目录
  fixDirectory(resolvedPath);
} else {
  console.error(`❌ 路径无效: ${target}`);
  process.exit(1);
}
