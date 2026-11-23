#!/usr/bin/env node
/**
 * Automated QA Content Scanner
 * Checks user-facing deletion UI, modals, and checklists for:
 * - Broken links or placeholder URLs
 * - Common spelling errors
 * - Forbidden database jargon ("Supabase", "PostgreSQL", "SQL table", etc.)
 */
import fs from 'node:fs';
import path from 'node:path';

const FORBIDDEN_JARGON = ['supabase', 'postgresql', 'postgres', 'sql table', 'rls policy', 'database row'];
const TYPOS = {
  exersize: 'exercise',
  exersise: 'exercise',
  protien: 'protein',
  acount: 'account',
  delte: 'delete',
  permanantly: 'permanently',
  recieve: 'receive',
  seperate: 'separate',
  wrokout: 'workout',
  calender: 'calendar',
  suppliment: 'supplement'
};

const rootDir = process.cwd();
const findings = [];

function scanSnippet(label, text) {
  const cleanText = text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  const lower = cleanText.toLowerCase();
  for (const term of FORBIDDEN_JARGON) {
    if (lower.includes(term)) {
      findings.push(`[JARGON] ${label}: found forbidden term "${term}"`);
    }
  }

  const words = lower.match(/\b[a-z]+\b/g) || [];
  for (const word of words) {
    if (TYPOS[word]) {
      findings.push(`[TYPO] ${label}: "${word}" -> "${TYPOS[word]}"`);
    }
  }

  const hrefRegex = /href\s*=\s*["']([^"']*)["']/gi;
  let match;
  while ((match = hrefRegex.exec(text)) !== null) {
    const url = match[1].trim();
    if (!url || url === '#' || url.toLowerCase().startsWith('javascript:') || url.includes('example.com')) {
      findings.push(`[LINK] ${label}: broken or placeholder href="${url}"`);
    }
  }
}

// 1. Scan DeletionModals.tsx user-facing JSX strings
const modalsPath = path.join(rootDir, 'src/components/DeletionModals.tsx');
if (fs.existsSync(modalsPath)) {
  const modalsSrc = fs.readFileSync(modalsPath, 'utf8');
  scanSnippet('src/components/DeletionModals.tsx', modalsSrc);
}

// 2. Scan index.html deletion & post-delete modals + delete account button
const indexPath = path.join(rootDir, 'index.html');
if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, 'utf8');
  const deleteModalMatch = html.match(/<div id="delete-account-confirm-modal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  if (deleteModalMatch) {
    scanSnippet('index.html#delete-account-confirm-modal', deleteModalMatch[0]);
    if (!deleteModalMatch[0].includes('Are you sure you want to delete this account forever? All your saved workouts and meals will be gone.')) {
      findings.push('[COPY] index.html#delete-account-confirm-modal: missing exact required deletion warning text.');
    }
  } else {
    findings.push('[MISSING] index.html#delete-account-confirm-modal not found.');
  }

  const switchModalMatch = html.match(/<div id="post-delete-switch-modal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  if (switchModalMatch) {
    scanSnippet('index.html#post-delete-switch-modal', switchModalMatch[0]);
    if (!switchModalMatch[0].includes('Account deleted. Please select your active account to continue.')) {
      findings.push('[COPY] index.html#post-delete-switch-modal: missing exact required post-delete prompt.');
    }
  } else {
    findings.push('[MISSING] index.html#post-delete-switch-modal not found.');
  }

  const deleteBtnMatch = html.match(/<button[^>]*id="delete-account-data-btn"[\s\S]*?<\/button>/);
  if (deleteBtnMatch) {
    scanSnippet('index.html#delete-account-data-btn', deleteBtnMatch[0]);
  }
}

// 3. Scan deployment checklist doc
const checklistPath = path.join(rootDir, 'docs/DEPLOYMENT_CHECKLIST.md');
if (fs.existsSync(checklistPath)) {
  const md = fs.readFileSync(checklistPath, 'utf8');
  scanSnippet('docs/DEPLOYMENT_CHECKLIST.md', md);
}

if (findings.length > 0) {
  console.error('QA Content Scan FAILED:');
  for (const item of findings) {
    console.error(' -', item);
  }
  process.exit(1);
}

console.log('QA Content Scan PASSED: 0 broken links, 0 typos, 0 forbidden database terms in user-facing deletion UI.');
