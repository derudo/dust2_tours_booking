/**
 * Git Synchronization Automation Script for Dust2 Tours Booking Tool
 * 
 * This script automates git tracking, staging, committing, and pushing to:
 * https://github.com/derudo/dust2_tours_booking.git
 * 
 * Usage:
 *   node git-push.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_URL = 'https://github.com/derudo/dust2_tours_booking.git';

console.log('==================================================');
console.log('   DUST2 TOURS AGENCY - GIT SYNC AUTOMATION       ');
console.log('==================================================\n');

function runCommand(command, desc) {
  console.log(`[Executing] ${desc || command}...`);
  try {
    const stdout = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    if (stdout.trim()) {
      console.log(stdout.trim());
    }
    console.log(`[Success] ${desc || 'Action'} completed successfully.\n`);
    return true;
  } catch (error) {
    console.error(`[Error] ${desc || 'Action'} failed:`);
    console.error(error.stderr || error.message);
    console.log('');
    return false;
  }
}

// 1. Check if git is installed
try {
  execSync('git --version', { stdio: 'ignore' });
} catch (e) {
  console.error('CRITICAL ERROR: Git command-line tool is not installed or not in your system PATH.');
  process.exit(1);
}

// 2. Check if .git exists, if not initialize it
const hasGit = fs.existsSync(path.join(__dirname, '.git'));
if (!hasGit) {
  console.log('.git folder not found. Initializing new git repository...');
  if (!runCommand('git init', 'Initializing Git repository')) {
    process.exit(1);
  }
} else {
  console.log('.git directory detected. Continuing with existing repository.');
}

// 3. Stage all files
runCommand('git add .', 'Staging all workspace files');

// 4. Check if there are any changes to commit
try {
  const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  if (!status) {
    console.log('No changes detected in the workspace. Repository is up-to-date.');
  } else {
    // 5. Commit changes
    const commitMsg = 'Initial Build: Vintage travel agency style Dust2 booking tool with email confirmations and visual admin panel';
    runCommand(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, 'Creating git commit');
  }
} catch (err) {
  console.error('Failed to analyze repository changes or commit files.', err.message);
}

// 6. Check and configure remote origin URL
let remoteUrlExists = false;
try {
  const remotes = execSync('git remote -v', { encoding: 'utf8' });
  if (remotes.includes('origin')) {
    remoteUrlExists = true;
    console.log(`Remote 'origin' detected.`);
    
    // Check if URL matches, if not update it
    if (!remotes.includes(REPO_URL)) {
      console.log(`Updating remote 'origin' URL to: ${REPO_URL}`);
      runCommand(`git remote set-url origin ${REPO_URL}`, 'Updating remote URL');
    }
  }
} catch (e) {}

if (!remoteUrlExists) {
  console.log(`Setting remote 'origin' to: ${REPO_URL}`);
  runCommand(`git remote add origin ${REPO_URL}`, 'Adding remote origin');
}

// 7. Verify branch name (defaulting to main)
let branchName = 'main';
try {
  const branchOutput = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  if (branchOutput) {
    branchName = branchOutput;
  } else {
    // Fallback to creating a main branch if none active
    runCommand('git checkout -b main', 'Creating default main branch');
    branchName = 'main';
  }
} catch (e) {
  // If checkout fails, try setting branch name manually
  try {
    runCommand('git branch -M main', 'Setting branch name to main');
    branchName = 'main';
  } catch (err) {}
}

console.log(`Current branch active: '${branchName}'`);

// 8. Attempting to push to remote Github repo
console.log('--------------------------------------------------');
console.log(`Attempting to push changes to branch '${branchName}'...`);
console.log('Note: If Git asks for credentials, please fill them in the pop-up or console.');
console.log('--------------------------------------------------\n');

const pushSuccess = runCommand(`git push -u origin ${branchName}`, `Pushing commits to Github (${branchName})`);

if (pushSuccess) {
  console.log('==================================================');
  console.log('🎉 SUCCESS: Project successfully pushed to Github!');
  console.log(`Repository URL: ${REPO_URL}`);
  console.log('==================================================');
} else {
  console.log('==================================================');
  console.log('⚠️ WARNING: Pushing failed. This is usually due to:');
  console.log('  1. GitHub authentication credentials are required.');
  console.log('  2. Network connection or SSH key issue.');
  console.log('  3. Repository contains commits that do not exist locally.');
  console.log('\nTo resolve manually, run in your terminal:');
  console.log(`  git push -u origin ${branchName}`);
  console.log('==================================================');
}
