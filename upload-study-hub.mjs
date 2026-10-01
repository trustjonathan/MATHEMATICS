import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mime from 'mime-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables:');
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const bucketName = 'study-hub-resources';
const catalogTable = 'study_hub_resources';
const targetFolders = ['notes', 'papers'];
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/plain',
]);

function listFilesRecursively(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.warn(`Folder not found: ${dirPath}`);
    return [];
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function uploadFile(filePath, rootDir) {
  const relativePath = path.relative(rootDir, filePath);
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const category = normalizedPath.split('/')[0]?.toLowerCase();
  if (!['notes', 'papers'].includes(category)) {
    console.error(`Skipped unexpected Mathematics path: ${relativePath}`);
    return 'skipped';
  }

  const destination = `documents/math/${normalizedPath}`;
  const fileBuffer = fs.readFileSync(filePath);

  const mimeType = mime.lookup(filePath) || null;
  if (!mimeType || !allowedMimeTypes.has(mimeType)) {
    console.log(`Skipped unsupported file type: ${destination}`);
    return 'skipped';
  }

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(destination, fileBuffer, {
      upsert: true,
      contentType: mimeType,
    });

  if (error) {
    console.error(`Upload failed: ${destination}`);
    console.error(error.message);
    return false;
  }

  const originalFilename = path.basename(filePath);
  const extension = path.extname(originalFilename).slice(1).toLowerCase();
  const title = path.basename(originalFilename, path.extname(originalFilename))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const yearMatches = originalFilename.match(/\b(19[89]\d|20[0-3]\d)\b/g) || [];
  const year = yearMatches.length ? Math.max(...yearMatches.map(Number)) : null;
  const upperName = originalFilename.toUpperCase();
  const levelMatch = upperName.match(/\bS\.?\s?([3-6])\b/);
  const level = levelMatch
    ? `S.${levelMatch[1]}`
    : /UACE|\bA[ -]?LEVEL\b|\bA2\b/.test(upperName)
      ? 'A-Level'
      : /\bUCE\b|O[ -]?LEVEL/.test(upperName)
        ? 'O-Level'
        : null;
  const lowerName = originalFilename.toLowerCase();
  const resourceType = /(marking guide|marking scheme|answers?|solutions?|\bguide\b|\bmg\b)/.test(lowerName)
    ? 'guide'
    : category === 'notes'
      ? 'notes'
      : 'paper';

  const { error: catalogError } = await supabase.from(catalogTable).upsert({
    subject: 'mathematics',
    category,
    storage_bucket: bucketName,
    storage_path: destination,
    original_filename: originalFilename,
    title: title || originalFilename,
    extension,
    mime_type: mimeType,
    size_bytes: fileBuffer.length,
    level,
    year,
    resource_type: resourceType,
  }, { onConflict: 'storage_bucket,storage_path' });

  if (catalogError) {
    console.error(`Uploaded but failed to index: ${destination}`);
    console.error(catalogError.message);
    return 'index-failed';
  }

  console.log(`Uploaded and indexed: ${destination}`);
  return true;
}

async function main() {
  let totalUploaded = 0;
  let totalSkipped = 0;
  let totalIndexFailed = 0;

  for (const folderName of targetFolders) {
    const folderPath = path.join(__dirname, folderName);
    const files = listFilesRecursively(folderPath);

    if (files.length === 0) {
      console.log(`No files found in ${folderName}/`);
      continue;
    }

    console.log(`Uploading ${files.length} file(s) from ${folderName}/`);

    for (const filePath of files) {
      const result = await uploadFile(filePath, __dirname);
      if (result === true) totalUploaded += 1;
      if (result === 'skipped') totalSkipped += 1;
      if (result === 'index-failed') totalIndexFailed += 1;
    }
  }

  console.log(`Finished. Uploaded and indexed ${totalUploaded} file(s). Skipped ${totalSkipped} unsupported file(s). Index failures: ${totalIndexFailed}.`);
  if (totalIndexFailed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('Unexpected error:');
  console.error(error);
  process.exit(1);
});
