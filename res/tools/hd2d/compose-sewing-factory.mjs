import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// 保留空白牌匾母稿与独立文字层。文字为曙光里制衣厂，Hiragino Sans GB 84pt，
// 填色/描边 #603617，描边 1.7px，逆时针 4.5°。默认复用审核时的字形，避免字体版本改变牌面。
const source = fileURLToPath(new URL('../../source/rendered2d/production/sewing-factory/', import.meta.url));
const destination = process.argv[2] || path.join(source, 'motion_factory_body.png');
execFileSync('magick', [path.join(source, 'factory-master.png'), path.join(source, 'masters/factory-sign.png'),
    '-geometry', '+531+540', '-compose', 'over', '-composite', '-crop', '1240x1020+28+100', '+repage',
    '-filter', 'Lanczos', '-resize', '224x', '-define', 'png:exclude-chunk=time,date', destination]);
