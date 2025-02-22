#!/usr/bin/env node
"use strict";

import { execSync } from "child_process";
import {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
} from "fs";
import { join, dirname, resolve, basename } from "path";
import { Command } from "commander";
import chalk from "chalk";
import { fileURLToPath } from "url";

/**
 * @fileoverview
 * CLI tool to scaffold a new CottonJS application from a basic template.
 * - Copies template files into the target directory.
 * - Updates package.json with the chosen app name.
 * - Installs dependencies (via npm).
 * - Prints instructions for running the development server.
 */

const program = new Command();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "package.json");
const packageJsonContent = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const templateDirectory = resolve(__dirname, "templates", "basic");

program
  .name("create-cotton-app")
  .version(packageJsonContent.version)
  .argument("[appName]", "Project name (default: current directory)")
  .description("Create a new Cotton app")
  .action(handleCreateApp);

program.parse(process.argv);

/**
 * Handler for creating the CottonJS app
 *
 * @param {string} [appName] - The name for the app folder.
 */
function handleCreateApp(appName) {
  const appPath = resolve(
    appName === "." || !appName ? process.cwd() : appName
  );
  const finalAppName =
    appName === "." || !appName ? basename(process.cwd()) : appName;

  console.log(chalk.green(`Creating a new Cotton app in ${appPath}...`));

  if (existsSync(appPath) && appPath !== process.cwd()) {
    console.error(chalk.red(`Error: Directory "${appName}" already exists.`));
    process.exit(1);
  }

  console.log(chalk.blue("Copying template files..."));
  copyDirectory(templateDirectory, appPath);

  console.log(chalk.blue("Customizing project files..."));

  const packageJsonPath = join(appPath, "package.json");
  const packageJsonContent = readFileSync(packageJsonPath, "utf8").replace(
    /{{appName}}/g,
    finalAppName
  );
  writeFileSync(packageJsonPath, packageJsonContent);

  console.log(chalk.blue("Installing dependencies..."));

  execSync("npm install", { cwd: appPath, stdio: "inherit" });

  console.log(chalk.green("CottonJS app created successfully!"));
  console.log(chalk.yellow(`\nNext steps:\n  cd ${appPath}\n  npm run dev\n`));
}

/**
 * Recursively copies all files and directories from `src` to `dest`.
 *
 * @param {string} src - Path to the source template directory.
 * @param {string} dest - Target path for the new project directory.
 */
function copyDirectory(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}
