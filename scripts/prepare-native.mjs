import { mkdir, writeFile } from 'node:fs/promises';

const target = process.env.VERT_APP_URL?.trim();
const escaped = target?.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
const body = target
  ? `<meta http-equiv="refresh" content="0; url=${escaped}">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<p>Đang mở Vert...</p>\n<p><a href="${escaped}">Tiếp tục</a></p>`
  : '<meta name="viewport" content="width=device-width, initial-scale=1">\n<h1>Vert</h1>\n<p>Bản đóng gói này cần biến VERT_APP_URL trỏ tới máy chủ Vert đang chạy.</p>';

await mkdir('www', { recursive: true });
await writeFile('www/index.html', `<!doctype html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">\n<title>Vert</title>\n${body}\n</head>\n</html>\n`);
