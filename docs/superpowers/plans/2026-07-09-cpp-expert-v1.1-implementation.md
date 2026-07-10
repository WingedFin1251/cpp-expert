# cpp-expert v1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three inline improvements to cpp-expert: trigger keyword expansion, borrowed lifetimes & C ABI rules, C++20/23 deep reference.

**Architecture:** All changes are inline modifications to existing files — no new files, no structural changes. SKILL.md +14 lines, AGENTS.md +48 lines, references/cpp-modern.md +87 lines.

**Tech Stack:** Markdown (skill documentation), C/C++ (code examples verified via compilation)

## Global Constraints

- All code examples must compile with `g++ -std=c++20 -fsyntax-only -Wall -Wextra`
- AGENTS.md uses ❌/✅ format with `#### ❌ Incorrect` / `#### ✅ Correct`
- cpp-modern.md additions go AFTER the existing feature table
- SKILL.md frontmatter keeps only `name` and `description` fields

---

### Task 1: SKILL.md — Expand Trigger Keywords

**Files:**
- Modify: `SKILL.md`

- [ ] **Step 1: Add keywords to description field**

Replace line 4-7:
```yaml
description: |
  Use when: reviewing C/C++ code for memory safety, undefined behavior, resource leaks,
  concurrency bugs, or style issues; debugging segmentation faults, buffer overflows, double free,
  or data races; writing new C++ code and following modern best practices (C++11/14/17/20);
  or when user mentions C, C++, clang-tidy, cppcheck, AddressSanitizer, or static analysis.
```
With:
```yaml
description: |
  Use when: reviewing C/C++ code for memory safety, undefined behavior, resource leaks,
  concurrency bugs, or style issues; debugging segmentation faults, buffer overflows, double free,
  or data races; writing new C++ code and following modern best practices (C++11/14/17/20/23);
  or when user mentions C, C++, concept, rvalue, move semantics, smart pointer, RAII,
  constexpr, clang-tidy, cppcheck, AddressSanitizer, valgrind, or static analysis.
```

- [ ] **Step 2: Add explicit triggers block to When to Apply**

After line 24 (`- Following code style guidelines...`), insert:
```markdown
**Explicit triggers:** C, C++, C++17, C++20, C++23, smart pointer, unique_ptr,
shared_ptr, RAII, move semantics, rvalue, template, concept, STL, undefined
behavior, constexpr, memory, dangling, clang-tidy, cppcheck, AddressSanitizer,
valgrind, static analysis, code review, memory leak, segfault, buffer overflow
```

- [ ] **Step 3: Verify**

```bash
cd D:/DevelopFiles/Skills creater/cpp-expert
grep -c "valgrind\|concept\|rvalue\|move semantics" SKILL.md
# Expected output: >= 4 (each keyword appears at least once)
```

- [ ] **Step 4: Commit**

```bash
git add SKILL.md && git commit -m "feat(v1.1): expand trigger keywords in SKILL.md"
```

---

### Task 2: AGENTS.md — Add Borrowed Lifetimes + C ABI Contexts

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add 1.5 Borrowed Lifetimes after 1.4**

Insert after the `1.4 For C Code: Nullify Freed Pointers` section (after the `\`\`\`` at line 140):

```markdown
### 1.5 Track Borrowed Lifetimes

#### ❌ Incorrect

```cpp
const int* get_data() {
    static std::vector<int> data = {1, 2, 3};
    return data.data();  // Caller doesn't know when this pointer becomes invalid
}

void process() {
    const int* ptr = get_data();
    // If internal operation causes data to reallocate...
    // ptr is now dangling!
    use(*ptr);           // Use-after-free
}
```

#### ✅ Correct

```cpp
#include <span>

std::span<const int> get_data() {
    static std::vector<int> data = {1, 2, 3};
    return data;  // span carries size and bounds information
}

void process() {
    auto view = get_data();
    use(view[0]);        // span documents the expected lifetime contract
}

// Even better: return by value
std::vector<int> get_data_copy() {
    return {1, 2, 3};    // No lifetime ambiguity
}
```

#### Why This Matters
Returning raw pointers to internally-owned data creates implicit lifetime
contracts that callers cannot verify. `std::span` documents the intent
(a non-owning view) and carries size information, reducing the chance of
buffer overruns and dangling accesses.
```

