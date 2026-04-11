const { execSync } = require('child_process');
try {
    let output = execSync('npx tsx testLedger.js', { encoding: 'utf-8' });
    console.log("=== SUCCESS ===");
    console.log(output);
} catch (e) {
    require('fs').writeFileSync('err.log', e.stderr || e.message);
    console.log("Error written to err.log");
}
