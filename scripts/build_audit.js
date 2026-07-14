const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const SRC_PATTERNS = ['.cpp', '.c', '.cc', '.cxx'];

function collectFiles(dirOrDirs) {
    const results = [];
    const dirs = dirOrDirs.split(',').map(d => d.trim()).filter(d => d);
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.name === '.git' || e.name === 'node_modules' || e.name === 'build' || e.name === 'Debug' || e.name === 'Release') continue;
            if (e.isDirectory()) results.push(...collectFiles(full));
            else if (SRC_PATTERNS.some(p => e.name.endsWith(p))) results.push(full);
        }
    }
    return results;
}

function findCMakeFiles(dirOrDirs) {
    const results = [];
    const dirs = dirOrDirs.split(',').map(d => d.trim()).filter(d => d);
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.name === '.git' || e.name === 'node_modules' || e.name === 'build') continue;
            if (e.isDirectory()) results.push(...findCMakeFiles(full));
            else if (e.name === 'CMakeLists.txt') results.push(full);
        }
    }
    return results;
}

function collectVariables(cmakeContent) {
    const vars = {};
    const re = /set\s*\(\s*(\w+)\s+([^)]+)\)/gi;
    let m;
    while ((m = re.exec(cmakeContent)) !== null) {
        vars[m[1]] = m[2].trim();
    }
    return vars;
}

function expandVariables(expr, varMap) {
    return expr.replace(/\${([^}]+)}/g, (_, name) => varMap[name] || '');
}

function addDirSources(dir, cmakeDir, sources) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isFile() && SRC_PATTERNS.some(p => e.name.endsWith(p))) {
            sources.add(path.resolve(cmakeDir, full));
        }
    }
}

function extractSources(cmakeContent, cmakeDir) {
    const sources = new Set();
    const varMap = collectVariables(cmakeContent);
    const cleaned = cmakeContent.replace(/#.*$/gm, '');

    // aux_source_directory(dir VAR) — all sources in dir are compiled
    let m;
    const auxRe = /aux_source_directory\s*\(\s*([^)]+)\)/g;
    while ((m = auxRe.exec(cleaned)) !== null) {
        const args = m[1].split(/\s+/).filter(Boolean);
        if (args.length >= 1) {
            const expandedDir = expandVariables(args[0], varMap);
            if (expandedDir) addDirSources(path.resolve(cmakeDir, expandedDir), cmakeDir, sources);
        }
    }

    const patterns = [
        /(?:add_library|add_executable)\s*\(\s*([^)]+)\)/g,
        /target_sources\s*\(\s*\w+\s+(?:PRIVATE|PUBLIC|INTERFACE)?\s+([^)]+)\)/g,
    ];

    for (const re1 of patterns) {
        while ((m = re1.exec(cleaned)) !== null) {
            if (m[1].trim() === 'INTERFACE') continue;
            m[1].split(/\s+/).forEach(f => {
                const trimmed = f.trim();
                if (!trimmed || trimmed === 'INTERFACE') return;
                const expanded = expandVariables(trimmed, varMap);
                expanded.split(/\s+/).forEach(exp => {
                    const t = exp.trim();
                    if (t && SRC_PATTERNS.some(p => t.endsWith(p))) {
                        sources.add(path.resolve(cmakeDir, t));
                    }
                });
            });
        }
    }

    return sources;
}

function main(dir) {
    const cmakeFiles = findCMakeFiles(dir);
    const compiledSources = new Set();
    for (const cm of cmakeFiles) {
        const content = fs.readFileSync(cm, 'utf-8');
        const s = extractSources(content, path.dirname(cm));
        s.forEach(f => compiledSources.add(f));
    }
    const allSources = new Set(collectFiles(dir).map(f => path.resolve(f)));
    const orphans = [];
    for (const f of allSources) {
        if (!compiledSources.has(f)) {
            orphans.push({
                id: 'B30', pattern: 'orphan_source', severity: 'HIGH',
                file: path.relative(ROOT_DIR, f).replace(/\\/g, '/'), line: 1,
                detail: 'Source exists but not in CMakeLists.txt — possible dead code'
            });
        }
    }
    return orphans;
}

const targetDir = process.argv[2] || '.';
console.error(`[build_audit] Scanning ${targetDir}...`);
const result = main(targetDir);
console.log(JSON.stringify(result, null, 2));
console.error(`[build_audit] ${result.length} orphans found`);
