const token = '3XGGNZGf3p8XIzeDtmw0DTlflIyQkz_-BsL9jCiWUyA.F3LcuQkhOO7T3cLkeX1hvUUcT4-AeDKOV3SdNYOm7DY';
const zoneId = '7842304396d700d0c901480738481b56';

// Add CNAME for apex domain to point to .pages.dev
const dnsRecord = {
  type: 'CNAME',
  name: 'opas.com.pl',
  content: 'opas-com-pl.pages.dev',
  ttl: 1, // Auto
  proxied: false
};

const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(dnsRecord)
});
const data = await res.json();
if (data.success) {
  console.log('DNS record added:', JSON.stringify(data.result, null, 2));
} else {
  console.log('Error adding DNS:', JSON.stringify(data.errors, null, 2));
}
