const fs = require('fs');
const logFile = 'C:/Users/Ahmet/caller_id_raw.log';
const targetDigits = '5337';

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    const match = line.match(/HEX: ([0-9A-F]+)/);
    if (match) {
        const hex = match[1];
        let digits = "";
        for (let i = 0; i < hex.length; i += 2) {
            const b = parseInt(hex.substr(i, 2), 16);
            if (b >= 48 && b <= 57) {
                digits += String.fromCharCode(b);
            } else {
                digits += ".";
            }
        }
        if (digits.includes(targetDigits)) {
            console.log(`L${index + 1}: ${line}`);
            console.log(`Digits: ${digits}`);
        }
    }
});
