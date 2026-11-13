// Проверка страницы перед выкладкой. Запуск: node tools/check.mjs
// Без зависимостей: читает index.html и убеждается, что
//   1) все локальные файлы, на которые ссылается страница, существуют и не пусты;
//   2) ссылки вида href="#раздел" ведут на существующие якоря;
//   3) id на странице не повторяются;
//   4) встроенные скрипты разбираются без синтаксических ошибок.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const errors = [];

// 1. Локальные файлы
const files = new Set();
for (const [, url] of html.matchAll(/\b(?:src|poster|href)\s*=\s*"([^"]+)"/g)) {
  if (/^(#|https?:|data:|mailto:|tel:)/.test(url)) continue;
  files.add(url.split(/[?#]/)[0]);
}
for (const file of files) {
  const path = join(root, file);
  if (!existsSync(path)) errors.push(`нет файла: ${file}`);
  else if (statSync(path).size === 0) errors.push(`пустой файл: ${file}`);
}

// 2 и 3. Якоря и id
const idCount = new Map();
for (const [, id] of html.matchAll(/\bid\s*=\s*"([^"]+)"/g)) idCount.set(id, (idCount.get(id) || 0) + 1);
const anchors = new Set([...html.matchAll(/\bhref\s*=\s*"#([^"]+)"/g)].map(m => m[1]));
for (const anchor of anchors) if (!idCount.has(anchor)) errors.push(`ссылка на несуществующий якорь: #${anchor}`);
for (const [id, n] of idCount) if (n > 1) errors.push(`id «${id}» встречается ${n} раза`);

// 4. Встроенные скрипты
let scripts = 0;
for (const [, attrs, code] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (/\bsrc\s*=/.test(attrs) || !code.trim()) continue;
  scripts++;
  try {
    new vm.Script(code, { filename: `index.html, скрипт ${scripts}` });
  } catch (error) {
    errors.push(`синтаксическая ошибка в скрипте ${scripts}: ${error.message}`);
  }
}

if (errors.length) {
  console.error(`Проверка не пройдена, ошибок: ${errors.length}`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`Проверка пройдена: файлов ${files.size}, якорей ${anchors.size}, id ${idCount.size}, скриптов ${scripts}.`);
