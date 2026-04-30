#!/usr/bin/env python3
import re
import json
import urllib.request
import urllib.error

# Configuration
HTML_FILE = r'C:\Users\Assasin\Desktop\maciej opas\index.html'
ACCOUNT_ID = 'd15b3e5688cda8d6b0361798cf66b115'
NAMESPACE_ID = '93ff0d6970564c27b8cf40839047100b'
TOKEN = '3XGGNZGf3p8XIzeDtmw0DTlflIyQkz_-BsL9jCiWUyA.F3LcuQkhOO7T3cLkeX1hvUUcT4-AeDKOV3SdNYOm7DY'
API_BASE = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/storage/kv/namespaces/{NAMESPACE_ID}/values'

# Read HTML
with open(HTML_FILE, 'r', encoding='utf-8') as f:
    html = f.read()

# Dictionary to store extracted key-value pairs
cms_data = {}

# Extract data-cms-id from text elements (inner text)
text_pattern = re.compile(r'<[^>]*data-cms-id="([^"]+)"[^>]*>(.*?)</[^>]+>', re.DOTALL)
for match in text_pattern.finditer(html):
    key = match.group(1)
    value = match.group(2).strip()
    # Clean HTML tags from value (simple)
    value = re.sub(r'<[^>]+>', '', value)
    value = value.strip()
    if value:
        cms_data[key] = value

# Extract data-cms-id from img elements (src attribute)
img_pattern = re.compile(r'<img[^>]*data-cms-id="([^"]+)"[^>]*src="([^"]+)"', re.DOTALL)
for match in img_pattern.finditer(html):
    key = match.group(1)
    value = match.group(2)
    cms_data[key] = value

# Extract data-cms-bg (background images)
bg_pattern = re.compile(r'data-cms-bg="([^"]+)"[^>]*style="[^"]*--hero-bg:\s*url\(\'([^\']+)\'\)', re.DOTALL)
# Alternative: search for elements with data-cms-bg and get style variable
# Simpler: use a regex that captures the style containing the url
style_pattern = re.compile(r'<[^>]*data-cms-bg="([^"]+)"[^>]*style="[^"]*--hero-bg:\s*url\(([^)]+)\)', re.DOTALL)
for match in style_pattern.finditer(html):
    key = match.group(1)
    # The captured URL may have quotes; strip them
    value = match.group(2).strip("'\"")
    cms_data[key] = value

# Also include any data-cms-bg that might have style attribute with var already
# Already done.

print(f'Found {len(cms_data)} CMS fields.')

# Upload each to KV
headers = {
    'Authorization': f'Bearer {TOKEN}',
    'Content-Type': 'text/plain;charset=UTF-8'
}

for key, value in cms_data.items():
    # Encode value to bytes
    data = value.encode('utf-8')
    url = f'{API_BASE}/{urllib.parse.quote(key, safe="")}'
    req = urllib.request.Request(url, data=data, method='PUT', headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                print(f'✓ Set {key}')
            else:
                print(f'✗ {key}: HTTP {response.status}')
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'✗ {key}: {e.code} {e.reason} - {body}')
    except Exception as e:
        print(f'✗ {key}: {e}')

print('Done.')
