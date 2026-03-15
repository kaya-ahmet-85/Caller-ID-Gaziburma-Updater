const fs = require('fs');
const logFile = 'C:/Users/Ahmet/caller_id_raw.log';

function analyzeOutliers() {
    if (!fs.existsSync(logFile)) {
        console.error("Log file not found!");
        return;
    }

    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    const counts = {};
    const examples = {};

    console.log(`Total lines: ${lines.length}`);

    lines.forEach(line => {
        const match = line.match(/HEX: ([0-9A-F]+)/);
        if (match) {
            const hex = match[1];
            counts[hex] = (counts[hex] || 0) + 1;
            examples[hex] = line;
        }
    });

    const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1]);

    console.log("\n--- Top 20 RAREST Packets (Potential Events) ---");
    sorted.slice(0, 20).forEach(([hex, count]) => {
        console.log(`Count: ${count} | ${examples[hex]}`);
    });

    console.log("\n--- Top 5 MOST COMMON Packets (Likely Idle) ---");
    sorted.slice(-5).forEach(([hex, count]) => {
        console.log(`Count: ${count} | ${examples[hex].substring(0, 100)}...`);
    });
}

analyzeOutliers();
