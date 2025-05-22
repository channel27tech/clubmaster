const fs = require('fs');
const path = require('path');

// Path to the ChessBoardWrapper.tsx file
const filePath = path.join('c:', 'Users', 'abhis', 'OneDrive', 'Desktop', 'latest', 'clubmaster', 'clubmaster-frontend', 'src', 'app', 'components', 'ChessBoardWrapper.tsx');

// Read the file content
let content = fs.readFileSync(filePath, 'utf8');

// Find the positions of the duplicate function declarations
const firstSyncFuncPos = content.indexOf('const synchronizeBoardFromMoveHistory = useCallback((moveHistory: string[])');
const secondSyncFuncPos = content.indexOf('const synchronizeBoardFromMoveHistory = useCallback((moveHistory: string[])', firstSyncFuncPos + 1);

const firstRebuildFuncPos = content.indexOf('const rebuildBoardFromMoveHistory = useCallback((moveHistory: string[])');
const secondRebuildFuncPos = content.indexOf('const rebuildBoardFromMoveHistory = useCallback((moveHistory: string[])', firstRebuildFuncPos + 1);

// If duplicates are found, remove the second instances
if (secondSyncFuncPos > -1 && secondRebuildFuncPos > -1) {
  // Find the end of the second synchronizeBoardFromMoveHistory function
  const secondSyncFuncEndPos = content.indexOf('}, [onSanMoveListChange]);', secondSyncFuncPos) + '}, [onSanMoveListChange]);'.length;
  
  // Find the end of the second rebuildBoardFromMoveHistory function
  const secondRebuildFuncEndPos = content.indexOf('}, [synchronizeBoardFromMoveHistory]);', secondRebuildFuncPos) + '}, [synchronizeBoardFromMoveHistory]);'.length;
  
  // Remove the second instances of both functions
  const contentBeforeSecondSync = content.substring(0, secondSyncFuncPos);
  const contentAfterSecondRebuild = content.substring(secondRebuildFuncEndPos);
  
  // Create a comment to replace the removed functions
  const replacementComment = '  // These functions were previously duplicated and have been removed to fix TypeScript errors\n';
  
  // Create the new content
  const newContent = contentBeforeSecondSync + replacementComment + contentAfterSecondRebuild;
  
  // Write the new content back to the file
  fs.writeFileSync(filePath, newContent, 'utf8');
  
  console.log('Successfully removed duplicate function declarations from ChessBoardWrapper.tsx');
} else {
  console.log('No duplicate function declarations found in ChessBoardWrapper.tsx');
}
