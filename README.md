# cpp-expert

**C/C++ 代码审查技能 — 基于 8 维度优先级规则的自动化代码质量检查，集成 clang-tidy / cppcheck / AddressSanitizer 工具链。**

**A C/C++ code review skill — automated quality checks based on 8 priority-ranked rule dimensions, integrating clang-tidy / cppcheck / AddressSanitizer toolchains.**

> 灵感来自 [python-expert](https://skills.sh/)，专为 C/C++ 内存安全、未定义行为、资源管理、并发安全、现代 C++ 实践和代码风格审查设计。
>
> Inspired by [python-expert](https://skills.sh/), designed specifically for C/C++ memory safety, undefined behavior, resource management, concurrency safety, modern C++ practices, and code style review.

---

## 目录 / Table of Contents
- [快速开始 / Quick Start](#快速开始--quick-start)
- [技能结构 / Skill Structure](#技能结构--skill-structure)
- [规则体系 / Rule System](#规则体系--rule-system)
- [工作流程 / Workflow](#工作流程--workflow)
- [工具脚本 / Tool Scripts](#工具脚本--tool-scripts)
- [代码审查输出格式 / Review Output Format](#代码审查输出格式--review-output-format)
- [参考链接 / References](#参考链接--references)
- [许可 / License](#许可--license)

---

## 快速开始 / Quick Start

### 安装 / Installation
```bash
# 方式一：通过 skills CLI（推荐）
# Option 1: Via skills CLI (recommended)
npx skills add WingedFin1251/cpp-expert

# 方式二：手动复制到项目
# Option 2: Manually copy into your project
cp -r cpp-expert <your-project>/.agents/skills/
```

### 使用 / Usage
在 Claude Code 中，当你的问题涉及 C/C++ 代码时，技能会自动触发。你也可以直接要求：

In Claude Code, the skill triggers automatically when your question involves C/C++ code. You can also explicitly ask:

```
审查这段 C++ 代码的内存安全性
Review this C++ code for memory safety
帮我检查有没有未定义行为
Check if there's any undefined behavior
运行静态分析脚本检查这个文件
Run the static analysis script on this file
```

---

## 技能结构 / Skill Structure

```
cpp-expert/
├── SKILL.md                    # 入口：触发条件 + Rule 0 + 10步工作流
│                               # Entry: triggers + Rule 0 + 10-step workflow
├── AGENTS.md                   # 完整规则参考：8维度(含v1.1新增) × ❌/✅ 示例
│                               # Full rule reference: 8 dimensions (incl. v1.1) × ❌/✅ examples
├── references/
│   ├── memory-safety.md        # 智能指针指南 + 泄漏/溢出/UAF 检查清单
│   │                           # Smart pointer guide + leak/overflow/UAF checklists
│   ├── compiler-errors.md      # 常见编译错误速查 + 段错误排查
│   │                           # Common compile errors quick ref + segfault debugging
│   └── cpp-modern.md           # C++11→C++23 特性对照表 + Concepts/Ranges/Coroutines/span/format 深度审查
│                               # C++11→C++23 feature matrix + deep-dive: Concepts, Ranges, Coroutines, span, format
└── scripts/
    ├── run-static-analysis.sh  # clang-tidy + cppcheck 自动化脚本
    │                           # clang-tidy + cppcheck automation
    └── run-sanitizers.sh       # AddressSanitizer + UBSan 运行脚本
                                # AddressSanitizer + UBSan runner
```

---

## 规则体系 / Rule System

8 个检查维度按优先级排列 / Eight review dimensions ordered by priority:

| 优先级 / Priority | 维度 / Dimension | 关键检查项 / Key Checks |
| :---------------- | :--------------- | :---------------------- |
| 🔴 **CRITICAL** | 内存安全 / Memory Safety | 智能指针 vs 裸指针、悬空引用、缓冲区溢出、内存泄漏、UAF / Smart vs raw pointers, dangling refs, buffer overflow, leaks, UAF |
| 🔴 **CRITICAL** | UB & 编译 / UB & Compilation | 整数溢出、未初始化变量、strict aliasing、虚析构、ODR / Integer overflow, uninit vars, strict aliasing, virtual dtor, ODR |
| 🔴 **CRITICAL** | 借用生命周期 / Borrowed Lifetimes (v1.1) | 返回内部指针的隐式生命周期绑定、std::span 替代裸指针 / Implicit lifetime contracts, std::span over raw ptrs |
| 🔴 **CRITICAL** | C ABI 边界 / C ABI Contexts (v1.1) | 非标准布局类型过 extern "C"、is_standard_layout 检查 / Non-standard-layout across extern "C" |
| 🟠 **HIGH** | RAII & 资源 / RAII & Resources | Rule of Five、异常安全、vector vs 数组、OS 资源封装 / Rule of Five, exception safety, vector vs arrays, OS resource wrappers |
| 🟠 **HIGH** | 并发安全 / Concurrency Safety | 数据竞争、锁顺序、死锁、atomic、条件变量 / Data races, lock ordering, deadlock, atomic, condition variables |
| 🟡 **MEDIUM** | 现代 C++ / Modern C++ | `auto`、`constexpr`、`nullptr`、`override`、`enum class`、`[[nodiscard]]` |
| 🟡 **MEDIUM** | 代码风格 / Code Style | 命名规范、头文件组织、include 顺序、const 正确性 / Naming, header organization, include order, const correctness |

### Rule 0：语言识别（元规则） / Rule 0: Language Identification (Meta-Rule)
自动识别 C 还是 C++ 代码，根据扩展名、关键语法和标准库。如果是纯 C 代码，跳过"现代 C++"维度并调整内存安全建议。

Automatically identifies whether the code is C or C++ based on file extension, key syntax constructs, and standard libraries. For pure C code, the "Modern C++" dimension is skipped and memory safety advice is adjusted accordingly.

---

## 工作流程 / Workflow

当技能触发时，AI 依次执行 / When the skill triggers, the AI executes in sequence:

```
1. 语言检测 / Language detection
   → 2. 编译验证 / Compilation check (-fsyntax-only)
3. 内存安全审查 / Memory safety review
   → 4. UB/编译审查 / UB & compilation review
5. RAII/资源审查 / RAII & resource review
   → 6. 并发安全审查 / Concurrency safety review
7. 现代 C++ 建议 / Modern C++ suggestions
   → 8. 风格审查 / Style review
9. 运行工具脚本 / Run tool scripts
   → 10. 生成结构化报告 / Generate structured report
```

---

## 工具脚本 / Tool Scripts

### `run-static-analysis.sh`
对指定 C/C++ 源文件运行 clang-tidy + cppcheck / Runs clang-tidy + cppcheck on the specified C/C++ source file.

```bash
bash scripts/run-static-analysis.sh src/main.cpp
```

自动探测 `compile_commands.json`（CMake 生成的编译数据库），缺失时降级运行并给出警告。

Automatically probes for `compile_commands.json` (the compilation database generated by CMake), falling back to a degraded run with a warning when it's missing.

### `run-sanitizers.sh`
使用 AddressSanitizer + UndefinedBehaviorSanitizer 编译并运行 / Compiles and runs with AddressSanitizer + UndefinedBehaviorSanitizer.

```bash
bash scripts/run-sanitizers.sh src/main.cpp
```

自动识别 C 还是 C++（根据扩展名），自动切换 `gcc`/`g++` 和对应的 `-std=` 标准。

Automatically detects C vs C++ (by file extension) and switches between `gcc`/`g++` and the corresponding `-std=` standard.

> ⚠️ **安全警告 / Security Warning**：该脚本会编译并执行用户提供的代码。请在沙盒或容器中运行不可信的代码。
>
> This script compiles and executes user-provided code. Run untrusted code in a sandbox or container.

---

## 代码审查输出格式 / Review Output Format

审查结果按优先级分三区，附工具输出 / Results are organized into three priority tiers with tool output appended:

```
## Summary
- 代码总体评价 / Overall assessment of the code

## Critical Issues 🔴
- 内存安全 / UB 问题（需立即修复）
- Memory safety / UB issues (fix immediately)

## High Priority 🟠
- RAII / 并发问题（需合并前修复）
- RAII / concurrency issues (fix before merge)

## Medium Priority 🟡
- 现代 C++ / 风格建议（可选修复）
- Modern C++ / style suggestions (optional fix)

## Tool Results
- Syntax Check (g++ -fsyntax-only)
- Static Analysis (clang-tidy + cppcheck)
- Sanitizer (ASan/UBSan) — if run

## Issue Count + Recommendation
```


## 参考链接 / References
- [cppreference.com](https://en.cppreference.com/) 
- [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/) 
- [SEI CERT C++ Coding Standard](https://wiki.sei.cmu.edu/confluence/pages/viewpage.action?pageId=88046682) 
- [Clang-Tidy Docs](https://clang.llvm.org/extra/clang-tidy/) 
- [Cppcheck Manual](https://cppcheck.sourceforge.io/manual.pdf) 
- [AddressSanitizer](https://clang.llvm.org/docs/AddressSanitizer.html) 
- [Claude Code Skills 文档 / Claude Code Skills Docs](https://docs.anthropic.com/en/docs/claude-code/skills) 
- [skills.sh 技能市场 / skills.sh Marketplace](https://skills.sh/) 

### 版本历史 / Version History
- **v1.2** — 执行路径追踪（死代码降级）、架构原子性白名单（Cortex-M4 32位对齐）、控制算法连续性审查、报告模板要求 Call Path / Execution path tracing, Cortex-M atomicity whitelist, control algorithm continuity, call-path in reports
- **v1.1** — 新增 Borrowed Lifetimes 和 C ABI 规则、C++20/23 深度参考（Concepts/Ranges/Coroutines/span/format）、触发词扩展、Review Checklist / Added borrowed lifetimes & C ABI rules, C++20/23 deep reference, trigger expansion, review checklist
- **v1.0** — 初始版本：8维度规则体系、3 参考文件、2 工具脚本 / Initial release: 8-dimension rule system, 3 reference files, 2 tool scripts

---

## 许可 / License

MIT

---
