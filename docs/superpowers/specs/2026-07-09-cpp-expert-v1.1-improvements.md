# cpp-expert v1.1 改进设计

**日期：** 2026-07-09
**基于竞品调研：** skills.sh C/C++ 技能生态全量分析

## 改进范围

v1.1 聚焦 B 范围：**触发词补全 + Tr3kkR 检查项吸收 + C++20/23 深度覆盖**。所有改动内联到现有文件，不新增文件。

## 改动一：SKILL.md 触发词补全

### 变更内容

1. **`description` 字段** — 追加 `concept`、`rvalue`、`move semantics`、`valgrind` 关键词
2. **When to Apply** — 新增 `Explicit triggers:` 区块，罗列 20+ 可触发技能的关键词

### 受影响的行

- `description:` 增加 ~4 个关键词
- When to Apply 末尾新增 ~10 行触发词列表

## 改动二：AGENTS.md 新增检查维度

### 1.5 Borrowed Lifetimes（🔴 CRITICAL — 内存安全）

检查返回的指针/引用的生命周期是否隐式绑定到调用者的上下文。

```cpp
// ❌ Incorrect — 返回 data() 指针，调用者不知道有效期
const int* get_data() {
    static std::vector<int> data = {1, 2, 3};
    return data.data();
}

// ✅ Correct — 用 std::span 携带长度和生命周期信息
std::span<const int> get_data() {
    static std::vector<int> data = {1, 2, 3};
    return data;
}
```

### 2.6 C ABI Contexts（🔴 CRITICAL — UB & 编译）

检查 `extern "C"` 边界上传递的类型是否为标注布局（standard-layout），非标准布局类型过 C ABI 是未定义行为。

```cpp
// ❌ Incorrect — 非标准布局类型过 C ABI
extern "C" void process(Widget w);

// ✅ Correct — 只传 POD/标准布局
extern "C" void process(WidgetData d);
```

### 受影响的行

AGENTS.md 增加 ~45 行（2 个子规则）。

## 改动三：references/cpp-modern.md 深度扩展

从 33 行扩展到 ~120 行。保持现有特性对照表，下方追加 5 个深度审查章节：

### Concepts（约束编程）
- `requires` 子句常见误用
- 约束满足性检查的 SFINAE 交互
- `std::same_as` vs `std::convertible_to` 选择

### Ranges（视图与管道）
- `std::views::transform` / `filter` 惰性求值陷阱
- 视图悬挂（view dangling）
- 借用范围（borrowed range）概念

### Coroutines（协程）
- `co_await` 生命周期管理
- Promise 对象泄漏风险
- 协程帧的 RAII 包装

### `std::span`（连续区间视图）
- 悬垂 span（返回局部数组的 span）
- size 与 bounds 传递

### `std::format`（类型安全格式化）
- `std::format` vs `sprintf` vs `<<`
- 编译时格式检查

## 文件影响汇总

| 文件 | 当前行数 | 改动后 | 净增 |
|------|---------|--------|------|
| SKILL.md | 96 | ~110 | +14 |
| AGENTS.md | 797 | ~845 | +48 |
| references/cpp-modern.md | 33 | ~120 | +87 |
| **总计** | **926** | **~1,075** | **+149** |

## 不做的范围（明确排除）

- 不新增文件（方案 B/C 推迟到 v1.2）
- 不补充测试框架审查（推迟到 v1.2）
- 不增加 CMake 审查（推迟到 v1.2）
- 不新增脚本（run-valgrind.sh 推迟）
