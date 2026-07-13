// style_audit.js — Code style & project structure auditor (v1.5)
// Detects: sentinel assignments (B16), EXTI wrong file (B17), file-scope global i/j/k
// Usage: node style_audit.js <target-dir>

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release', '.vscode'];
const SORT_KEYWORDS = /\b(sort|partition|qsort|qusort|quick|pivot|swap)\b/i;

function collectFiles(dirOrDirs, results = []) {
    const dirs = dirOrDirs.split(',').map(d => d.trim()).filter(d => d);
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && !IGNORE_DIRS.includes(e.name)) collectFiles(full, results);
            else if (e.isFile() && /\.(c|cpp)$/i.test(e.name)) results.push(full);
        }
    }
    return results;
}

function hasContext(lines, idx, keywords, range = 10) {
    const start = Math.max(0, idx - range);
    const end = Math.min(lines.length, idx + range + 1);
    for (let i = start; i < end; i++) {
        if (keywords.test(lines[i])) return true;
    }
    return false;
}

function detectSentinelAssignments(content, filePath) {
    const issues = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/(\w+)\[(\d+)\]\s*=\s*\w+\[\s*[^\]]+\]/);
        if (m && m[2] === '0' && hasContext(lines, i, SORT_KEYWORDS)) {
            issues.push({
                id: 'B16',
                pattern: 'sentinel_assignment',
                severity: 'MEDIUM',
                file: filePath,
                line: i + 1,
                detail: `${m[1]}[0] = ${m[1]}[...] in sort/search context — potential sentinel misuse`
            });
        }
    }
    return issues;
}

function detectEXTIFilePlacement(content, filePath) {
    const issues = [];
    const fileName = path.basename(filePath);

    // Skip files that are expected to contain EXTI code
    if (/^(bsp_exti|exti|stm32.*it|gpio)/i.test(fileName)) return issues;

    // Match EXTI-specific init functions (NOT generic NVIC priority setting)
    const hasEXTIInit = /\b(HAL_EXTI_Init|EXTI_Init)\s*\(/.test(content);
    const hasEXTIPriority = /\bHAL_NVIC_SetPriority\s*\(\s*EXTI[0-9]*_IRQn/.test(content);

    if (hasEXTIInit || hasEXTIPriority) {
        issues.push({
            id: 'B17',
            pattern: 'exti_wrong_file',
            severity: 'MEDIUM',
            file: filePath,
            line: 1,
            detail: `EXTI/NVIC init in ${fileName}, expected in bsp_exti.c or gpio.c`
        });
    }
    return issues;
}

function detectFileScopeGlobals(content, filePath) {
    const issues = [];
    // Strip comments and strings BEFORE brace counting to prevent interference
    const stripped = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
        .replace(/"[^"]*"/g, '""')
        .replace(/'[^']*'/g, "''");
    const strippedLines = stripped.split('\n');
    const rawLines = content.split('\n');

    let braceDepth = 0;
    for (let i = 0; i < rawLines.length; i++) {
        const rawLine = rawLines[i];
        const cleanLine = strippedLines[i];

        // Count braces in this line (clean = no comment/string interference)
        const opens = (cleanLine.match(/{/g) || []).length;
        const closes = (cleanLine.match(/}/g) || []).length;

        // Only check for globals when at file scope (depth 0)
        if (braceDepth === 0) {
            // Use cleanLine (comment/string stripped) to avoid false positives on comments/#defines
            const lineToCheck = cleanLine.trim();
            if (lineToCheck && !lineToCheck.startsWith('#')) {
                const m = lineToCheck.match(/^(?!.*static)\s*(int|float|char|double|uint8_t|uint16_t|uint32_t)\s+(i|j|k|cnt|temp|buf|ret|tmp)\s*[=;\[]/);
                if (m) {
                    issues.push({
                        id: 'B15',
                        pattern: 'file_scope_global',
                        severity: 'HIGH',
                        file: filePath,
                        line: i + 1,
                        detail: `Non-static global '${m[2]}' at file scope — should be static`
                    });
                }
            }
        }

        braceDepth += (opens - closes);
    }
    return issues;
}

function main(dir) {
    const files = collectFiles(dir);
    const issues = [];
    for (const f of files) {
        const content = fs.readFileSync(f, 'utf-8');
        issues.push(...detectSentinelAssignments(content, f));
        issues.push(...detectEXTIFilePlacement(content, f));
        issues.push(...detectFileScopeGlobals(content, f));
    }
    return issues;
}

const targetDir = process.argv[2] || '.';
console.error(`[style_audit] Scanning ${targetDir}...`);
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
