#!/usr/bin/env node
/**
 * Summarize BiDi migration lint (raw text / input counts).
 * Usage: node scripts/lint-bidi-summary.mjs
 */
import { ESLint } from 'eslint';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const TARGETS = ['src/components', 'src/pages', 'src/admin'];

async function main() {
    const eslint = new ESLint({
        cwd: root,
        overrideConfigFile: path.join(root, '.eslintrc.bidi.cjs'),
        useEslintrc: false,
        extensions: ['.js', '.jsx'],
        errorOnUnmatchedPattern: false,
    });

    const results = await eslint.lintFiles(
        TARGETS.map((dir) => path.join(root, dir, '**/*.{js,jsx}'))
    );

    let textElements = 0;
    let textInputs = 0;
    const files = new Set();

    for (const result of results) {
        for (const msg of result.messages) {
            if (msg.ruleId === 'bidi/no-raw-text-elements') {
                textElements += 1;
                files.add(result.filePath);
            }
            if (msg.ruleId === 'bidi/no-raw-text-input') {
                textInputs += 1;
                files.add(result.filePath);
            }
        }
    }

    console.log('BiDi migration lint summary');
    console.log('===========================');
    console.log(`Scope: ${TARGETS.join(', ')}`);
    console.log(`Files with violations: ${files.size}`);
    console.log(`Raw text tags (p/span/h1–h6): ${textElements}`);
    console.log(`Raw text inputs (input/textarea): ${textInputs}`);
    console.log(`Total: ${textElements + textInputs}`);
    console.log('');
    console.log('Run npm run lint:bidi for per-line locations.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
