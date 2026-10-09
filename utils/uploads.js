import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

// O tipo é decidido pela assinatura do arquivo, não pela extensão ou pelo
// Content-Type enviado pelo navegador.
function detectImage(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1, fields: 10 }
});

// Recebe um único arquivo de imagem. Erros de tamanho ficam em req.uploadError.
export function singleImage(field) {
  const handler = upload.single(field);
  return (req, res, next) => handler(req, res, err => {
    if (err) {
      req.uploadError = err.code === 'LIMIT_FILE_SIZE' ? 'A imagem deve ter no máximo 2 MB.' : 'Não foi possível enviar a imagem.';
    }
    next();
  });
}

export function validateImage(file) {
  if (!file || !file.buffer?.length) return { error: 'Selecione uma imagem.' };
  const ext = detectImage(file.buffer);
  if (!ext) return { error: 'Formato não suportado. Envie uma imagem JPG, PNG ou WEBP.' };
  return { ext };
}

export async function saveImage(file, ext, folder) {
  const dir = path.join(rootDir, 'uploads', folder);
  await fs.mkdir(dir, { recursive: true });
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(dir, name), file.buffer);
  return `/uploads/${folder}/${name}`;
}

// Remove apenas arquivos dentro de uploads/, ignorando caminhos inesperados.
export async function removeImage(publicPath) {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return;
  const uploadsDir = path.join(rootDir, 'uploads');
  const target = path.resolve(rootDir, `.${publicPath}`);
  if (!target.startsWith(uploadsDir + path.sep)) return;
  await fs.unlink(target).catch(() => {});
}
