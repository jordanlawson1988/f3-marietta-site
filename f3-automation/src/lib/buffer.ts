export async function publishToBuffer(caption: string, imageUrl: string): Promise<string> {
  const res = await fetch('https://api.bufferapp.com/1/updates/create.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      access_token: process.env.BUFFER_ACCESS_TOKEN!,
      'profile_ids[]': process.env.BUFFER_PROFILE_ID!,
      text: caption,
      'media[photo]': imageUrl,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Buffer publish failed');
  return data.updates?.[0]?.id ?? '';
}
