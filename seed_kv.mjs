const fs = await import('fs');
const html = fs.readFileSync('index.html', 'utf-8');
const cmsData = new Map();

// Extract text content: <tag data-cms-id="key">value</tag>
const textRegex = /<([a-z0-9]+)[^>]*data-cms-id="([^"]+)"[^>]*>([^<]*)<\/\1>/gi;
let m;
while ((m = textRegex.exec(html)) !== null) {
  const key = m[2];
  const value = m[3].trim();
  if (value) cmsData.set(key, value);
}

// Extract img src: find img tags with data-cms-id, then get src
const imgTagRegex = /<img[^>]*data-cms-id="([^"]+)"[^>]*>/gi;
let tagMatch;
while ((tagMatch = imgTagRegex.exec(html)) !== null) {
  const key = tagMatch[1];
  const tag = tagMatch[0];
  const srcMatch = tag.match(/src="([^"]+)"/);
  if (srcMatch) {
    cmsData.set(key, srcMatch[1]);
  }
}

// Extract background images: elements with data-cms-bg and style containing --hero-bg
const bgTagRegex = /<[^>]*data-cms-bg="([^"]+)"[^>]*style="[^"]*--hero-bg:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)[^>]*>/gi;
while ((tagMatch = bgTagRegex.exec(html)) !== null) {
  const key = tagMatch[1];
  const value = tagMatch[2];
  cmsData.set(key, value);
}

console.log(`Found ${cmsData.size} CMS fields`);

const accountId = 'd15b3e5688cda8d6b0361798cf66b115';
const namespaceId = '93ff0d6970564c27b8cf40839047100b';
const token = '3XGGNZGf3p8XIzeDtmw0DTlflIyQkz_-BsL9jCiWUyA.F3LcuQkhOO7T3cLkeX1hvUUcT4-AeDKOV3SdNYOm7DY';

let success = 0, fail = 0;
for (const [key, value] of cmsData) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain;charset=UTF-8'
      },
      body: value
    });
    const data = await res.json();
    if (res.ok && data.success) {
      console.log(`✓ ${key} = ${value.substring(0, 40)}`);
      success++;
    } else {
      console.log(`✗ ${key}: ${res.status} ${JSON.stringify(data.errors||data.messages)}`);
      fail++;
    }
  } catch (e) {
    console.log(`✗ ${key}: ${e}`);
    fail++;
  }
}
console.log(`Done: ${success} ok, ${fail} fail`);
