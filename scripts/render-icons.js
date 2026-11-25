const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.join(__dirname, '..', 'apps', 'web', 'public', 'favicon.svg');
const MOBILE_ASSETS = path.join(__dirname, '..', 'apps', 'mobile', 'assets', 'images');

const svgBuffer = fs.readFileSync(SVG_PATH);
const svgString = svgBuffer.toString('utf-8');
const innerSvg = svgString.replace(/<svg[^>]*>/, '').replace('</svg>', '');

function renderSvg(svg, size) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  return resvg.render().asPng();
}

function renderCentered(targetSize, innerScale, bg) {
  const innerSize = Math.round(targetSize * innerScale);
  const padding = (targetSize - innerSize) / 2;
  const wrapper = `<svg xmlns="http://www.w3.org/2000/svg" width="${targetSize}" height="${targetSize}" viewBox="0 0 ${targetSize} ${targetSize}">
    ${bg ? `<rect width="${targetSize}" height="${targetSize}" fill="${bg}"/>` : ''}
    <g transform="translate(${padding}, ${padding})">
      <svg width="${innerSize}" height="${innerSize}" viewBox="0 0 512 512">${innerSvg}</svg>
    </g>
  </svg>`;
  const resvg = new Resvg(wrapper, { fitTo: { mode: 'original' } });
  return resvg.render().asPng();
}

// 1. Main app icon — 1024x1024 transparent
fs.writeFileSync(path.join(MOBILE_ASSETS, 'icon.png'), renderSvg(svgString, 1024));
console.log('icon.png 1024');

// 2. Android adaptive foreground — 512x512, 66% scale, transparent
fs.writeFileSync(path.join(MOBILE_ASSETS, 'android-icon-foreground.png'), renderCentered(512, 0.66, null));
console.log('android-icon-foreground.png');

// 3. Android adaptive background — 512x512 solid teal
const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0CA678"/></svg>`;
fs.writeFileSync(path.join(MOBILE_ASSETS, 'android-icon-background.png'), renderSvg(bg, 512));
console.log('android-icon-background.png');

// 4. Android monochrome — 512x512 white icon at 66%, transparent
const whiteSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <g transform="translate(87, 87)"><svg width="338" height="338" viewBox="0 0 512 512">${innerSvg.replace(/#0CA678/g, '#FFFFFF')}</svg></g>
</svg>`;
fs.writeFileSync(path.join(MOBILE_ASSETS, 'android-icon-monochrome.png'), renderSvg(whiteSvg, 512));
console.log('android-icon-monochrome.png');

// 5. Web favicon — 64x64
fs.writeFileSync(path.join(MOBILE_ASSETS, 'favicon.png'), renderSvg(svgString, 64));
console.log('favicon.png');

// 6. Splash icon — 200x200
fs.writeFileSync(path.join(MOBILE_ASSETS, 'splash-icon.png'), renderSvg(svgString, 200));
console.log('splash-icon.png');

console.log('All PNGs generated.');
