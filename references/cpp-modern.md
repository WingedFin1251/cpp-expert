# Modern C++ Feature Quick Reference

## Feature By Standard

| Feature | C++11 | C++14 | C++17 | C++20 |
|---------|-------|-------|-------|-------|
| auto | ✅ basic | ✅ return type | ✅ | ✅ |
| constexpr | ✅ functions | ✅ relaxed | ✅ if/ Lambda | ✅ virtual/trivial |
| unique_ptr/shared_ptr | ✅ | ✅ | ✅ | ✅ |
| nullptr | ✅ | ✅ | ✅ | ✅ |
| override/final | ✅ | ✅ | ✅ | ✅ |
| enum class | ✅ | ✅ | ✅ | ✅ |
| Range-based for | ✅ | ✅ | ✅ | ✅ init-stmt |
| move semantics | ✅ | ✅ | ✅ | ✅ |
| lambda | ✅ | ✅ generic | ✅ constexpr | ✅ template |
| std::optional | ❌ | ❌ | ✅ | ✅ |
| std::variant | ❌ | ❌ | ✅ | ✅ |
| std::any | ❌ | ❌ | ✅ | ✅ |
| [[nodiscard]] | ❌ | ❌ | ✅ | ✅ |
| concepts | ❌ | ❌ | ❌ | ✅ |
| ranges | ❌ | ❌ | ❌ | ✅ |
| std::span | ❌ | ❌ | ❌ | ✅ |

## Migration Path: C++98 → C++17

1. `NULL` → `nullptr`
2. Raw `new`/`delete` → `unique_ptr`/`make_unique`
3. `typedef` → `using`
4. `class` with manual dtor/copy → Rule of Five or `=default`
5. `throw()` → `noexcept`
6. `std::auto_ptr` → `std::unique_ptr`
7. Raw arrays → `std::array` or `std::vector`
8. C-style casts → `static_cast`/`dynamic_cast`/`const_cast`
