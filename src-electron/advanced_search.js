const fs = require('fs');
const logFile = 'C:/Users/Ahmet/caller_id_raw.log';
const targetNum = '5336347495';

function search() {
    if (!fs.existsSync(logFile)) return console.error("Log yok");
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
        const match = line.match(/HEX: ([0-9A-F ]+)/);
        if (!match) return;
        const hex = match[1].replace(/ /g, '');
        
        // 1. Düz ASCII (0-9)
        let ascii = "";
        for (let i = 0; i < hex.length; i += 2) {
            const b = parseInt(hex.substr(i, 2), 16);
            if (b >= 48 && b <= 57) ascii += String.fromCharCode(b);
            else ascii += ".";
        }
        if (ascii.includes(targetNum)) console.log(`LINE ${idx+1} [ASCII MATCH]: ${line}\n   -> ${ascii}`);

        // 2. BCD (4 bit nibbles)
        let bcd = "";
        for (let i = 0; i < hex.length; i++) {
            const n = parseInt(hex[i], 16);
            if (n <= 9) bcd += n;
            else bcd += ".";
        }
        if (bcd.includes(targetNum)) console.log(`LINE ${idx+1} [BCD MATCH]: ${line}\n   -> ${bcd}`);

        // 3. Kaydırılmış Bitler / Farklı formatlar için ham içerik kontrolü
        if (hex.includes(targetNum)) console.log(`LINE ${idx+1} [RAW HEX MATCH]: ${line}`);
    });
}

search();
