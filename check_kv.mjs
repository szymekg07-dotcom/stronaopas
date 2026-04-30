const token = '9XoH8Q0wpKZWqOEf8fVl69UssUiPfUNJoA2WVliDRGM.lJQWcpq7WQupv7nmCYYjXyc7b5BKI4EoGdQozkcXs2c';
const accountId = 'd15b3e5688cda8d6b0361798cf66b115';
const project = 'stronaopas';

const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}`, {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await res.json();
if (data.success) {
  console.log('Production KV:', JSON.stringify(data.result.deployment_configs.production.kv_namespaces, null, 2));
} else {
  console.log('Error:', JSON.stringify(data.errors));
}
