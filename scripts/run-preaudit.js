const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const includeDirs = [];
const excludeDirs = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release', '.vscode'];

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--include-dir' && i + 1 < args.length) includeDirs.push(args[++i]);
    if (args[i] === '--exclude' && i + 1 < args.length) excludeDirs.push(args[++i]);
}

const targetDir = includeDirs.length > 0 ? includeDirs[0] : '.';
const rootDir = process.cwd();
const scriptsDir = __dirname;

function runScript(name) {
    return new Promise((resolve) => {
        const scriptPath = path.join(scriptsDir, name);
        if (!fs.existsSync(scriptPath)) {
            console.error(`[preaudit] WARNING: ${name} not found, skipping`);
            return resolve([]);
        }
        execFile(process.execPath, [scriptPath, targetDir], { cwd: rootDir, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
                console.error(`[preaudit] ERROR running ${name}: ${err.message}`);
                return resolve([]);
            }
            if (stderr) console.error(stderr);
            try { resolve(JSON.parse(stdout)); }
            catch { console.error(`[preaudit] ${name} returned invalid JSON`); resolve([]); }
        });
    });
}

async function main() {
    const start = Date.now();
    const [pinConflicts, chainBreaks, stackRisks] = await Promise.all([
        runScript('pin_audit.js'), runScript('ctrl_chain_check.js'), runScript('stack_depth_audit.js')
    ]);
    const report = {
        meta: { tool_version: '1.4.0', scan_time_ms: Date.now() - start, excluded_dirs: excludeDirs, target_dir: targetDir },
        pin_conflicts: pinConflicts, control_chain_breaks: chainBreaks, stack_overflow_risks: stackRisks
    };
    const outputPath = path.join(rootDir, 'unified-audit-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`[PREAUDIT] ${pinConflicts.length} conflicts, ${chainBreaks.length} chain breaks, ${stackRisks.length} stack risks — ${report.meta.scan_time_ms}ms`);
    console.log(`[PREAUDIT] Report written to ${outputPath}`);
}
main().catch(err => { console.error('[preaudit] Fatal:', err); process.exit(1); });
