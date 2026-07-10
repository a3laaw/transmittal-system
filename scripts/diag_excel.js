// Diagnostic script — simulate what the API does and print all paths
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = '/home/z/my-project';

function findExcelScript() {
  const candidates = [
    path.join(PROJECT_ROOT, 'scripts', 'gen_excel_template.py'),
    path.join(process.cwd(), 'scripts', 'gen_excel_template.py'),
    path.join(process.cwd(), '..', '..', 'scripts', 'gen_excel_template.py'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function findExcelTemplate() {
  const candidates = [
    path.join(PROJECT_ROOT, 'public', 'templates', 'TRANSIMITALS_template.xlsx'),
    path.join(process.cwd(), 'public', 'templates', 'TRANSIMITALS_template.xlsx'),
    path.join(process.cwd(), '..', '..', 'public', 'templates', 'TRANSIMITALS_template.xlsx'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function findPython() {
  const candidates = [
    '/home/z/.venv/bin/python3',
    '/home/z/.venv/bin/python',
    '/usr/bin/python3',
    '/usr/local/bin/python3',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'python3';
}

const scriptPath = findExcelScript();
const templatePath = findExcelTemplate();
const pythonBin = findPython();
const outPath = '/tmp/diag-test.xlsx';
const reference = 'CIV-172';
const date = '2026-07-10';
const description = 'Hello World';

console.log('=== Diagnostic ===');
console.log('cwd:', process.cwd());
console.log('pythonBin:', pythonBin, '→ exists:', fs.existsSync(pythonBin));
console.log('scriptPath:', scriptPath, '→ exists:', fs.existsSync(scriptPath));
console.log('templatePath:', templatePath, '→ exists:', fs.existsSync(templatePath));
console.log('args:', JSON.stringify([scriptPath, templatePath, outPath, reference, date, description]));

const py = spawn(pythonBin, [
  scriptPath,
  templatePath,
  outPath,
  reference,
  date,
  description,
], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PYTHONUNBUFFERED: '1' },
});

let stdout = '';
let stderr = '';
py.stdout.on('data', d => { stdout += d.toString(); });
py.stderr.on('data', d => { stderr += d.toString(); });
py.on('close', code => {
  console.log('\n=== Result ===');
  console.log('exit code:', code);
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);
  console.log('output exists:', fs.existsSync(outPath));
  if (fs.existsSync(outPath)) {
    console.log('output size:', fs.statSync(outPath).size);
  }
});
