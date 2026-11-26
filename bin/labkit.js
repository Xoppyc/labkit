#!/usr/bin/env node
import { Command } from 'commander';
import { readDocxCommand } from '../src/commands/readDocx.js';
import { readPdfCommand } from '../src/commands/readPdf.js';
import { reportBuildCommand } from '../src/commands/reportBuild.js';
import { reportPatchCommand } from '../src/commands/reportPatch.js';
import { reportVerifyCommand } from '../src/commands/reportVerify.js';
import { snapCommand } from '../src/commands/snap.js';

const program = new Command();

program
  .name('labkit')
  .description('Opinionated Node.js CLI for university lab assignments, .docx reports, and terminal screenshots')
  .version('1.0.0');

// --- read ---
const readCmd = program.command('read').description('Extract text, tables, and images from .docx or .pdf files');

readCmd
  .command('docx <file>')
  .description('Extract text, Markdown tables, and optionally images (+ WMF->PNG) from a .docx file')
  .option('-o, --out <file>', 'Write extracted Markdown to a file instead of stdout')
  .option('--images <dir>', 'Extract embedded media to directory (auto-converts .wmf to .png if ImageMagick is present)')
  .option('--variant <row>', 'Only extract a specific variant row (1-based) from tables', (v) => parseInt(v, 10))
  .action(readDocxCommand);

readCmd
  .command('pdf <file>')
  .description('Extract text from a .pdf file')
  .option('-o, --out <file>', 'Write extracted text to a file instead of stdout')
  .option('--max-chars <n>', 'Truncate output to N characters', (v) => parseInt(v, 10))
  .action(readPdfCommand);

// --- report ---
const reportCmd = program.command('report').description('Build, patch, and verify .docx lab reports');

reportCmd
  .command('build <markdown>')
  .description('Compile a Markdown file (with YAML frontmatter) into a styled .docx report')
  .option('-t, --template <docx>', 'Custom .docx template path (defaults to bundled LNU template)')
  .option('-o, --out <docx>', 'Output .docx path (required)')
  .option('--img-width <inches>', 'Max embedded image width in inches', parseFloat, 5.8)
  .action(reportBuildCommand);

reportCmd
  .command('patch <target>')
  .description('Find and replace text across a .docx file or all .docx files in a directory')
  .requiredOption('--find <text>', 'Exact text to find')
  .requiredOption('--replace <text>', 'Replacement text')
  .action(reportPatchCommand);

reportCmd
  .command('verify <target>')
  .description('Audit .docx report(s): embedded images, tables, size, and leftover placeholders')
  .action(reportVerifyCommand);

// --- snap ---
program
  .command('snap')
  .description('Render a clean Linux/GNOME terminal screenshot PNG from a command or stdin')
  .option('--cmd <command>', 'Run shell command and capture its output')
  .option('--text <output>', 'Use literal output text instead of running a command')
  .option('--prompt <prompt>', 'Prompt prefix shown before command', 'xyc@lnu-desktop:~$ ')
  .option('--title <title>', 'Window title bar text', 'Terminal')
  .requiredOption('-o, --out <png>', 'Output PNG path')
  .action(snapCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error(`labkit error: ${err.message}`);
  process.exit(1);
});
