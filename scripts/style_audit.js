// style_audit.js — Code style & project structure auditor (v1.5)
// Detects: sentinel assignments (B16), EXTI wrong file (B17), file-scope global i/j/k
// Usage: node style_audit.js [--dir Src]

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release', '.vscode'];
const EXTI_FILE_PATTERNS = [/bsp_exti/i, /exti/i, /gpio/i, /bsp_.*\.c$/];

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

function detectSentinelAssignments(content, filePath) {
    const issues = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/(\w+)\[(\d+)\]\s*=\s*\w+\[\s*[^\]]+\]/);
        if (m && m[2] === '0') {
            issues.push({
                id: 'B16',
                pattern: 'sentinel_assignment',
                severity: 'MEDIUM',
                file: filePath,
                line: i + 1,
                detail: `${m[1]}[0] = ${m[1]}[...] — potential sentinel misuse in sort/swap context`
            });
        }
    }
    return issues;
}

function detectEXTIFilePlacement(content, filePath) {
    const issues = [];
    const fileName = path.basename(filePath);
    const isExpectedFile = EXTI_FILE_PATTERNS.some(p => p.test(fileName));

    if (isExpectedFile) return issues; // Already in correct file

    const hasEXTICode = /EXTI|NVIC_Init|HAL_NVIC_SetPriority|GPIO_EXTI/.test(content);
    if (hasEXTICode) {
        issues.push({
            id: 'B17',
            pattern: 'exti_wrong_file',
            severity: 'MEDIUM',
            file: filePath,
            line: 1,
            detail: `EXTI/NVIC configuration in ${fileName}, expected in bsp_exti.c or gpio.c`
        });
    }
    return issues;
}

function detectFileScopeGlobals(content, filePath) {
    const issues = [];
    const lines = content.split('\n');
    // Skip function bodies — only check file scope lines
    let braceDepth = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Track brace depth to identify file scope
        for (const ch of line) {
            if (ch === '{') braceDepth++;
            else if (ch === '}') braceDepth--;
        }
        if (braceDepth > 0) continue; // Inside a function — skip

        // Match non-static global declarations of single-letter variables
        const m = line.match(/^(?!.*static)\s*(int|float|char|double|uint8_t|uint16_t|uint32_t)\s+(i|j|k|cnt|temp|buf|ret|tmp)\b/);
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
