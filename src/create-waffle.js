import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import pc from 'picocolors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

// Promisified exec
const execAsync = promisify(exec);

// Cache mechanism
const cache = new Map();

// Constants
const PATHS = {
  self: fileURLToPath(import.meta.url),
  template: null, // Will be set in initialization
  libraries: null, // Will be set in initialization
};

const CONFIG = {
  defaultFolder: 'my-app',
  validNameRegex: /^[\w-]+$/,
  cacheTimeout: 60 * 60 * 1000,
};

const UI = {
  ascii: `
                        .d888  .d888 888          
                       d88P"  d88P"  888          
                       888    888    888          
888  888  888  8888b.  888888 888888 888  .d88b.  
888  888  888     "88b 888    888    888 d8P  Y8b 
888  888  888 .d888888 888    888    888 88888888 
Y88b 888 d88P 888  888 888    888    888 Y8b.     
 "Y8888888P"  "Y888888 888    888    888  "Y8888  `,
  messages: {
    error: (msg) => pc.red(`❌ ${msg}`),
    success: (msg) => pc.green(`✔ ${msg}`),
    warning: (msg) => pc.yellow(`⚠ ${msg}`),
    heading: (text) => pc.blue(pc.bold(`\n${text}`)),
  }
};

// Utilities
class CacheManager {
  static async get(key, fetchFn, timeout = CONFIG.cacheTimeout) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < timeout) {
      return cached.data;
    }
    const data = await fetchFn();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  static clear() {
    cache.clear();
  }
}

class FileManager {
  static async readLibraries() {
    return CacheManager.get('libraries', async () => {
      try {
        return await fs.readJson(PATHS.libraries);
      } catch (error) {
        throw new Error(`Failed to load libraries: ${error.message}`);
      }
    });
  }

  static async createProjectStructure(targetDir) {
    await fs.ensureDir(targetDir);
    await fs.copy(PATHS.template, targetDir);
    return targetDir;
  }

  static async updateIndexHtml(targetDir, library) {
    if (!library || library === 'none') return;

    const indexPath = path.join(targetDir, 'src/index.html');
    const content = await fs.readFile(indexPath, 'utf8');
    
    const { css = [], js = [] } = library;
    
    const updatedContent = content
      .replace('</head>', `${this.generateCssTags(css)}\n</head>`)
      .replace('</body>', `${this.generateJsTags(js)}\n</body>`);

    await fs.writeFile(indexPath, updatedContent);
  }

  static generateCssTags(cssLinks) {
    return cssLinks.map(link => 
      `  <link rel="stylesheet" href="${link.src}"${link.integrity ? ` integrity="${link.integrity}"` : ''}${link.crossorigin ? ' crossorigin="anonymous"' : ''}>`
    ).join('\n');
  }

  static generateJsTags(jsScripts) {
    return jsScripts.map(script => 
      `  <script src="${script.src}"${script.defer ? ' defer' : ''}${script.integrity ? ` integrity="${script.integrity}"` : ''}${script.crossorigin ? ' crossorigin="anonymous"' : ''}></script>`
    ).join('\n');
  }
}

class ProjectManager {
  static async initializePaths() {
    const baseDir = dirname(PATHS.self);
    PATHS.template = path.join(baseDir, 'template');
    PATHS.libraries = path.join(baseDir, 'libraries.min.json');
  }

  static async updatePackageJson(targetDir) {
    const projectName = path.basename(targetDir);
    await execAsync(`npm pkg set name="${projectName}"`, { cwd: targetDir });
    await execAsync('npx npm-check-updates -u', { cwd: targetDir });
  }

  static getCreatedFiles() {
    return [
      'public/waffle.svg',
      'src/assets/style.css',
      'src/index.html',
      'src/main.js',
      '.editorconfig',
      '.gitignore',
      'package.json'
    ];
  }
}

class CLI {
  static async promptQuestions() {
    const useCurrentDir = await inquirer.prompt({
      type: 'confirm',
      name: 'value',
      message: pc.white('Do you want to use the current directory?'),
      default: false,
    });

    let targetDir = process.cwd();
    if (!useCurrentDir.value) {
      const folderName = await inquirer.prompt({
        type: 'input',
        name: 'value',
        message: pc.white('Project name:'),
        default: CONFIG.defaultFolder,
        validate: (input) => CONFIG.validNameRegex.test(input) || 'Please enter a valid folder name.',
      });
      targetDir = path.join(process.cwd(), folderName.value);
    }

    const libraries = await FileManager.readLibraries();
    const libraryChoices = Object.keys(libraries)
      .map(id => ({ name: id, value: id }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .concat([{ name: 'none', value: 'none' }]);

    const selectedLibrary = await inquirer.prompt({
      type: 'list',
      name: 'value',
      message: pc.white('What would you like to add to your project?'),
      choices: libraryChoices,
      default: 'none',
    });

    return { targetDir, selectedLibrary: selectedLibrary.value };
  }

  static showSuccess(targetDir) {
    console.log(
      `${UI.messages.success('Project created: ')}${pc.underline(targetDir)}\n` +
      UI.messages.heading('Created files:') + '\n' +
      ProjectManager.getCreatedFiles().map(file => `- ${pc.yellow(file)}`).join('\n') + '\n'
    );
  }
}

// Main execution flow
const createWaffle = async () => {
  try {
    await ProjectManager.initializePaths();
    
    console.log(pc.white(UI.ascii));
    console.log('\n> create-waffle\n');

    const { targetDir, selectedLibrary } = await CLI.promptQuestions();
    
    await FileManager.createProjectStructure(targetDir);
    await ProjectManager.updatePackageJson(targetDir);
    
    const libraries = await FileManager.readLibraries();
    await FileManager.updateIndexHtml(targetDir, libraries[selectedLibrary]);

    CLI.showSuccess(targetDir);
    return targetDir;

  } catch (error) {
    console.error(UI.messages.error(error.message));
    process.exit(1);
  } finally {
    CacheManager.clear();
  }
};

export default createWaffle;