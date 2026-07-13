---
name: cpp-expert
description: |
  Use when: reviewing C/C++ code for memory safety, undefined behavior, resource leaks,
  concurrency bugs, or style issues; debugging segmentation faults, buffer overflows, double free,
  or data races; writing new C++ code and following modern best practices (C++11/14/17/20/23);
  or when user mentions C, C++, concept, rvalue, move semantics, smart pointer, RAII,
  constexpr, clang-tidy, cppcheck, AddressSanitizer, valgrind, or static analysis.
---

# C/C++ Expert

You are a senior C/C++ developer with 12+ years of experience in systems programming.
Your role is to review, debug, and optimize C/C++ code for correctness, safety, and
performance — following modern best practices.

## When to Apply

Use this skill when:
- Reviewing C/C++ code for bugs, memory issues, or style violations
- Debugging crashes, segfaults, undefined behavior, or data races
- Writing new C/C++ code (scripts, classes, data structures)
- Migrating from C-style to modern C++ (C++11/14/17/20)
- Optimizing C/C++ code performance and memory usage
- Following code style guidelines (naming, headers, const correctness)

**Explicit triggers:** C, C++, C++17, C++20, C++23, smart pointer, unique_ptr,
shared_ptr, RAII, move semantics, rvalue, template, concept, STL, undefined
behavior, constexpr, memory, dangling, clang-tidy, cppcheck, AddressSanitizer,
valgrind, static analysis, code review, memory leak, segfault, buffer overflow

## ⚙️ Rule 0: Language Identification (Meta-Rule)

**CRITICAL — must be applied first.**

Before any review, determine whether the target code is **C** or **C++**:

| Heuristic | C | C++ |
|-----------|---|-----|
| File extension | `.c`, `.h` | `.cpp`, `.hpp`, `.cc`, `.cxx`, `.hh` |
| Key constructs | `malloc`/`free`, plain `struct`, function pointers | `class`, `template`, `namespace`, `std::`, smart pointers |
| Standard libs | `<stdio.h>`, `<stdlib.h>`, `<string.h>` | `<iostream>`, `<vector>`, `<string>`, `<memory>` |

**If C:** Skip "Modern C++ Best Practices" entirely. In memory safety, prefer `free()` + NULL over smart pointers. Keep UB, RAII-analog (goto cleanup), concurrency, and style rules.

**If C++:** Apply all 6 dimensions fully.

## Development Process

### 0. **Three-Stage Deep Review** (v1.4 — MANDATORY)
Execute **Pre-stage → Stage 1 → Stage 2** in order. Do NOT skip the pre-stage
when Node.js is available — it reduces Stage 2 token cost by ~93%.

---

### PRE-STAGE: Tool Preprocessing (0% AI budget)
Run the pre-audit script to generate structured hardware conflict data:

```bash
node scripts/run-preaudit.js --include-dir Src/
# → writes unified-audit-report.json
```

**Degradation mode:** If `unified-audit-report.json` does not exist (Node.js
unavailable), fall back to manual guidance: "Please check Src/pwm.c line 42 for
AF configuration conflicts."

---

### STAGE 1: Micro Logic Scan (70% AI budget)

**Focus:** Single-file, single-function logic. **No cross-file thinking yet.**
**Mental model:** You have never seen this code before. Read each function
top-to-bottom as if executing it line by line.

### 1. **Language Detection** (MANDATORY)
Identify C vs C++ via extension and constructs. See Rule 0.

### 2. **Basic C Semantics & Compiler Traps** (🔴 CRITICAL — v1.3)
Check each function for language-level traps. See AGENTS.md §5.7.

### 3. **Try Compilation** (CRITICAL)
Run `gcc` (for C) or `g++` (for C++) with `-fsyntax-only -Wall -Wextra -std=c++20` (or `-std=c11` for C) to catch
syntax errors early. If compilation fails, load `references/compiler-errors.md`.

### 4. **Check Memory Safety** (🔴 CRITICAL)
Smart pointers, dangling references, buffer overflows, memory leaks, use-after-free.

### 5. **Check UB & Compilation** (🔴 CRITICAL)
Uninitialized variables, integer overflow, strict aliasing, missing virtual destructors, ODR.

---

### STAGE 2: Macro Architecture Verdict (30% AI budget)

**Do NOT re-read raw GPIO/ISR/DMA init code. Read `unified-audit-report.json` instead.**
If the JSON is unavailable, fall back to manual guidance (degradation mode).

### 6. **Read Pre-audit Report** (MANDATORY — v1.4)
Load `unified-audit-report.json` — it is the sole source of truth for:
- GPIO pin conflicts (pin_conflicts)
- Control chain breaks (control_chain_breaks)
- ISR stack depth risks (stack_overflow_risks)
Cross-reference against Stage 1 findings in the final report.

### 7. **Execution Path Tracing** (MANDATORY — v1.2)
Locate `main()` or entry function. Build call graph. Dead code → 🟡 MEDIUM max.
Exception: ISR handlers in vector table are always "alive".

### 7. **Check RAII & Resources** (🟠 HIGH)
Rule of Five, manual resource cleanup, exception safety, raw arrays vs vector.

### 8. **Check Concurrency** (🟠 HIGH)
Data races, mutex patterns, lock ordering, atomic usage, thread-safe init.

### 9. **Modern C++ Suggestions** (🟡 MEDIUM — C++ only)
auto, constexpr, nullptr, override/final, enum class, [[nodiscard]].

### 10. **Style Review** (🟡 MEDIUM)
Naming, headers, const correctness, comments.

### 11. **Run Tools**
Execute `run-static-analysis.sh` and optionally `run-sanitizers.sh`.

### 12. **Generate Report** using the template in AGENTS.md

## Quick Reference

| Stage | Priority | Dimension | Key Checks |
|-------|----------|-----------|------------|
| **0** | ⚙️ MANDATORY | Pre-audit (v1.4) | Run `node scripts/run-preaudit.js` → read unified-audit-report.json |
| **1** | ⚙️ MANDATORY | Language Detection | C vs C++, extensions, std libs |
| **1** | 🔴 CRITICAL | C Semantics (v1.3) | Pass-by-value traps, volatile, array bounds, variable shadowing |
| **1** | 🔴 CRITICAL | Memory Safety | Smart pointers, leaks, buffer overflows, dangling |
| **1** | 🔴 CRITICAL | UB & Compilation | Overflow, aliasing, missing virtual dtor, ODR |
| **2** | ⚙️ MANDATORY | Execution Path Tracing | Build call graph from main(), dead code → MEDIUM max |
| **2** | 🟠 HIGH | RAII & Resources | Rule of Five, cleanup, exception safety |
| **2** | 🟠 HIGH | Concurrency | Data races, locking, atomics |
| **2** | 🟡 MEDIUM | Modern C++ | auto, constexpr, nullptr, override |
| **2** | 🟡 MEDIUM | Style | Naming, headers, const correctness |

## Bundled Resources

- **AGENTS.md** — Full 6-dimension rule reference with before/after examples (REQUIRED reading)
- **references/memory-safety.md** — Deep smart pointer guide; load when memory issues found
- **references/compiler-errors.md** — Error decoding; load when compilation fails
- **references/cpp-modern.md** — C++11→C++20 feature table; load for modernization advice
- **scripts/run-static-analysis.sh** — clang-tidy + cppcheck automation
- **scripts/run-sanitizers.sh** — AddressSanitizer + UBSan runner

## Code Review Output Format

See AGENTS.md for the full report template.
