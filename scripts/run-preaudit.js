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

// Support multiple --include-dir args; pass all as space-separated to sub-scripts
const targetDir = includeDirs.length > 0 ? includeDirs.join(',') : '.';
const rootDir = process.cwd();
const scriptsDir = __dirname;

function runScript(name) {
    return new Promise((resolve) => {
        const scriptPath = path.join(scriptsDir, name);
        if (!fs.existsSync(scriptPath)) {
            console.error(`[preaudit] WARNING: ${name} not found, skipping`);
            return resolve({ findings: [], status: 'skipped' });
        }
        execFile(process.execPath, [scriptPath, targetDir], { cwd: rootDir, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
                console.error(`[preaudit] ERROR running ${name}: ${err.message}`);
                return resolve({ findings: [], status: 'error' });
            }
            if (stderr) console.error(stderr);
            try { resolve({ findings: JSON.parse(stdout), status: 'ok' }); }
            catch { console.error(`[preaudit] ${name} returned invalid JSON`); resolve({ findings: [], status: 'parse_error' }); }
        });
    });
}

async function main() {
    const start = Date.now();
    const relDir = targetDir;

    // Detect project type
    const hasDrivers = fs.existsSync(path.join(rootDir, 'Drivers'));
    const hasPlatformIO = fs.existsSync(path.join(rootDir, 'platformio.ini'));
    const hasCMake = fs.existsSync(path.join(rootDir, 'CMakeLists.txt'));
    const hasMakefile = fs.existsSync(path.join(rootDir, 'Makefile'));
    const isEmbedded = hasDrivers || hasPlatformIO;
    const isApp = hasCMake || hasMakefile || (!isEmbedded && !hasPlatformIO);

    console.error(`[preaudit] Project type: ${isEmbedded ? 'embedded' : 'app'}`);

    // Project-specific scripts
    let pinConflicts = [], chainBreaks = [], stackRisks = [];
    let buildOrphans = [], syscallIssues = [];

    if (isEmbedded) {
        ({ findings: pinConflicts } = await runScript('pin_audit.js'));
        ({ findings: chainBreaks } = await runScript('ctrl_chain_check.js'));
        ({ findings: stackRisks } = await runScript('stack_depth_audit.js'));
    }
    if (isApp || (!isEmbedded && !hasPlatformIO)) {
        ({ findings: buildOrphans } = await runScript('build_audit.js'));
        ({ findings: syscallIssues } = await runScript('syscall_audit.js'));
    }

    // Always run: common scripts
    const { findings: styleIssues } = await runScript('style_audit.js');
    const { findings: apiIssues } = await runScript('api_style_audit.js');

    const report = {
        meta: {
            tool_version: '1.6.0', scan_time_ms: Date.now() - start,
            project_type: isEmbedded ? 'embedded' : 'app',
            excluded_dirs: excludeDirs, target_dir: targetDir,
            modules: {
                pin_audit: { status: isEmbedded ? 'ok' : 'skipped', findings: pinConflicts.length },
                ctrl_chain: { status: isEmbedded ? 'ok' : 'skipped', findings: chainBreaks.length },
                stack_depth: { status: isEmbedded ? 'ok' : 'skipped', findings: stackRisks.length },
                build_audit: { status: isApp ? 'ok' : 'skipped', findings: buildOrphans.length },
                syscall_audit: { status: isApp ? 'ok' : 'skipped', findings: syscallIssues.length },
                style_audit: { status: 'ok', findings: styleIssues.length },
                api_style_audit: { status: 'ok', findings: apiIssues.length }
            }
        },
        pin_conflicts: pinConflicts, control_chain_breaks: chainBreaks,
        stack_overflow_risks: stackRisks, style_issues: styleIssues,
        build_orphans: buildOrphans, syscall_issues: syscallIssues,
        api_mismatches: apiIssues
    };
    const outputPath = path.join(rootDir, 'unified-audit-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`[PREAUDIT] ${pinConflicts.length} conf, ${chainBreaks.length} chain, ${stackRisks.length} stack, ${styleIssues.length} style, ${buildOrphans.length} orphan, ${syscallIssues.length} sys, ${apiIssues.length} api — ${report.meta.scan_time_ms}ms`);
    console.log(`[PREAUDIT] Report written to ${outputPath}`);
}
main().catch(err => { console.error('[preaudit] Fatal:', err); process.exit(1); });
