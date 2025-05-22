const fs = require('fs');
const path = require('path');

const packageLockPath = path.join(__dirname, 'clubmaster-frontend', 'package-lock.json');

// Read the file
let content = fs.readFileSync(packageLockPath, 'utf8');

// Replace merge conflict markers
content = content.replace(/<<<<<<< HEAD\n=======\n/g, '');
content = content.replace(/>>>>>>> main/g, '');

// Write the fixed content back
fs.writeFileSync(packageLockPath, content, 'utf8');

console.log('Fixed package-lock.json!'); 