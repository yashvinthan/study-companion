/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function isInsideGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    return true;
  } catch (e) {
    // We intentionally ignore the error here since it just means we're not in a Git repo
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const status_code = e.status;
    return false;
  }
}

try {
  const status = execSync('git status --porcelain').toString();
  const lines = status.split('\n').filter(Boolean);
  
  const filesToAdd = [];
  const filesToSkip = [];
  
  for (const line of lines) {
    // format: XY path or XY "path"
    const filePath = line.substring(3).replace(/^"|"$/g, '').trim();
    const status_code = line.substring(0, 2);
    
    // Ignore patterns
    if (
      filePath.includes('.env') || 
      filePath.includes('tsc-errors') || 
      filePath.includes('docker_logs.txt') || 
      filePath === 'docker' || 
      filePath.startsWith('docker/') ||
      filePath.endsWith('.log')
    ) {
      filesToSkip.push(filePath);
      continue;
    }
    
    filesToAdd.push(filePath);
  }
  
  if (filesToAdd.length > 0) {
    console.log('Staging files:', filesToAdd);
    const args = filesToAdd.map(f => `"${f}"`).join(' ');
    execSync(`git add ${args}`);
    console.log('Successfully staged safe files.');
  } else {
    console.log('No files to stage.');
  }
  
  if (filesToSkip.length > 0) {
    console.log('Skipped files:', filesToSkip);
  }
} catch (error) {
  console.error('Git clean add failed:', error.message);
  process.exit(1);
}
