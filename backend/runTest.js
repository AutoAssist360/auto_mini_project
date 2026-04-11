const { execSync } = require('child_process');
try {
    console.log('Running testLedger...');
    let output = execSync('npx tsx testLedger.js', { encoding: 'utf-8' });
    console.log(output);
} catch (e) {
    console.log("=== ERROR STDERR ===");
    console.log(e.stderr);
    console.log("=== ERROR STDOUT ===");
    console.log(e.stdout);
}
