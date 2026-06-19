# Live2D Model Resources

本仓库用于存放 Live2D 模型资源文件，配合 [naihe-live2d-widget-v3](https://github.com/NaiHeeeee/live2d-widget-v3) 使用。

## 目录结构

每个模型应放在 `model/` 下的独立文件夹中：

```
model/<模型名称>/
├── <模型名称>.model3.json        # 模型配置文件（必需）
├── <模型名称>.moc3               # Live2D 模型数据（必需）
├── <模型名称>.cdi3.json          # 显示信息（可选）
├── <模型名称>.physics3.json      # 物理演算（可选）
├── config.json                   # 挂件配置（可选，scale/translate）
├── <模型名称>.<分辨率>/
│   ├── texture_00.png (或 .webp) # 纹理贴图（必需）
│   └── texture_01.png            # 多纹理时追加
├── motions/
│   ├── idle.motion3.json         # 待机动画
│   └── tap_body.motion3.json     # 点击动画
├── exp/
│   ├── smile.exp3.json           # 表情
│   └── ...
└── sounds/                       # 配音/音效（可选）
```

## 文件规范

### 1. `.model3.json` — 模型入口

必需字段：
```json
{
  "Version": 3,
  "FileReferences": {
    "Moc": "<模型名>.moc3",
    "Textures": ["<模型名>.<分辨率>/texture_00.png"]
  }
}
```

可选字段（推荐）：
- `Motions` — 注册动作组（Idle、TapBody 等）
- `Groups` — 眨眼/口型同步参数
- `HitAreas` — 点击区域

### 2. `config.json` — 挂件显示配置（必须）

```json
{
  "scale": 1.0,
  "translate": { "x": 0, "y": 0 }
}
```

- `scale` — 缩放比例，默认 1.0
- `translate.x` — 水平偏移（负值向左），默认 0
- `translate.y` — 垂直偏移（负值向上），默认 0

> 如果模型太大/太小/位置不对，改这个文件就行，不需要重新导出模型。

### 3. `.motion3.json` — 动作文件注意事项

**这是最常见的踩坑点。** 从游戏提取的动作文件，其 Meta 段中的 `TotalPointCount`（总点数）和 `TotalSegmentCount`（总段数）**经常算错**。

如果遇到这种报错：
```
Cannot set properties of undefined (setting 'time')
```

运行修复工具：
```bash
node tools/fix-motion-metadata.js model/<模型名称>
```

### 4. 纹理格式

| 格式 | 支持情况 |
|------|---------|
| PNG  | ✅ 最佳兼容 |
| WebP | ✅ 支持（更小体积）|

纹理文件放在 `<模型名>.<分辨率>/` 目录下，分辨率建议用 2048 或 4096。

### 5. `.moc3` 文件

**二进制文件，不要手动修改。** 由 Live2D Cubism Editor 或游戏提取工具生成。

## 快速检查清单

新加一个模型时，检查这些：

- [ ] 模型文件夹有 `.model3.json` 和 `.moc3`
- [ ] 纹理文件存在，路径和 `.model3.json` 一致
- [ ] `config.json` 有 scale 和 translate 配置
- [ ] `.motion3.json` 的 Meta 计数正确（跑 `fix-motion-metadata.js` 检查）
- [ ] 模型文件夹没有多余的 `.bak` 文件（有用就保留，没用就删掉）

## 已知问题

### motion3.json 元数据错误

游戏提取工具计算 TotalPointCount 时经常出错（统一偏移 44 点左右），
导致渲染时数组访问越界崩溃。修复脚本会自动纠正。

### 物理参数空输出

部分模型的 `.physics3.json` 中存在 `"Output": []` 的空设置，
虽然不会导致崩溃，但会浪费性能。建议删除这些无用的 PhysicsSetting 条目。
