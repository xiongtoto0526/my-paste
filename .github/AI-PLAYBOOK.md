# Copilot AI Playbook

本文件用于定义本仓库的 Copilot 工程化使用方式，目标是：
- 稳定：减少每次对话重复说明上下文
- 可控：把强约束放在 instructions，把流程能力放在 skills
- 高效：把高频任务固化为 prompts

## 1. 三者分工

- `copilot-instructions.md`：全局硬约束，始终生效
- `.github/instructions/*.instructions.md`：按文件类型或路径生效的局部规则
- `.github/agents/*.agent.md`：可切换角色配置（工具权限 + 角色行为）
- `.github/skills/*/SKILL.md`：可复用工作流能力，可自动触发或通过 `/skill-name` 调用
- `.github/prompts/*.prompt.md`：一次性任务模板，通过 `/prompt-name` 手动调用

## 2. 选型原则

- 长期规则 -> instructions
- 固定角色 -> agents
- 多步骤流程 -> skills
- 高频模板化任务 -> prompts

## 3. 推荐工作流

1. 切到 `planner`：澄清需求并生成实施方案。
2. 切到 `implementer`：执行最小改动并完成验证。
3. 若有行为变化：触发 `spec-sync-guard`，同步 `docs/spec.md`。
4. 切到 `reviewer`：做风险与回归检查，必要时配合 `/review-risks`。

## 4. 目录结构示例

```text
.github/
  copilot-instructions.md
  AI-PLAYBOOK.md
  instructions/
    engineering-core.instructions.md
    docs-spec.instructions.md
  agents/
    planner.agent.md
    implementer.agent.md
    reviewer.agent.md
  prompts/
    feature-spec.prompt.md
    review-risks.prompt.md
  skills/
    spec-sync-guard/
      SKILL.md
    bugfix-checklist/
      SKILL.md
```

## 5. 维护规则

- 新增一条规范前，先判断是否可放入已有文件，避免碎片化。
- prompt 超过 3 个时，按场景命名：`plan-*`、`review-*`、`impl-*`。
- skill 的 `description` 必须写清楚“何时触发”，否则自动触发效果差。
- 每次迭代后删除低频、无效 prompt，保持集合精简。
