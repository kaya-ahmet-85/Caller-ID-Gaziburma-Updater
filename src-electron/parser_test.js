const fs = require('fs');

// Log çıktısını bir dosyaya yapıştırıp buraya okutabilirsiniz. 
// Ben şu an terminalden gördüğüm örnek bir paketi test ediyorum.
const sampleHex = "6B 85 FC E0 1B A5 EC 90 0B 95 FC 90 1B A5 8C 90 6B 95 FC 80 1B 95 FC 80 1B A5 DC 80 1B A5 FC E0 0B 95 FC 90 1B 95 FC 90 1B A5 EC 80 1B 85 8C B0 0B 95 FC 90 6B A5 EC 90 0B A5 FC E0 0B A7 DE 80";

function analyze(hex) {
    const bytes = hex.split(' ').map(h => parseInt(h, 16));
    let ascii = "";
    bytes.forEach(b => {
        if (b >= 32 && b <= 126) ascii += String.fromCharCode(b);
        else ascii += ".";
    });
    console.log("HEX:", hex);
    console.log("ASCII:", ascii);
}

// Analiz sonucu cihazın saf ASCII numara yollamadığı kesinleşirse, 
// GCallerID1C.dll dosyasını ffi-napi ile yükleyeceğiz.
analyze(sampleHex);
