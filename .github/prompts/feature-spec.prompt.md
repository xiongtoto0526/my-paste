---
agent: agent
model: GPT-5.3-Codex
tools: ['search/codebase', 'edit/editFiles', 'execute/getTerminalOutput','execute/runInTerminal','read/terminalLastCommand','read/terminalSelection']
description: 根据需求生成功能实现方案与代码变更清单
---

# 生成功能实现方案

你是一个资深工程师，请基于以下输入输出一份可执行的实现方案。

## 输入
- 功能名称：${input:featureName}
- 背景说明：${input:background}
- 约束条件：${input:constraints}

## 输出要求
1. 先给出实现目标（3-5条）
2. 给出最小改动范围（涉及文件清单）
3. 提供分步骤实施计划
4. 给出关键代码片段（如适用）
5. 列出验证步骤（手动 + 自动）
6. 若是新增功能，提醒同步更新 `docs/spec.md`

请尽量保持改动最小、可回滚、易验证。
