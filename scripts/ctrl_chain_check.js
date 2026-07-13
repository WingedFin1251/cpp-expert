// ctrl_chain_check.js — Control chain call graph analyzer
// Finds control algorithms (PLL/PID/FOC/Observer) that are defined but
// never called from any ISR or RTOS task entry point.
// Handles function pointer escape detection (downgrades to WARNING).

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release', '.vscode'];
const ROOT_PATTERNS = [/_IRQHandler\b/, /xTaskCreate\s*\(/];
const CONSUMER_PATTERNS = /(PLL|PID|Observer|FOC|Calc|Control|Update)/;

function collectFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory() && !IGNORE_DIRS.includes(e.name)) collectFiles(full, results);
        else if (e.isFile() && /\.(c|cpp)$/i.test(e.name)) results.push(full);
    }
    return results;
}

function extractFunctions(content) {
    const funcs = [];
    // Match function definitions: return_type name(params) {
    const re = /(\w+)\s+(\w+)\s*\([^)]*\)\s*\{/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        const name = m[2];
        const start = m.index;
        // Find matching closing brace (simple brace counter)
        let depth = 1, pos = re.lastIndex;
        while (depth > 0 && pos < content.length) {
            if (content[pos] === '{') depth++;
            else if (content[pos] === '}') depth--;
            pos++;
        }
        funcs.push({ name, body: content.slice(start, pos), startLine: content.slice(0, start).split('\n').length });
    }
    return funcs;
}

function main(dir) {
    const files = collectFiles(dir);
    const allFuncs = [];
    const rootFuncs = [];

    for (const f of files) {
        const content = fs.readFileSync(f, 'utf-8');
        const funcs = extractFunctions(content);
        for (const fn of funcs) {
            fn.file = f;
            const isRoot = ROOT_PATTERNS.some(p => p.test(fn.name));
            if (isRoot) rootFuncs.push(fn);
            allFuncs.push(fn);
        }
    }

    // Build set of all function names called from root functions
    const calledFromRoot = new Set();
    for (const root of rootFuncs) {
        for (const fn of allFuncs) {
            if (fn.name !== root.name && root.body.includes(fn.name)) {
                calledFromRoot.add(fn.name);
            }
        }
    }

    // Find consumers that match control algorithm patterns
    const breaks = [];
    for (const fn of allFuncs) {
        if (CONSUMER_PATTERNS.test(fn.name)) {
            const isRoot = rootFuncs.some(r => r.name === fn.name);
            if (isRoot) continue; // ISR handlers themselves are not "broken"
            if (calledFromRoot.has(fn.name)) continue;

            // Function pointer escape detection: check if address-of or cast-assigned
            const isFuncPtr = allFuncs.some(other =>
                other.body.includes('= ' + fn.name) ||
                other.body.includes('= &' + fn.name) ||
                other.body.includes('=&' + fn.name) ||
                other.body.includes(fn.name + ';') // ptr declaration: type (*ptr)() = func;
            );

            breaks.push({
                function: fn.name,
                severity: isFuncPtr ? 'WARNING' : 'HIGH',
                reason: isFuncPtr
                    ? `Never called directly, but assigned as function pointer — verify runtime reachability`
                    : `Defined but never called from any ISR or RTOS task`,
                definition: { file: fn.file, line: fn.startLine }
            });
        }
    }
    return breaks;
}

const targetDir = process.argv[2] || '.';
console.error(`[ctrl_chain] Scanning ${targetDir}...`);
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
