# ربط `healthcare.com` بـ Windows VPS (خطوة بخطوة)

هذا الدليل يربط مشروعك على:
- `https://healthcare.com`
- `https://www.healthcare.com`

ويحل مشكلة الميكروفون/الإملاء الصوتي في المتصفح (لأنها تحتاج HTTPS).

---

## 1) إعداد DNS في Hostinger

من لوحة Hostinger (`DNS Zone`) للدومين `healthcare.com`:

1. أضف سجل `A`:
   - `Host`: `@`
   - `Points to`: `95.216.63.81`
2. أضف سجل `CNAME`:
   - `Host`: `www`
   - `Target`: `healthcare.com`
3. احذف أي سجلات قديمة لنفس `@` أو `www` تشير لسيرفر آخر.

ملاحظة: انتشار DNS قد يأخذ من دقائق إلى 24 ساعة.

---

## 2) تجهيز التطبيق على VPS (PM2)

تأكد أن التطبيق يعمل داخليًا:
- Frontend: `127.0.0.1:3001`
- Backend: `127.0.0.1:5000`

من مسار المشروع:

```bat
cd C:\inetpub\wwwroot\HealthcareCRM
git pull --ff-only origin main
npm install
npm run build
pm2 restart all
pm2 save
```

---

## 3) الأفضل على Windows: استخدام Caddy كـ Reverse Proxy + SSL تلقائي

### 3.1 تحميل Caddy

1. حمّل Caddy (Windows amd64) من الموقع الرسمي.
2. فك الضغط في:
   - `C:\caddy\`

### 3.2 إنشاء ملف الإعداد

أنشئ ملف:
- `C:\caddy\Caddyfile`

وضع فيه:

```caddy
healthcare.com, www.healthcare.com {
    encode gzip zstd

    reverse_proxy /api/* 127.0.0.1:5000
    reverse_proxy /uploads/* 127.0.0.1:5000
    reverse_proxy 127.0.0.1:3001
}
```

### 3.3 فتح البورتات في Windows Firewall

افتح PowerShell كـ Administrator ثم:

```powershell
netsh advfirewall firewall add rule name="HTTP 80" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="HTTPS 443" dir=in action=allow protocol=TCP localport=443
```

### 3.4 تشغيل Caddy (اختبار أولي)

```bat
cd C:\caddy
caddy run --config Caddyfile
```

إذا كل شيء صحيح، Caddy سيصدر شهادة SSL تلقائيًا.

---

## 4) تعديل متغيرات البيئة

## Frontend

في ملف البيئة الخاص بالـ frontend:

```env
NEXT_PUBLIC_API_URL=/api
```

## Backend

في ملف البيئة الخاص بالـ backend:

```env
CORS_ORIGIN=https://healthcare.com,https://www.healthcare.com
```

ثم:

```bat
cd C:\inetpub\wwwroot\HealthcareCRM
npm run build
pm2 restart all
pm2 save
```

---

## 5) اختبار نهائي

افتح:
- `https://healthcare.com`
- `https://www.healthcare.com`

ثم في DevTools Console:

```js
window.isSecureContext
```

لازم تكون `true`.

إذا كانت `true`، فميزة الميكروفون والإملاء الصوتي تعمل طبيعي.

---

## 6) حل مشاكل شائعة

## DNS لا يعمل
- انتظر قليلًا (قد يتأخر الانتشار).
- تأكد أن `@` و`www` يشيران لنفس الـ IP الصحيح.

## SSL لم يصدر
- تأكد أن البورت `80` و`443` مفتوحين.
- تأكد أن الدومين يشير للسيرفر قبل تشغيل Caddy.

## 403 أو Not Allowed
- تأكد من صلاحيات المستخدم (Role/Permissions) داخل النظام.
- تأكد من `CORS_ORIGIN` الصحيح وإعادة تشغيل backend.

## ChunkLoadError أو ERR_CONTENT_DECODING_FAILED
- امسح كاش المتصفح (`Ctrl + F5`).
- أعد build ونشر نسخة frontend نظيفة.

---

## 7) (اختياري) تشغيل Caddy كخدمة Windows

بعد التأكد أنه يعمل بـ `caddy run`، ثبته كخدمة (Service) باستخدام NSSM أو Task Scheduler
حتى يعمل تلقائيًا بعد أي إعادة تشغيل للسيرفر.

