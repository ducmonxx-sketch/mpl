import sharp from 'sharp'

const tasks = [
  { in: 'public/fresh_logistics_bg.png', out: 'public/fresh_logistics_bg.webp', opts: { quality: 80 } },
  { in: 'public/logos/Honda_Logo.svg.png', out: 'public/logos/Honda_Logo.webp', opts: { quality: 90 } },
  { in: 'public/logos/Mitsubishi_Logo.png', out: 'public/logos/Mitsubishi_Logo.webp', opts: { quality: 90 } },
  { in: 'public/logos/QJ_Logo.png', out: 'public/logos/QJ_Logo.webp', opts: { quality: 90 } },
  { in: 'public/logos/Suzuki_Logo.png', out: 'public/logos/Suzuki_Logo.webp', opts: { quality: 90 } },
  { in: 'public/logos/Yadea_Logo.svg.png', out: 'public/logos/Yadea_Logo.webp', opts: { quality: 90 } },
  { in: 'public/logos/Yamaha_Logo.png', out: 'public/logos/Yamaha_Logo.webp', opts: { quality: 90 } },
]

for (const t of tasks) {
  await sharp(t.in).webp(t.opts).toFile(t.out)
  console.log('converted', t.in, '->', t.out)
}
