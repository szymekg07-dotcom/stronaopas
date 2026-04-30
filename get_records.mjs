const token = '3XGGNZGf3p8XIzeDtmw0DTlflIyQkz_-BsL9jCiWUyA.F3LcuQkhOO7T3cLkeX1hvUUcT4-AeDKOV3SdNYOm7DY';
const accountId = 'd15b3e5688cda8d6b0361798cf66b115';
const projectName = 'opas-com-pl';
const domain = 'opas.com.pl';

const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/domains/${domain}/records`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const data = await res.json();
if (data.success) {
  console.log(JSON.stringify(data.result, null, 2));
} else {
  console.log('Errors:', JSON.stringify(data.errors, null, 2));
}
