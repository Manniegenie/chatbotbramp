import sharp from 'sharp';
import { join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const projectRoot = join(__dirname, '..');
const inputPath = join(projectRoot, 'src', 'assets', 'wallpaper1.jpg');
const outputPath = join(projectRoot, 'src', 'assets', 'wallpaper1-optimized.jpg');

(async () => {
    if (!fs.existsSync(inputPath)) {
        console.error('Input file not found:', inputPath);
        process.exit(1);
    }

    try {
        await sharp(inputPath)
            .resize({ width: 1920, height: 1080, fit: 'cover' })
            .jpeg({ quality: 75, progressive: true, force: true })
            .toFile(outputPath);

        console.log('Optimized wallpaper written to', outputPath);
    } catch (err) {
        console.error('Failed to optimize wallpaper:', err);
        process.exit(1);
    }
})();
