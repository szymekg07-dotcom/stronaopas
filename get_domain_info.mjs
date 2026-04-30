const token = '3XGGNZGf3p8XIzeDtmw0DTlflIyQkz_-BsL9jCiWUyA.F3LcuQkhOO7T3cLkeX1hvUUcT4-AeDKOV3SdNYOm7DY';
const accountId = 'd15b3e5688cda8d6b0361798cf66b115';
const projectName = 'opas-com-pl';
const domain = 'opas.com.pl';

const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/domains/${domain}`, {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await res.json();
if (data.success) {
  console.log('Domain verification data:', JSON.stringify(data.result.verification_data, null, 2));
  console.log('DNS records to add:', JSON.stringify(data.result.dns_records, null, 2));
} else {
  console.log('Error:', JSON.stringify(data.errors));
}
