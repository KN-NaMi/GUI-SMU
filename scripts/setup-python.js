const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const PYTHON_VERSION = '3.11.8';
const PYTHON_URLS = {
    win32: `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`,
    darwin: `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-macos11.pkg`
};

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function setupPython() {
    const platform = os.platform();
    const pythonDir = path.join(__dirname, '..', 'python');
    const downloadPath = path.join(pythonDir, platform === 'win32' ? 'python.zip' : 'python.pkg');

    // Create python directory if it doesn't exist
    if (!fs.existsSync(pythonDir)) {
        fs.mkdirSync(pythonDir, { recursive: true });
    }

    console.log('Downloading Python...');
    await downloadFile(PYTHON_URLS[platform], downloadPath);

    console.log('Setting up Python...');
    if (platform === 'win32') {
        // Windows setup
        execSync(`powershell Expand-Archive -Path "${downloadPath}" -DestinationPath "${pythonDir}" -Force`);
    } else if (platform === 'darwin') {
        // macOS setup
        // Extract Python from pkg
        execSync(`pkgutil --expand "${downloadPath}" "${pythonDir}/temp"`);
        // Move Python to the correct location
        execSync(`mv "${pythonDir}/temp/Payload/Python.framework" "${pythonDir}/"`);
        // Clean up
        execSync(`rm -rf "${pythonDir}/temp"`);
    }

    // Clean up
    fs.unlinkSync(downloadPath);

    console.log('Python setup completed');
}

setupPython().catch(console.error); 