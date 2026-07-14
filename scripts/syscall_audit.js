const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release'];

function collectFiles(dirOrDirs) {
    const results = [];
    const dirs = dirOrDirs.split(',').map(d => d.trim()).filter(d => d);
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && !IGNORE_DIRS.includes(e.name.toLowerCase())) results.push(...collectFiles(full));
            else if (e.isFile() && /\.(c|cpp)$/i.test(e.name)) results.push(full);
        }
    }
    return results;
}

function stripContent(content) {
    return content
        .replace(/"(?:\\.|[^"\\])*"/g, '""')
        .replace(/'(?:\\.|[^'\\])*'/g, "''")
        .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ''))
        .replace(/\/\/.*/g, '');
}

function main(dir) {
    const files = collectFiles(dir);
    const issues = [];
    let forkCount = 0, waitpidCount = 0;
    const forkFiles = new Set(), waitpidFiles = new Set();

    for (const f of files) {
        const raw = fs.readFileSync(f, 'utf-8');
        const stripped = stripContent(raw);
        const strippedLines = stripped.split('\n');

        for (let i = 0; i < strippedLines.length; i++) {
            const line = strippedLines[i];

            // B31: Unchecked I/O — check surrounding context for if()
            if (/\b(fwrite|fread|chmod)\s*\(/.test(line)) {
                const context = strippedLines.slice(Math.max(0, i - 3), i + 1).join('\n');
                if (!/if\s*\(/.test(context) && !line.trim().startsWith('if')) {
                    issues.push({
                        id: 'B31', severity: 'HIGH', pattern: 'unchecked_io',
                        file: f, line: i + 1,
                        detail: line.match(/\b(fwrite|fread|chmod)\b/)[1] + ' return unchecked'
                    });
                }
            }
            // B32: Non-blocking waitpid without retry loop
            if (/waitpid\s*\([^)]*WNOHANG/.test(line)) {
                const ctx = strippedLines.slice(Math.max(0, i - 10), i).join(' ');
                if (!/\b(for|while)\b/.test(ctx)) {
                    issues.push({
                        id: 'B32', severity: 'HIGH', pattern: 'zombie_risk',
                        file: f, line: i + 1,
                        detail: 'Non-blocking waitpid without retry loop — zombie risk'
                    });
                }
            }
            // B33: const_cast + direct string literal
            if (/putenv\s*\(\s*const_cast/.test(line) || /const_cast\s*<char[^>]*>\s*\(\s*"/.test(line)) {
                issues.push({
                    id: 'B33', severity: 'CRITICAL', pattern: 'const_cast_ub',
                    file: f, line: i + 1,
                    detail: 'putenv with const_cast string literal — UB'
                });
            }
            // B33b: direct string literal to putenv
            if (/putenv\s*\(\s*"[^"]*"\s*\)/.test(line)) {
                issues.push({
                    id: 'B33', severity: 'CRITICAL', pattern: 'putenv_literal',
                    file: f, line: i + 1,
                    detail: 'putenv with string literal — POSIX may modify the string'
                });
            }
            // B36: dlopen
            if (/\bdlopen\s*\(/.test(line)) issues.push({
                id: 'B36', severity: 'MEDIUM', pattern: 'dlopen_leak',
                file: f, line: i + 1,
                detail: 'dlopen() without matching dlclose()'
            });
            // Note: deprecated C API detection (sprintf/strcpy/gets) is handled by api_style_audit.js → B35
        }

        const fk = (stripped.match(/\bfork\s*\(/g) || []).length;
        const wp = (stripped.match(/\bwaitpid\s*\(/g) || []).length;
        forkCount += fk;
        waitpidCount += wp;
        if (fk > 0) forkFiles.add(f);
        if (wp > 0) waitpidFiles.add(f);
    }

    if (forkCount > waitpidCount) {
        issues.push({
            id: 'B37', severity: 'CRITICAL', pattern: 'fork_wait_mismatch',
            file: [...forkFiles][0] || '.', line: 1,
            detail: 'fork() called ' + forkCount + ' times but waitpid() only ' + waitpidCount + ' times — zombie risk'
        });
    }
    return issues;
}

const targetDir = process.argv[2] || '.';
console.error('[syscall_audit] Scanning ' + targetDir + '...');
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
