const crypto = require('crypto');

const PIXEL_ID     = '2013283585928690'; // PayFly Meta Pixel ID ni kiriting
const ACCESS_TOKEN = 'EAAQRGvuUf0IBRcYuF7IoDq5IFsyH9S23luEt244Pf5a5osd6XxZBezJ7ELTHJfFDsNETieZCFiI50c8M5heNZAXPtkFtab9QQR4QDqJmRKG5vlbxocTkcAY7Gr5owPmSylVFjsoB4b0kqZBk5npGBDZCOe5tlQGYZCAOdG0o7CL3NbZAcaXldZA0iWSe7LftVKfZBSAZDZD'; // PayFly CAPI token ni kiriting

const AMO_TOKEN     = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImZkMzMwMWE4NWVmYWI0ZjQxMjg4NmQwYjNlMmFlMWY3MTI1Y2M5ODcwYjM5NTFlNGNlYmFhMWYwNzNkZDU0MWRjZmNhZjg5YjlhNjBmZGQ1In0.eyJhdWQiOiIyMzQ3YWI0MS0yYzQ0LTRjM2MtODQ4Mi04YTgzOWNkYWM4OGYiLCJqdGkiOiJmZDMzMDFhODVlZmFiNGY0MTI4ODZkMGIzZTJhZTFmNzEyNWNjOTg3MGIzOTUxZTRjZWJhYTFmMDczZGQ1NDFkY2ZjYWY4OWI5YTYwZmRkNSIsImlhdCI6MTc3ODc2NjMyMywibmJmIjoxNzc4NzY2MzIzLCJleHAiOjE5MzY0ODMyMDAsInN1YiI6IjEzNjk5OTk4IiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMyOTk2MzIyLCJiYXNlX2RvbWFpbiI6ImFtb2NybS5ydSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJwdXNoX25vdGlmaWNhdGlvbnMiLCJmaWxlcyIsImNybSIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiNTY4NTkwNTMtODg4NC00NzgyLWEyMGYtOGU3N2EyYzc2YTQyIiwiYXBpX2RvbWFpbiI6ImFwaS1iLmFtb2NybS5ydSJ9.POQZSIVkdNC9SLk5MBvM33_h6Q8iAIf36iNiD-p4Fl6e5tQylmUCDY8UkHsJ3bnGzU9X_zRKIb2J6gJy3GAAZXqOocKd5eGSXLDbJglgUE_IPYTL2puGmkuMv8FYWKKJ3ZW1xwTl7W40EOYFZ3ydbBi7zIsopABPpyGjE2eg0T9M59zj-7KACTYKxhBDir1O-MOPABd27LbnnzfC-hgGQTfrzO2dL5il7s3KcQZ-L6yr4UGcp1h2ba4NxHkwi2QVmBv56W1oocpivl4mu0FXz-6ItOp3ijxr89PUYF8OE76UA_M3UkPgQnIh34_XokxdoMQXAw7SM3_JLogvBH_DwA';
const AMO_SUBDOMAIN = 'aviarailtrip';
const AMO_PIPELINE  = 10786990;
const AMO_STAGE     = 84929506;

// Contact custom field IDs
const FIELD_GROUP   = 1366705; // Kim bilan sayohat
const FIELD_TIME    = 1366699; // Telefon qilish vaqti
const FIELD_PHONE2  = 1366703; // Qo'shimcha raqam

function sha256(val) {
  return crypto.createHash('sha256').update((val||'').trim().toLowerCase()).digest('hex');
}
function cleanPhone(phone) {
  let c = (phone||'').replace(/\D/g,'');
  if (c.startsWith('998')) return '+' + c;
  if (c.length === 9) return '+998' + c;
  return '+' + c;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, phone, phone2, time, group, dest, city, eventId, userAgent, sourceUrl } = req.body;

    if (!phone || !name) return res.status(400).json({ error: 'name va phone majburiy' });

    const cleanedPhone = cleanPhone(phone);
    const firstName    = (name||'').trim().split(' ')[0].toLowerCase();

    // 1. Meta CAPI
    {
      const capiPayload = {
        data: [{
          event_name:       'Lead',
          event_time:       Math.floor(Date.now() / 1000),
          action_source:    'website',
          event_source_url: sourceUrl || 'https://payfly.vercel.app',
          event_id:         eventId || `lead_${Date.now()}`,
          user_data: {
            ph: sha256(cleanedPhone),
            fn: sha256(firstName),
            client_user_agent: userAgent || 'unknown',
          },
        }],
      };
      const capiRes = await fetch(
        `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
        { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(capiPayload) }
      );
      const capiData = await capiRes.json();
      console.log('CAPI Lead:', capiData);
    

    // 2. amoCRM — lead yaratish
    const amoPayload = [{
      name: `${name} — ${dest || 'Tur paket'}`,
      pipeline_id: AMO_PIPELINE,
      status_id:   AMO_STAGE,
      tags: [{ name: 'CAPI' }],
      _embedded: {
        contacts: [{
          name: name,
          custom_fields_values: [
            { field_code: 'PHONE', values: [{ value: cleanedPhone, enum_code: 'WORK' }] },
            ...(phone2 ? [{ field_id: FIELD_PHONE2, values: [{ value: cleanPhone(phone2) }] }] : []),
            ...(time    ? [{ field_id: FIELD_TIME,   values: [{ value: time }] }] : []),
            ...(group   ? [{ field_id: FIELD_GROUP,  values: [{ value: group }] }] : []),
          ]
        }]
      }
    }];

    const amoRes = await fetch(
      `https://${AMO_SUBDOMAIN}.amocrm.ru/api/v4/leads/complex`,
      { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${AMO_TOKEN}`}, body:JSON.stringify(amoPayload) }
    );
    const amoData = await amoRes.json();
    console.log('amoCRM lead:', JSON.stringify(amoData));

    // 3. Tag qo'shish
    if (amoData && amoData[0] && amoData[0].id) {
      await fetch(`https://${AMO_SUBDOMAIN}.amocrm.ru/api/v4/leads`, {
        method:'PATCH',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${AMO_TOKEN}`},
        body: JSON.stringify([{ id: amoData[0].id, _embedded: { tags: [{ name: 'CAPI' }] } }])
      });
    }

    return res.status(200).json({ success: true, amo: amoData });

  } catch (err) {
    console.error('Xato:', err);
    return res.status(500).json({ error: err.message });
  }
};
