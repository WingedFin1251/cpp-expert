// stack_depth_audit.js — ISR stack depth estimator
// For each *_IRQHandler, estimate stack usage from local variables
// and called functions. Flags when depth exceeds thresholds.
// Includes nesting risk multiplier for nested interrupt patterns.

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release', '.vscode'];
const STACK_THRESHOLD_HIGH = 512;
const STACK_THRESHOLD_MED = 256;
const NESTING_PATTERNS = [/NVIC_SetPendingIRQ/, /__enable_irq\(\)/, /HAL_NVIC_SetPendingIRQ/];

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

function extractFunctionBodies(content) {
    const funcs = [];
    const re = /(\w+)\s+(\w+)\s*\([^)]*\)\s*\{/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        const name = m[2];
        if (!name.endsWith('_IRQHandler')) continue;
        const start = m.index;
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

function estimateStack(body) {
    let total = 0;
    // float/double variables: float x[N] → N*4
    const floatRe = /(float|double|int32_t|uint32_t)\s+\w+(?:\[\s*(\d+)\s*\])?/g;
    let m;
    while ((m = floatRe.exec(body)) !== null) {
        const type = m[1];
        const arraySize = m[2] ? parseInt(m[2]) : 1;
        const size = (type === 'double') ? 8 : 4;
        total += size * arraySize;
    }
    // Large local arrays: u8 buf[1024]
    const bufRe = /(u?int(?:8|16|32)_t|char|u8|u16)\s+\w+\[\s*(\d+)\s*\]/g;
    while ((m = bufRe.exec(body)) !== null) {
        const elemSize = m[1].includes('16') ? 2 : m[1].includes('32') ? 4 : 1;
        total += elemSize * parseInt(m[2]);
    }
    // Function calls: each call ~8 bytes for return address + frame
    const callCount = (body.match(/\b\w+\(/g) || []).length;
    total += callCount * 8;
    return total;
}

function main(dir) {
    const files = collectFiles(dir);
    const risks = [];
    for (const f of files) {
        const content = fs.readFileSync(f, 'utf-8');
        const isrs = extractFunctionBodies(content);
        for (const isr of isrs) {
            const depth = estimateStack(isr.body);
            const hasNesting = NESTING_PATTERNS.some(p => p.test(isr.body));
            const adjustedDepth = hasNesting ? Math.round(depth * 1.5) : depth;

            if (adjustedDepth > STACK_THRESHOLD_MED) {
                risks.push({
                    context: `${isr.name} (${path.basename(f)})`,
                    severity: adjustedDepth > STACK_THRESHOLD_HIGH ? 'HIGH' : 'MEDIUM',
                    estimated_depth_bytes: adjustedDepth,
                    reason: hasNesting
                        ? `Est. ${depth} bytes ×1.5 nesting factor = ${adjustedDepth} bytes [NESTING_RISK]`
                        : `Est. ${adjustedDepth} bytes from locals + calls`,
                    file: f,
                    line: isr.startLine
                });
            }
        }
    }
    return risks;
}

const targetDir = process.argv[2] || '.';
console.error(`[stack_depth] Scanning ${targetDir}...`);
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
