const crypto = require('crypto');

const PIXEL_ID      = '2013283585928690';   // PayFly Meta Pixel ID
const ACCESS_TOKEN  = 'EAAQRGvuUf0IBRcYuF7IoDq5IFsyH9S23luEt244Pf5a5osd6XxZBezJ7ELTHJfFDsNETieZCFiI50c8M5heNZAXPtkFtab9QQR4QDqJmRKG5vlbxocTkcAY7Gr5owPmSylVFjsoB4b0kqZBk5npGBDZCOe5tlQGYZCAOdG0o7CL3NbZAcaXldZA0iWSe7LftVKfZBSAZDZD'; // PayFly CAPI token
const AMO_TOKEN     = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImZkMzMwMWE4NWVmYWI0ZjQxMjg4NmQwYjNlMmFlMWY3MTI1Y2M5ODcwYjM5NTFlNGNlYmFhMWYwNzNkZDU0MWRjZmNhZjg5YjlhNjBmZGQ1In0.eyJhdWQiOiIyMzQ3YWI0MS0yYzQ0LTRjM2MtODQ4Mi04YTgzOWNkYWM4OGYiLCJqdGkiOiJmZDMzMDFhODVlZmFiNGY0MTI4ODZkMGIzZTJhZTFmNzEyNWNjOTg3MGIzOTUxZTRjZWJhYTFmMDczZGQ1NDFkY2ZjYWY4OWI5YTYwZmRkNSIsImlhdCI6MTc3ODc2NjMyMywibmJmIjoxNzc4NzY2MzIzLCJleHAiOjE5MzY0ODMyMDAsInN1YiI6IjEzNjk5OTk4IiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMyOTk2MzIyLCJiYXNlX2RvbWFpbiI6ImFtb2NybS5ydSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJwdXNoX25vdGlmaWNhdGlvbnMiLCJmaWxlcyIsImNybSIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiNTY4NTkwNTMtODg4NC00NzgyLWEyMGYtOGU3N2EyYzc2YTQyIiwiYXBpX2RvbWFpbiI6ImFwaS1iLmFtb2NybS5ydSJ9.POQZSIVkdNC9SLk5MBvM33_h6Q8iAIf36iNiD-p4Fl6e5tQylmUCDY8UkHsJ3bnGzU9X_zRKIb2J6gJy3GAAZXqOocKd5eGSXLDbJglgUE_IPYTL2puGmkuMv8FYWKKJ3ZW1xwTl7W40EOYFZ3ydbBi7zIsopABPpyGjE2eg0T9M59zj-7KACTYKxhBDir1O-MOPABd27LbnnzfC-hgGQTfrzO2dL5il7s3KcQZ-L6yr4UGcp1h2ba4NxHkwi2QVmBv56W1oocpivl4mu0FXz-6ItOp3ijxr89PUYF8OE76UA_M3UkPgQnIh34_XokxdoMQXAw7SM3_JLogvBH_DwA';
const AMO_SUBDOMAIN   = 'aviarailtrip';
const SOLD_STATUS_ID  = 142;

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
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = req.body;
    console.log('Webhook keldi:', JSON.stringify(body));

    let i = 0;
    while (body[`leads[status][${i}][id]`] !== undefined) {
      const leadId   = body[`leads[status][${i}][id]`];
      const statusId = parseInt(body[`leads[status][${i}][status_id]`]);

      console.log(`Lead ${leadId} → etap ${statusId}`);

      if (statusId === SOLD_STATUS_ID) {
        // amoCRM dan lead + contact ma'lumotlarini olish
        const leadRes = await fetch(
          `https://${AMO_SUBDOMAIN}.amocrm.ru/api/v4/leads/${leadId}?with=contacts`,
          { headers: { 'Authorization': `Bearer ${AMO_TOKEN}` } }
        );
        const leadData = await leadRes.json();

        let phone = '';
        let firstName = '';

        const contacts = leadData?._embedded?.contacts || [];
        if (contacts.length > 0) {
          const contactRes = await fetch(
            `https://${AMO_SUBDOMAIN}.amocrm.ru/api/v4/contacts/${contacts[0].id}`,
            { headers: { 'Authorization': `Bearer ${AMO_TOKEN}` } }
          );
          const contactData = await contactRes.json();
          firstName = (contactData.name || '').split(' ')[0].toLowerCase();
          for (const f of (contactData?.custom_fields_values || [])) {
            if (f.field_code === 'PHONE' && f.values?.[0]?.value) {
              phone = cleanPhone(f.values[0].value); break;
            }
          }
        }

        console.log(`Contact: ${firstName}, ${phone}`);

        if (PIXEL_ID !== '2013283585928690') {
          const userData = { client_user_agent: 'amoCRM' };
          if (phone)     userData.ph = sha256(phone);
          if (firstName) userData.fn = sha256(firstName);

          const capiRes = await fetch(
            `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
            {
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({
                data: [{
                  event_name:       'Purchase',
                  event_time:       Math.floor(Date.now() / 1000),
                  action_source:    'crm',
                  event_source_url: 'https://payfly.vercel.app',
                  event_id:         `sold_${leadId}_${Date.now()}`,
                  user_data:        userData,
                  custom_data:      { value: leadData?.price || 0, currency: 'UZS' }
                }]
              })
            }
          );
          const capiData = await capiRes.json();
          console.log(`Lead ${leadId} — Purchase yuborildi:`, JSON.stringify(capiData));
        }
      }
      i++;
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('sold.js xato:', err);
    return res.status(500).json({ error: err.message });
  }
};
