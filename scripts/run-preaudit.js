const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const includeDirs = [];
const defaultExcludes = ['drivers', 'middlewares', '.git', 'node_modules', 'build', 'debug', 'release', '.vscode'];
const excludeDirs = [...defaultExcludes];

let projectTypeOverride = '';
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--include-dir' && i + 1 < args.length && !args[i + 1].startsWith('--')) includeDirs.push(args[++i]);
    if (args[i] === '--exclude' && i + 1 < args.length && !args[i + 1].startsWith('--')) {
        const val = args[++i];
        if (!excludeDirs.includes(val.toLowerCase())) excludeDirs.push(val.toLowerCase());
    }
    if (args[i] === '--project-type' && i + 1 < args.length && !args[i + 1].startsWith('--')) {
        projectTypeOverride = args[++i].toLowerCase();
    }
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
        execFile(process.execPath, [scriptPath, targetDir], {
            cwd: rootDir, maxBuffer: 10 * 1024 * 1024,
            env: { ...process.env, PREAUDIT_EXCLUDE_DIRS: [...new Set(excludeDirs)].join(',') }
        }, (err, stdout, stderr) => {
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

    // Detect project type (embedded vs app)
    const hasDrivers = fs.existsSync(path.join(rootDir, 'Drivers'));
    const hasPlatformIO = fs.existsSync(path.join(rootDir, 'platformio.ini'));
    const hasFWLIB = fs.existsSync(path.join(rootDir, 'FWLIB')) || fs.existsSync(path.join(rootDir, 'fwlib'));
    const hasCORE = fs.existsSync(path.join(rootDir, 'CORE')) || fs.existsSync(path.join(rootDir, 'core'));
    const hasStdPeriph = hasFWLIB && hasCORE;
    const hasCMSIS = fs.existsSync(path.join(rootDir, 'CORE', 'core_cm4.h')) || fs.existsSync(path.join(rootDir, 'CORE', 'core_cm3.h')) ||
                     fs.existsSync(path.join(rootDir, 'core', 'core_cm4.h')) || fs.existsSync(path.join(rootDir, 'core', 'core_cm3.h'));
    const hasSTM32Conf = fs.existsSync(path.join(rootDir, 'USER', 'main.c')) &&
                         (fs.existsSync(path.join(rootDir, 'USER', 'stm32f4xx_conf.h')) ||
                          fs.existsSync(path.join(rootDir, 'User', 'stm32f4xx_conf.h')));
    const autoEmbedded = hasDrivers || hasPlatformIO || hasStdPeriph || hasCMSIS || hasSTM32Conf;
    const isEmbedded = projectTypeOverride === 'embedded' ? true :
                       projectTypeOverride === 'app' ? false : autoEmbedded;
    const isApp = !isEmbedded;

    // Detect build system
    const hasCMake = fs.existsSync(path.join(rootDir, 'CMakeLists.txt'));
    const hasMakefile = fs.existsSync(path.join(rootDir, 'Makefile')) || fs.existsSync(path.join(rootDir, 'makefile'));
    let buildSystem = 'unknown';
    if (hasCMake) buildSystem = 'CMake';
    else if (hasMakefile) buildSystem = 'Makefile';
    else if (fs.existsSync(rootDir)) {
        const files = fs.readdirSync(rootDir);
        if (files.some(f => /\.uvprojx?$/i.test(f))) buildSystem = 'Keil';
        else if (files.some(f => /\.ewp$/i.test(f))) buildSystem = 'IAR';
    }

    console.error(`[preaudit] Project type: ${isEmbedded ? 'embedded' : 'app'}, build: ${buildSystem}`);
    if (!isEmbedded) console.error(`[preaudit] Skipped: pin_audit, ctrl_chain_check, stack_depth_audit (embedded only)`);
    if (isEmbedded && !hasCMake && !hasMakefile) console.error(`[preaudit] build_audit skipped: no CMake/Makefile found`);

    // Project-specific scripts
    let pinConflicts = [], pinStatus = 'skipped';
    let chainBreaks = [], chainStatus = 'skipped';
    let stackRisks = [], stackStatus = 'skipped';
    let buildOrphans = [], buildStatus = 'skipped';
    let syscallIssues = [], syscallStatus = 'skipped';

    if (isEmbedded) {
        ({ findings: pinConflicts, status: pinStatus } = await runScript('pin_audit.js'));
        ({ findings: chainBreaks, status: chainStatus } = await runScript('ctrl_chain_check.js'));
        ({ findings: stackRisks, status: stackStatus } = await runScript('stack_depth_audit.js'));
    }
    if (isApp) {
        ({ findings: buildOrphans, status: buildStatus } = await runScript('build_audit.js'));
        ({ findings: syscallIssues, status: syscallStatus } = await runScript('syscall_audit.js'));
    }

    // Always run: common scripts
    const { findings: styleIssues, status: styleStatus } = await runScript('style_audit.js');
    const { findings: apiIssues, status: apiStatus } = await runScript('api_style_audit.js');

    const report = {
        meta: {
            tool_version: '1.6.0', scan_time_ms: Date.now() - start,
            project_type: isEmbedded ? 'embedded' : 'app',
            build_system: buildSystem,
            build_info: {
                cmake: hasCMake,
                makefile: hasMakefile,
                detected: buildSystem
            },
            skipped_modules: isEmbedded ? [] : ['pin_audit', 'ctrl_chain_check', 'stack_depth_audit'],
            excluded_dirs: [...new Set(excludeDirs)], target_dir: targetDir,
            modules: {
                pin_audit: { status: pinStatus, findings: pinConflicts.length },
                ctrl_chain: { status: chainStatus, findings: chainBreaks.length },
                stack_depth: { status: stackStatus, findings: stackRisks.length },
                build_audit: { status: buildStatus, findings: buildOrphans.length },
                syscall_audit: { status: syscallStatus, findings: syscallIssues.length },
                style_audit: { status: styleStatus, findings: styleIssues.length },
                api_style_audit: { status: apiStatus, findings: apiIssues.length }
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
