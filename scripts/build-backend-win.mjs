/**
 * Builds backend/python-win/main.exe via PyInstaller (Windows).
 * Prefers backend/.venv\Scripts\pyinstaller.exe when present.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(__dirname, '..', 'backend');
const venvPyinstaller = path.join(backendDir, '.venv', 'Scripts', 'pyinstaller.exe');

const pyinstallerCmd = fs.existsSync(venvPyinstaller) ? venvPyinstaller : 'pyinstaller';
const useShell = !fs.existsSync(venvPyinstaller);

const result = spawnSync(
  pyinstallerCmd,
  ['--noconfirm', '--clean', '--distpath', 'python-win', '--workpath', 'pybuild-win', 'pyinstaller.spec'],
  {
    cwd: backendDir,
    stdio: 'inherit',
    shell: useShell,
  }
);

if (result.status !== 0) {
  console.error(
    '\nPyInstaller failed. Create backend\\.venv, run pip install -r requirements.txt, then retry.\n' +
      'If you use a global Python, ensure `pyinstaller` is on PATH.\n'
  );
  process.exit(result.status ?? 1);
}

const outExe = path.join(backendDir, 'python-win', 'main.exe');
if (!fs.existsSync(outExe)) {
  console.error('Expected output missing:', outExe);
  process.exit(1);
}

console.log('Backend exe:', outExe);
