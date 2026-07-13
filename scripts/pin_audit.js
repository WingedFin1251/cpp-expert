// pin_audit.js — GPIO pin conflict matrix scanner
// Extracts all pin configurations and detects duplicate/conflicting assignments.
// Usage: node pin_audit.js [--dir Src]

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release', '.vscode'];

function collectFiles(dirOrDirs, results = []) {
    const dirs = dirOrDirs.split(',').map(d => d.trim()).filter(d => d);
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && !IGNORE_DIRS.includes(e.name)) collectFiles(full, results);
            else if (e.isFile() && /\.(c|cpp|h|hpp)$/i.test(e.name)) results.push(full);
        }
    }
    return results;
}

function extractPort(lines, currentLine) {
    // Walk upward to find the most recent GPIO_Init(GPIOx, ...) call
    for (let j = currentLine; j >= 0; j--) {
        const m = lines[j].match(/GPIO_Init\s*\(\s*(GPIO[A-Z0-9]+)\s*,/);
        if (m) return m[1];
        // Also check HAL_GPIO_Init
        const m2 = lines[j].match(/HAL_GPIO_Init\s*\(\s*(GPIO[A-Z0-9]+)\s*,/);
        if (m2) return m2[1];
    }
    return 'UNKNOWN';
}

function parseGPIOConfig(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Strip comments to avoid false matches in strings/comments
    const noComments = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const lines = noComments.split('\n');
    const results = [];
    let currentPort = 'UNKNOWN';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Track current GPIO_Init port for context
        let portM = line.match(/(?:HAL_)?GPIO_Init\s*\(\s*(GPIO[A-Z0-9]+)\s*,/);
        if (portM) currentPort = portM[1];

        // GPIO_PinAFConfig(GPIOE, GPIO_PinSource9, GPIO_AF_TIM1)
        let m = line.match(/GPIO_PinAFConfig\((\w+),\s*(\w+),\s*(\w+)\)/);
        if (m) {
            const pinNum = m[2].replace('GPIO_PinSource', '');
            results.push({ file: filePath, line: lineNum, pin: `${m[1]}_Pin${pinNum}`, config: m[3] });
        }

        // GPIO_InitStructure.GPIO_Pin = GPIO_Pin_9 | GPIO_Pin_10  — extract EACH pin
        m = line.match(/GPIO_Pin\s*=\s*([^;]+)/);
        if (m) {
            const port = extractPort(lines, i);
            const pinExpr = m[1].trim();
            const pinMatches = pinExpr.match(/GPIO_Pin_(\d+)/g);
            if (pinMatches) {
                pinMatches.forEach(pm => {
                    const pinNum = pm.match(/(\d+)/)[0];
                    results.push({ file: filePath, line: lineNum, pin: `${port}_Pin${pinNum}`, config: 'GPIO_INIT' });
                });
            }
        }
    }
    return results;
}

function main(dir) {
    const files = collectFiles(dir);
    const pinMap = {};
    for (const f of files) {
        const configs = parseGPIOConfig(f);
        for (const c of configs) {
            if (!pinMap[c.pin]) pinMap[c.pin] = [];
            pinMap[c.pin].push(c);
        }
    }

    const conflicts = [];
    for (const [pin, occs] of Object.entries(pinMap)) {
        if (occs.length > 1) {
            const afConfigs = [...new Set(occs.filter(o => o.config !== 'GPIO_INIT').map(o => o.config))];
            if (afConfigs.length > 1) {
                conflicts.push({
                    pin,
                    severity: 'CRITICAL',
                    reason: `Multiple AF configurations: ${afConfigs.join(', ')}`,
                    occurrences: occs.map(o => ({ file: o.file, line: o.line, config: o.config }))
                });
            } else {
                conflicts.push({
                    pin,
                    severity: 'MEDIUM',
                    reason: 'Initialized multiple times',
                    occurrences: occs.map(o => ({ file: o.file, line: o.line, config: o.config }))
                });
            }
        }
    }
    return conflicts;
}

const targetDir = process.argv[2] || '.';
console.error(`[pin_audit] Scanning ${targetDir}...`);
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
