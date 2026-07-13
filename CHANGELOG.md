# cpp-expert 变更日志

## [1.4.0] — 2026-07-13

### 新增
- 架构：三阶段流水线（Stage 0 预处理 → Stage 1 微观 → Stage 2 宏观）
- scripts/pin_audit.js：GPIO 引脚冲突矩阵扫描（支持 HAL `GPIO_PIN_X` 和 SPL `GPIO_Pin_X`）
- scripts/ctrl_chain_check.js：控制链调用图分析（支持 ISR + FreeRTOS xTaskCreate 入口检测，函数指针逃逸检测）
- scripts/stack_depth_audit.js：ISR 栈深度估算（支持 Cortex-M 嵌套中断乘数）
- scripts/run-preaudit.js：统一调度器，输出 unified-audit-report.json（93% Token 缩减）
- AGENTS.md §1.2：统一审计报告使用规则（JSON 字段→报告动作映射表）
- SKILL.md：降级模式（Node.js 不可用时自动转人工引导）
- AGENTS.md 目录：新增 Attention Budget Guide 和 §5.7 C Semantics 条目
- SKILL.md Bundled Resources：列出 4 个新 Node.js 脚本
- SKILL.md 触发词：追加 GPIO、ISR、RTOS、FreeRTOS、pre-audit 等关键词

### 修复
- 修复 pin_audit.js 端口提取顺序错误（结构体名→向下匹配 GPIO_Init 调用）
- 修复 pin_audit.js `GPIO_PIN_9` vs `GPIO_Pin_9` 大小写兼容
- 修复 pin_audit.js `.Pin` vs `.GPIO_Pin` 双字段名支持
- 修复 ctrl_chain_check.js RTOS 任务入口漏报（xTaskCreate 参数提取）
- 修复 ctrl_chain_check.js `(?:[\w\s\*]*?)` 允许零前缀函数修饰符
- 修复 ctrl_chain_check.js `==` 误判为函数指针赋值
- 修复 ctrl_chain_check.js 函数指针参数传递检测（`HAL_RegisterCallback(&fn)`）
- 修复 stack_depth_audit.js uint32_t 双重计数（合并 typeMap）
- 修复 stack_depth_audit.js `_IRQn` 枚举误匹配
- 修复 run-preaudit.js 多目录忽略（`--include-dir A --include-dir B`）
- 修复 run-preaudit.js `Promise.all`→顺序执行（设计一致性）
- 修复 run-preaudit.js execFile(process.execPath) 跨平台调用
- 修复三大脚本注释/字符串中 `}` 干扰大括号计数
- 修复 SKILL.md 重复编号 7.
- 修复 SKILL.md 降级模式硬编码 line 42
- 修复 AGENTS.md 目录缺失条目
- 修复 AGENTS.md 缺少 JSON 使用规则

## [1.3.0] — 2026-07-09

### 新增
- SKILL.md §0：双阶段审查工作流（Stage 1 微观逻辑扫描 → Stage 2 宏观架构扫描）
- AGENTS.md §5.7：基础 C 语义与编译器陷阱 — 传值/volatile/数组越界/变量遮蔽
- SKILL.md QuickRef 表：新增 Stage 列，每行标注所属阶段

### 修复
- 修复 §4.5 被错误插入到 §6 之后的问题（移至 §4.4 后正确位置）
- 修复 SKILL.md 引用 §5.4→§5.7（v1.3 改号）
- 修复 QuickRef 表 Stage/Priority 列错位

## [1.2.0] — 2026-07-09

### 新增
- SKILL.md §1.5：执行路径追踪 — 先扫描 main() 建立调用图，死代码降级为 🟡 MEDIUM
- AGENTS.md §2.7：控制算法连续性规则 — 三角函数分段边界误报预防
- AGENTS.md §4.5：架构原子性白名单 — Cortex-M3/M4/M7 32位对齐单拷贝原子说明
- AGENTS.md 报告模板：新增 Call path 字段 — 🔴/🟠 级问题必须注明调用路径

### 修复
- 修复潜伏代码被误报为 🔴 CRITICAL 的问题（未被调用的函数中的配置冲突）
- 修复 float 跨中断变量被误报为 🔴 CRITICAL 的问题（M4 硬件原子性）
- 修复 SVPWM 扇区边界被误报为 discontinuity 的问题（数学连续性验证）

## [1.1.0] — 2026-07-09

### 新增
- SKILL.md：补全触发词列表（valgrind, concept, rvalue, move semantics, C++23, 等 20+ 关键词）
- AGENTS.md §1.5：新增 Borrowed Lifetimes 子规则（检测返回裸指针的生命周期隐式绑定）
- AGENTS.md §2.6：新增 C ABI Contexts 子规则（检测非标准布局类型过 extern "C" 边界）
- references/cpp-modern.md：从 33 行扩展至 175 行，新增 5 个 C++20/23 深度审查章节
  - Concepts：requires 误用、约束满足性 SFINAE 交互
  - Ranges & Views：view dangling、惰性求值陷阱、borrowed range
  - Coroutines：promise 对象泄漏、co_await 生命周期
  - std::span：悬垂 span、size 不匹配
  - std::format：编译时类型安全格式化
- 增加 Review Checklist 章节

### 修复
- 修复 AGENTS.md §1.5 示例中 `data` 越域访问问题
- 修复 references/cpp-modern.md §std::format 示例放在全局作用域的编译错误

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
