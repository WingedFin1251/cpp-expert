// pin_audit.js — GPIO pin conflict matrix scanner
// Extracts all pin configurations and detects duplicate/conflicting assignments.
// Usage: node pin_audit.js [--dir Src] [--exclude Drivers]

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release', '.vscode'];

function collectFiles(dir, results = []) {
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory() && !IGNORE_DIRS.includes(e.name)) collectFiles(full, results);
        else if (e.isFile() && /\.(c|cpp|h|hpp)$/i.test(e.name)) results.push(full);
    }
    return results;
}

function parseGPIOConfig(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const results = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // GPIO_PinAFConfig(GPIOE, GPIO_PinSource9, GPIO_AF_TIM1)
        let m = line.match(/GPIO_PinAFConfig\((\w+),\s*(\w+),\s*(\w+)\)/);
        if (m) results.push({ file: filePath, line: lineNum, pin: m[1] + '_' + m[2].replace('GPIO_PinSource', ''), config: m[3] });

        // GPIO_InitStructure.GPIO_Pin = GPIO_Pin_9 | GPIO_Pin_10
        m = line.match(/GPIO_Pin\s*=\s*([^;]+)/);
        if (m) {
            const pinExpr = m[1].trim();
            // Extract port from GPIOx (e.g. GPIOE)
            let portMatch = content.slice(0, content.indexOf(line)).match(/(GPIO[A-Z]+)\s*(?:GPIO_Init|InitStructure)/g);
            const port = portMatch ? portMatch[portMatch.length-1].replace('GPIO_Init', '').trim() : 'UNKNOWN';
            results.push({ file: filePath, line: lineNum, pin: port + '_' + pinExpr, config: 'GPIO_INIT' });
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
            // Check if they have different AF configs
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

// CLI
const targetDir = process.argv[2] || '.';
console.error(`[pin_audit] Scanning ${targetDir}...`);
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
