---
agent: ask
description: 复盘本次对话，识别可沉淀到 prompts、skills、agents、instructions 的改进项
---

# 会话沉淀评估

请基于我们本次对话，输出一份可执行的沉淀建议，目标是减少后续重复沟通、提升稳定性。

## 评估标准
- 高频重复：本次会话中重复出现 >= 2 次
- 稳定流程：步骤明确，适合标准化
- 角色边界：适合固定到 planner / implementer / reviewer
- 长期规则：跨任务都应遵守

## 输出格式

1. Prompt 候选（最多 3 个）
- 名称
- 触发方式（/xxx）
- 适用场景
- 建议文件路径（`.github/prompts/*.prompt.md`）
- 草案内容摘要（3-5 行）

2. Skill 候选（最多 3 个）
- 名称
- 触发场景关键词
- 标准步骤（3-6 步）
- 建议文件路径（`.github/skills/<name>/SKILL.md`）

3. Agent 调整建议（最多 5 条）
- 目标 agent（planner / implementer / reviewer）
- 建议修改项（instructions / tools / handoffs）
- 预期收益
- 风险

4. Instructions 建议（最多 5 条）
- 全局还是局部（applyTo）
- 建议写入位置（`copilot-instructions.md` 或 `.github/instructions/*.instructions.md`）
- 规则草案（1-2 行）
- 是否可能与现有规则冲突

5. 优先级执行清单
- P0：立刻做
- P1：本周做
- P2：观察后再做

## 约束
- 必须结合本次对话里的具体现象，不要泛泛而谈。
- 如果某项不值得沉淀，请明确写“保持为临时对话即可”。
- 建议保持最小变更，避免一次性引入过多配置。
