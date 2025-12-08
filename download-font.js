const fs = require('fs');
const https = require('https');
const path = require('path');

const dir = path.join(process.cwd(), 'public', 'fonts');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const file = fs.createWriteStream(path.join(dir, 'Inter-Bold.ttf'));
const request = https.get("https://github.com/google/fonts/raw/main/ofl/inter/Inter-Bold.ttf", function (response) {
    response.pipe(file);
    file.on('finish', function () {
        file.close();
        console.log("Download completed");
    });
});
