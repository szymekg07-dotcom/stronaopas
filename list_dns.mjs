const token = '3XGGNZGf3p8XIzeDtmw0DTlflIyQkz_-BsL9jCiWUyA.F3LcuQkhOO7T3cLkeX1hvUUcT4-AeDKOV3SdNYOm7DY';
const zoneId = '7842304396d700d0c901480738481b56';

const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=50`, {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await res.json();
if (data.success) {
  console.log('Existing DNS records:');
  data.result.forEach(r => console.log(`${r.type} ${r.name} -> ${r.content}`));
} else {
  console.log('Error:', JSON.stringify(data.errors));
}