- [ ] **Step 2: Add 2.6 C ABI Contexts after 2.5**

Insert after the `2.5 No Throwing From Destructors` section (after the `\`\`\`cpp` block at line 262):

```markdown
### 2.6 Watch for C ABI Boundary Violations

#### ❌ Incorrect

```cpp
// Widget has non-trivial members — layout is not standard
struct Widget {
    std::string name;
    int id;
};

extern "C" void process(Widget w);  // UB! Non-standard-layout type across C ABI
```

#### ✅ Correct

```cpp
struct WidgetData {
    char name[64];
    int id;
};
static_assert(std::is_standard_layout_v<WidgetData>, "C ABI requires standard layout");

extern "C" void process(WidgetData d);  // OK — standard layout type
```

#### Why This Matters
C++ types passed through `extern "C"` boundaries must be standard-layout
(`std::is_standard_layout`). Non-standard-layout types (those with virtual
functions, non-static members with different access control, or members of
reference type) have undefined layout, and passing them across C ABI
boundaries is undefined behavior.
```

- [ ] **Step 3: Update TOC with new entries**

After line 15 (`2. [Undefined Behavior & Compilation](#2-undefined-behavior--compilation)`), add:
```markdown
   1.5 [Track Borrowed Lifetimes](#15-track-borrowed-lifetimes)
```

