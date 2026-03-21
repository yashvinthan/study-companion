const cp = require('child_process');

try {
  const status = cp.execSync('git status --porcelain').toString();
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
    cp.execSync(`git add ${args}`);
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
