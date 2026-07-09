# cpp-expert 变更日志

## [1.0.0] — 2026-07-09

### 新增
- SKILL.md：技能入口，含 Rule 0 语言识别元规则 + 10 步工作流
- AGENTS.md：6 维度 × 28 条规则的完整参考（🔴内存安全/UB → 🟠RAII/并发 → 🟡现代C++/风格）
- references/memory-safety.md：智能指针选择指南 + 泄漏/溢出/UAF 检查清单
- references/compiler-errors.md：常见编译错误速查 + 段错误排查流程
- references/cpp-modern.md：C++11/14/17/20 特性对照表 + C++98→C++17 迁移路径
- scripts/run-static-analysis.sh：clang-tidy + cppcheck 自动化（含 compile_commands.json 探测）
- scripts/run-sanitizers.sh：AddressSanitizer + UBSan 运行器（自动识别 C/C++）

### 修复（审查后）
- 修复 AGENTS.md §2.5 `cleanup()` 前向声明缺失导致的编译错误
- 修复 AGENTS.md §3.1 `size_t` 缺少 `<cstddef>` 头文件
- 修复 AGENTS.md §1.4 C 代码示例缺少 `#include <stdlib.h>`
- 修复 run-sanitizers.sh 编译失败时无友好提示（添加 `if ! ... exit 1`）
- 修复 SKILL.md 中 `gcc/g++` 命令歧义（分开描述）
- 修复 AGENTS.md §4.3 函数返回类型错误（`void` → `shared_ptr`）
- 修复 AGENTS.md §6.5 缺少 ❌/✅ 格式（改用代码块对比）
