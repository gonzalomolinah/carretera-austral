import sharp from 'sharp'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const icons = resolve(root, 'public', 'icons')

await Promise.all([
  sharp(resolve(icons, 'icon.svg')).resize(192, 192).png().toFile(resolve(icons, 'icon-192.png')),
  sharp(resolve(icons, 'icon.svg')).resize(512, 512).png().toFile(resolve(icons, 'icon-512.png')),
  sharp(resolve(icons, 'icon-maskable.svg')).resize(512, 512).png().toFile(resolve(icons, 'icon-maskable-512.png')),
  sharp(resolve(icons, 'icon.svg')).resize(180, 180).png().toFile(resolve(icons, 'apple-touch-icon.png')),
])

console.log('Iconos PWA generados en public/icons.')
