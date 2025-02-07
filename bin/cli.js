#!/usr/bin/env node
import createWaffle from '../src/create-waffle.min.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pc from 'picocolors';

// Constants
const PATHS = {
  self: fileURLToPath(import.meta.url),
  base: null, // Will be set in initialization
};

// Command instructions
const COMMANDS = {
  cd: (dir) => `cd ${dir}`,
  install: 'npm install',
  start: 'npm run dev',
};

class CLI {
  static async initialize() {
    PATHS.base = dirname(PATHS.self);
    process.on('unhandledRejection', this.handleError);
    process.on('uncaughtException', this.handleError);
  }

  static handleError(error) {
    console.error(pc.red('Fatal error:'), error.message);
    process.exit(1);
  }

  static getNextSteps(projectPath) {
    const steps = [];
    
    // Only show cd command if we're not in the project directory
    if (path.resolve(process.cwd()) !== path.resolve(projectPath)) {
      steps.push(COMMANDS.cd(path.relative(process.cwd(), projectPath)));
    }

    steps.push(COMMANDS.install, COMMANDS.start);
    return steps;
  }

  static showNextSteps(steps) {
    console.log(pc.blue(pc.bold('Next steps:')));
    steps.forEach(step => console.log(pc.white(`  ${step}`)));
    console.log(); // Empty line for better readability
  }

  static async run() {
    try {
      await this.initialize();
      
      // Create project and get path
      const projectPath = await createWaffle();
      
      // Show next steps
      const nextSteps = this.getNextSteps(projectPath);
      this.showNextSteps(nextSteps);

      process.exit(0);
    } catch (error) {
      this.handleError(error);
    }
  }
}

// Execute CLI
CLI.run();