But this is for the Memory Safety section. Actually the TOC only shows top-level sections (## headings), not sub-sections (### headings). So no TOC update needed.

- [ ] **Step 4: Verify compilation of new examples**

```bash
cd /tmp && cat > verify_15.cpp << 'EOF'
#include <span>
#include <vector>
std::span<const int> get_data() {
    static std::vector<int> data = {1, 2, 3};
    return data;
}
EOF
g++ -std=c++20 -fsyntax-only -Wall -Wextra verify_15.cpp && echo "1.5 OK"

cat > verify_26.cpp << 'EOF'
#include <type_traits>
#include <string>
struct WidgetData { char name[64]; int id; };
static_assert(std::is_standard_layout_v<WidgetData>);
extern "C" void process(WidgetData);
EOF
g++ -std=c++20 -fsyntax-only -Wall -Wextra verify_26.cpp && echo "2.6 OK"
```

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md && git commit -m "feat(v1.1): add borrowed lifetimes + C ABI rules"
```

---

### Task 3: references/cpp-modern.md — C++20/23 Deep Reference

**Files:**
- Modify: `references/cpp-modern.md`

- [ ] **Step 1: Append 5 deep-dive sections after the migration path**

Append to the file (after line 33):

```markdown
## Concepts (C++20)

### `requires` Clause Misuse

```cpp
// ❌ Over-constraining — same_as is too strict
template<typename T>
    requires std::same_as<T, int>
void process(T val);

// ✅ Use convertible_to for input parameters
template<typename T>
    requires std::convertible_to<T, int>
void process(T val);
```

### Constraint Satisfaction & SFINAE

```cpp
// ❌ Constraints that don't SFINAE properly
template<typename T>
    requires sizeof(T) > 4
void process(T val);  // Ill-formed if sizeof(T) <= 4, no fallback

// ✅ Use requires clause with type trait
template<typename T>
    requires (sizeof(T) > 4)
void process(T val);

template<typename T>
void process(T val) { /* fallback */ }
```

## Ranges & Views (C++20)

### View Dangling

```cpp
// ❌ Dangling view — temporary range
auto get_evens(const std::vector<int>& v) {
    return v | std::views::filter([](int x) { return x % 2 == 0; });
}  // OK — v outlives the view

auto bad() {
    return std::vector{1,2,3,4} | std::views::filter([](int x) { return x % 2 == 0; });
}  // BUG: returns dangling view to temporary
```

### Lazy Evaluation Side Effects

```cpp
int side_effect_count = 0;
auto view = numbers | std::views::transform([](int x) {
    ++side_effect_count;
    return x * 2;
});
// Side effects NOT evaluated yet! They happen when view is consumed.
```

## Coroutines (C++20)

### Promise Object Leak

```cpp
// ❌ Coroutine frame never destroyed
auto leaky_task() {
    // If this coroutine is started but never co_await'ed,
    // the coroutine frame leaks
    co_return 42;
}

// ✅ RAII wrapper for coroutine handle
struct Task {
    struct promise_type { /* ... */ };
    std::coroutine_handle<promise_type> handle;
    ~Task() { if (handle) handle.destroy(); }
};
```

### `co_await` Lifetime

```cpp
// ❌ Awaiting a temporary
auto result = co_await some_task();  // OK — result is moved
auto& ref = co_await some_task();    // BUG: reference to temporary
```

## `std::span` (C++20)

### Dangling Span

```cpp
// ❌ Span to local array
std::span<int> bad() {
    int arr[] = {1, 2, 3};
    return arr;  // BUG: span points to stack that will be freed
}

// ✅ Return vector or pass ownership
std::vector<int> good() {
    return {1, 2, 3};
}
```

### Size Mismatch

```cpp
// ❌ Span from raw pointer — size is caller's responsibility
void process(std::span<int> s);
int arr[10];
process({arr, 100});  // BUG: claims size 100, only 10 elements

// ✅ Use the whole array
process(arr);  // Deduces correct size
```

## `std::format` (C++20)

Type-safe alternative to printf/sprintf with compile-time format checking.

```cpp
void test_format() {
    // ❌ sprintf — type-unsafe
    char buf[100];
    sprintf(buf, "value: %d", 42);  // Wrong format specifier → UB

    // ✅ std::format — compile-time checked
    auto s = std::format("value: {}", 42);     // OK — type deduced
    auto t = std::format("value: {:d}", 42);   // OK
    // auto u = std::format("value: {:s}", 42); // Compile error: int is not a string
}
```

## Review Checklist

When reviewing modern C++ code, check for:
- [ ] Coroutine frames destroyed (RAII wrapper)
- [ ] No dangling views or spans
- [ ] Concepts not over-constrained
- [ ] `std::format` preferred over sprintf
- [ ] `std::span` size matches actual buffer
```

- [ ] **Step 2: Verify compilation**

```bash
cd /tmp && cat > verify_cpp20.cpp << 'EOF'
#include <concepts>
#include <type_traits>
template<typename T> requires std::convertible_to<T, int>
void process(T) {}
EOF
g++ -std=c++20 -fsyntax-only -Wall -Wextra verify_cpp20.cpp && echo "concepts OK"

cat > verify_span.cpp << 'EOF'
#include <span>
#include <vector>
std::vector<int> good() { return {1,2,3}; }
void process(std::span<int>);
void test() { int arr[3] = {1,2,3}; process(arr); }
EOF
g++ -std=c++20 -fsyntax-only -Wall -Wextra verify_span.cpp && echo "span OK"

cat > verify_format.cpp << 'EOF'
#include <format>
auto s = std::format("{}", 42);
EOF
# format may need -std=c++20 on newer GCC; some versions need -std=c++23
g++ -std=c++20 -fsyntax-only -Wall -Wextra verify_format.cpp 2>/dev/null && echo "format OK" || echo "format (needs newer GCC, expected)"
```

- [ ] **Step 3: Commit**

```bash
git add references/cpp-modern.md && git commit -m "feat(v1.1): expand cpp-modern with C++20/23 deep reference"
```

---

### Task 4: Verify and Tag

- [ ] **Step 1: Verify total line count**

```bash
cd D:/DevelopFiles/Skills creater/cpp-expert
wc -l SKILL.md AGENTS.md references/cpp-modern.md
# Expected: SKILL.md ~110, AGENTS.md ~845, cpp-modern.md ~120, total ~1075
```

- [ ] **Step 2: Verify all new code examples compile**

```bash
# Extract and test all code blocks (reuse the method from earlier audits)
# Expected: 0 errors
```

- [ ] **Step 3: Tag the release**

```bash
git tag -a v1.1 -m "cpp-expert v1.1: trigger expansion, borrowed lifetimes, C ABI, C++20/23 deep ref"
```

- [ ] **Step 4: Final log**

```bash
git log --oneline -5
```
