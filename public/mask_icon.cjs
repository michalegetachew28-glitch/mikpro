const sharp = require('sharp');
const fs = require('fs');

const input = 'C:\\Users\\hp\\.gemini\\antigravity\\brain\\f3873816-0a1c-48ab-9cb1-bd00b43747de\\premium_garage_icon_1778252264796.png';
const mask = Buffer.from('<svg><rect x="0" y="0" width="512" height="512" rx="115" ry="115" fill="#fff"/></svg>');

async function run() {
  try {
    const cropped = await sharp(input)
      .extract({ left: 165, top: 165, width: 694, height: 694 })
      .resize(512, 512)
      .toBuffer();

    await sharp(cropped)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toFile('logo512.png');

    await sharp(cropped)
      .composite([{ input: mask, blend: 'dest-in' }])
      .resize(192, 192)
      .png()
      .toFile('logo192.png');

    fs.copyFileSync('logo512.png', '../dist/logo512.png');
    fs.copyFileSync('logo192.png', '../dist/logo192.png');
    console.log('Icons perfectly cropped, masked, and deployed!');
  } catch(e) {
    console.error(e);
  }
}
run();
