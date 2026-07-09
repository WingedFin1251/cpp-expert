# cpp-expert

C/C++ 代码审查技能 — 基于 6 维度优先级规则的自动化代码质量检查，集成 clang-tidy / cppcheck / AddressSanitizer 工具链。

> 灵感来自 [python-expert](https://skills.sh/)，专为 C/C++ 内存安全、未定义行为、资源管理、并发安全、现代 C++ 实践和代码风格审查设计。

## 快速开始

### 安装

```bash
# 方式一：通过 skills CLI（推荐）
npx skills add anthropics/skills@skill-creator

# 方式二：手动复制到项目
cp -r cpp-expert <your-project>/.agents/skills/
```

### 使用

在 Claude Code 中，当你的问题涉及 C/C++ 代码时，技能会自动触发。你也可以直接要求：

```
审查这段 C++ 代码的内存安全性
帮我检查有没有未定义行为
运行静态分析脚本检查这个文件
```

## 技能结构

```
cpp-expert/
├── SKILL.md                    # 入口：触发条件 + Rule 0 + 10步工作流
├── AGENTS.md                   # 完整规则参考：6维度 × ❌/✅ 示例
├── references/
│   ├── memory-safety.md        # 智能指针指南 + 泄漏/溢出/UAF 检查清单
│   ├── compiler-errors.md      # 常见编译错误速查 + 段错误排查
│   └── cpp-modern.md           # C++11/14/17/20 特性对照表 + 迁移路径
└── scripts/
    ├── run-static-analysis.sh  # clang-tidy + cppcheck 自动化脚本
    └── run-sanitizers.sh       # AddressSanitizer + UBSan 运行脚本
```

## 规则体系

6 个检查维度按优先级排列：

| 优先级 | 维度 | 关键检查项 |
|--------|------|-----------|
| 🔴 **CRITICAL** | 内存安全 | 智能指针 vs 裸指针、悬空引用、缓冲区溢出、内存泄漏、UAF |
| 🔴 **CRITICAL** | UB & 编译 | 整数溢出、未初始化变量、strict aliasing、虚析构、ODR |
| 🟠 **HIGH** | RAII & 资源 | Rule of Five、异常安全、vector vs 数组、OS 资源封装 |
| 🟠 **HIGH** | 并发安全 | 数据竞争、锁顺序、死锁、atomic、条件变量 |
| 🟡 **MEDIUM** | 现代 C++ | auto、constexpr、nullptr、override、enum class、[[nodiscard]] |
| 🟡 **MEDIUM** | 代码风格 | 命名规范、头文件组织、include 顺序、const 正确性 |

### Rule 0：语言识别（元规则）

自动识别 C 还是 C++ 代码，根据扩展名、关键语法和标准库。如果是纯 C 代码，跳过"现代 C++"维度并调整内存安全建议。

## 工作流程

当技能触发时，AI 依次执行：

```
1. 语言检测 → 2. 编译验证(-fsyntax-only)
3. 内存安全审查 → 4. UB/编译审查
5. RAII/资源审查 → 6. 并发安全审查
7. 现代 C++ 建议 → 8. 风格审查
9. 运行工具脚本 → 10. 生成结构化报告
```

## 工具脚本

### `run-static-analysis.sh`

对指定 C/C++ 源文件运行 clang-tidy + cppcheck。

```bash
bash scripts/run-static-analysis.sh src/main.cpp
```

自动探测 `compile_commands.json`（CMake 生成的编译数据库），缺失时降级运行并给出警告。

### `run-sanitizers.sh`

使用 AddressSanitizer + UndefinedBehaviorSanitizer 编译并运行。

```bash
bash scripts/run-sanitizers.sh src/main.cpp
```

自动识别 C 还是 C++（根据扩展名）。自动切换 `gcc`/`g++` 和对应的 `-std=` 标准。

> ⚠️ **安全警告**：该脚本会编译并执行用户提供的代码。请在沙盒或容器中运行不可信的代码。

## 代码审查输出格式

审查结果按优先级分三区，附工具输出：

```
## Summary
- 代码总体评价

## Critical Issues 🔴
- 内存安全 / UB 问题（需立即修复）

## High Priority 🟠
- RAII / 并发问题（需合并前修复）

## Medium Priority 🟡
- 现代 C++ / 风格建议（可选修复）

## Tool Results
- Syntax Check (g++ -fsyntax-only)
- Static Analysis (clang-tidy + cppcheck)
- Sanitizer (ASan/UBSan) — 如果运行

## Issue Count + Recommendation
```

## 参考链接

- [cppreference.com](https://en.cppreference.com/)
- [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/)
- [SEI CERT C++ Coding Standard](https://wiki.sei.cmu.edu/confluence/pages/viewpage.action?pageId=88046682)
- [Clang-Tidy Docs](https://clang.llvm.org/extra/clang-tidy/)
- [Cppcheck Manual](https://cppcheck.sourceforge.io/manual.pdf)
- [AddressSanitizer](https://clang.llvm.org/docs/AddressSanitizer.html)

## 许可

MIT
