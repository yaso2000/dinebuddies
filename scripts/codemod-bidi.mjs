#!/usr/bin/env node
/**
 * Codemod: replace raw text tags with AppText / AppTextInput across UI surfaces.
 * Usage: node scripts/codemod-bidi.mjs [--write] [--paths src/components ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';

const traverse = _traverse.default ?? _traverse;
const generate = _generate.default ?? _generate;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE_DIR = path.join(ROOT, 'src/components/base');

const RAW_TEXT_TAGS = new Set(['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'password']);

const SKIP_PATH_PARTS = [
    `${path.sep}src${path.sep}components${path.sep}base${path.sep}`,
    `${path.sep}src${path.sep}features${path.sep}motion-post${path.sep}templates${path.sep}`,
    `${path.sep}node_modules${path.sep}`,
    `${path.sep}backups${path.sep}`,
    `${path.sep}_backups${path.sep}`,
];

const SKIP_FILES = new Set([]);

const DEFAULT_PATHS = [
    path.join(ROOT, 'src/components'),
    path.join(ROOT, 'src/pages'),
    path.join(ROOT, 'src/admin'),
];

/** @param {string} filePath */
function shouldSkip(filePath) {
    const norm = path.normalize(filePath);
    if (SKIP_FILES.has(norm)) return true;
    return SKIP_PATH_PARTS.some((part) => norm.includes(part));
}

/** @param {string} dir */
function walkJsxFiles(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules') continue;
            walkJsxFiles(full, out);
        } else if (/\.(jsx|tsx)$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

/** @param {import('@babel/types').JSXElement['openingElement']['name']} nameNode */
function getSimpleTag(nameNode) {
    if (t.isJSXIdentifier(nameNode)) return nameNode.name;
    return null;
}

/** @param {import('@babel/types').JSXAttribute[]} attributes */
function getInputType(attributes) {
    const typeAttr = attributes.find(
        (attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'type'
    );
    if (!typeAttr) return 'text';
    if (typeAttr.value == null) return 'text';
    if (t.isStringLiteral(typeAttr.value)) return typeAttr.value.value;
    return null;
}

/** @param {string} filePath */
function baseImportSource(filePath) {
    let rel = path.relative(path.dirname(filePath), BASE_DIR);
    rel = rel.split(path.sep).join('/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return rel;
}

/** @param {import('@babel/types').Program} program */
function ensureImports(program, filePath, needsText, needsInput) {
    if (!needsText && !needsInput) return;

    const specifiers = [];
    if (needsText) specifiers.push(t.importSpecifier(t.identifier('AppText'), t.identifier('AppText')));
    if (needsInput) {
        specifiers.push(t.importSpecifier(t.identifier('AppTextInput'), t.identifier('AppTextInput')));
    }

    const source = baseImportSource(filePath);
    const existing = program.body.find(
        (node) =>
            t.isImportDeclaration(node) &&
            t.isStringLiteral(node.source) &&
            node.source.value.replace(/\\/g, '/') === source.replace(/\\/g, '/')
    );

    if (existing && t.isImportDeclaration(existing)) {
        const names = new Set(
            existing.specifiers
                .filter((s) => t.isImportSpecifier(s) && t.isIdentifier(s.imported))
                .map((s) => /** @type {t.ImportSpecifier} */ (s).imported.name)
        );
        for (const spec of specifiers) {
            const imported = /** @type {t.ImportSpecifier} */ (spec).imported.name;
            if (!names.has(imported)) {
                existing.specifiers.push(spec);
            }
        }
        return;
    }

    // Remove separate AppText-only imports from same path if any partial
    program.body = program.body.filter((node) => {
        if (!t.isImportDeclaration(node) || !t.isStringLiteral(node.source)) return true;
        if (node.source.value.replace(/\\/g, '/') !== source.replace(/\\/g, '/')) return true;
        return false;
    });

    const decl = t.importDeclaration(specifiers, t.stringLiteral(source));
    const lastImportIdx = program.body.findLastIndex((n) => t.isImportDeclaration(n));
    if (lastImportIdx >= 0) {
        program.body.splice(lastImportIdx + 1, 0, decl);
    } else {
        program.body.unshift(decl);
    }
}

/** @param {string} filePath @param {string} code */
function transformFile(filePath, code) {
    let ast;
    try {
        ast = parse(code, {
            sourceType: 'module',
            plugins: ['jsx'],
            errorRecovery: true,
        });
    } catch {
        return { changed: false, error: 'parse' };
    }

    let needsText = false;
    let needsInput = false;

    traverse(ast, {
        JSXElement(path) {
            const opening = path.node.openingElement;
            const tag = getSimpleTag(opening.name);
            if (!tag) return;

            if (RAW_TEXT_TAGS.has(tag)) {
                opening.name = t.jsxIdentifier('AppText');
                opening.attributes.unshift(
                    t.jsxAttribute(t.jsxIdentifier('as'), t.stringLiteral(tag))
                );
                if (path.node.closingElement && t.isJSXIdentifier(path.node.closingElement.name)) {
                    path.node.closingElement.name = t.jsxIdentifier('AppText');
                }
                needsText = true;
                return;
            }

            if (tag === 'textarea') {
                opening.name = t.jsxIdentifier('AppTextInput');
                const hasAs = opening.attributes.some(
                    (attr) =>
                        t.isJSXAttribute(attr) &&
                        t.isJSXIdentifier(attr.name) &&
                        attr.name.name === 'as'
                );
                if (!hasAs) {
                    opening.attributes.unshift(
                        t.jsxAttribute(t.jsxIdentifier('as'), t.stringLiteral('textarea'))
                    );
                }
                if (path.node.closingElement && t.isJSXIdentifier(path.node.closingElement.name)) {
                    path.node.closingElement.name = t.jsxIdentifier('AppTextInput');
                }
                needsInput = true;
                return;
            }

            if (tag === 'input') {
                const inputType = getInputType(opening.attributes);
                if (inputType === null || TEXT_INPUT_TYPES.has(inputType)) {
                    opening.name = t.jsxIdentifier('AppTextInput');
                    needsInput = true;
                }
            }
        },
    });

    if (!needsText && !needsInput) return { changed: false };

    ensureImports(ast.program, filePath, needsText, needsInput);

    const output = generate(ast, {
        retainLines: true,
        jsescOption: { minimal: true },
    }).code;

    return { changed: true, code: output };
}

function main() {
    const write = process.argv.includes('--write');
    const pathArgs = process.argv.filter((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);
    const targets = pathArgs.length
        ? pathArgs.map((p) => path.resolve(ROOT, p))
        : DEFAULT_PATHS;

    const files = targets.flatMap((target) => {
        if (fs.statSync(target).isDirectory()) return walkJsxFiles(target);
        return [target];
    });

    let changed = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of files) {
        if (shouldSkip(file)) {
            skipped += 1;
            continue;
        }

        const source = fs.readFileSync(file, 'utf8');
        const result = transformFile(file, source);
        if (result.error) {
            failed += 1;
            console.warn(`SKIP (parse): ${path.relative(ROOT, file)}`);
            continue;
        }
        if (!result.changed) continue;

        changed += 1;
        if (write) {
            fs.writeFileSync(file, result.code, 'utf8');
        }
        console.log(`${write ? 'UPDATED' : 'DRY-RUN'}: ${path.relative(ROOT, file)}`);
    }

    console.log('');
    console.log(`Changed: ${changed} | Skipped: ${skipped} | Parse failed: ${failed}`);
    if (!write && changed > 0) {
        console.log('Re-run with --write to apply.');
    }
}

main();
