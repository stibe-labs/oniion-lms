# stibe Portal — Deployment Reference

## Servers

| | Detail |
|--|--|
| **Portal URL** | https://stibelearning.online |
| **Portal Server IP** | `62.72.12.213` |
| **Portal SSH alias** | `stibe-portal` |
| **Portal server path** | `/var/www/stibe-portal` |
| **Media Server IP** | `187.127.159.169` (LiveKit, port 7880) |
| **Media Domain** | `media.stibelearning.online` |
| **GitHub Repo** | `git@github.com:Pydart-Intelli-Corp/stibe-portal.git` |

---

## SSH Config (`~/.ssh/config`)

```
Host stibe-portal
    HostName 62.72.12.213
    User root
    IdentityFile ~/.ssh/id_ed25519
```

---

## Deploy Command

Push your commits, then run:

```bash
git add -A && git commit -m "message" && git push origin master && ssh stibe-portal "cd /var/www/stibe-portal && git pull origin master && npm run build 2>&1 | tail -20 && pm2 restart stibe-portal stibe-portal-1 stibe-portal-2 stibe-portal-3"
```

---

## API Keys & Credentials

### LiveKit (Video Classrooms)
```
LIVEKIT_API_KEY=APIrPJx5TK4Uccx
LIVEKIT_API_SECRET=fxVi4KA1d6cDtznc6shtXifNfoceEGaZhd5Ldgb8X8UC
NEXT_PUBLIC_LIVEKIT_URL=wss://stibelearning.online
```

### Database (PostgreSQL — production)
```
DATABASE_URL=postgresql://stibe:1a75487fc3db04a76d2a58bfb2e284ae@localhost:5432/stibe_portal
```

### Redis
```
REDIS_URL=redis://:stibe_redis_8f3a2c9e@localhost:6379
```

### JWT
```
JWT_SECRET=5e7b0d9fad12505af6abc9d08750b65b39767bb9274d85d8c323966423e571f8
```

### Email (Gmail SMTP)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=info.pydart@gmail.com
SMTP_PASS=dsezcjcqecyojywp
```

### Razorpay (Payments — currently test mode)
```
RAZORPAY_KEY_ID=rzp_test_SL5rgjeNn3PrTz
RAZORPAY_KEY_SECRET=aHcOS8tZWoqMr7rw9encW6N9
```

### WhatsApp (Meta Cloud API)
```
WHATSAPP_API_TOKEN=EAASCGoiZCmfsBRHZACoGgvZBv8nrbbK2ZB7FfZCquKyiAnYPIVCYnT9JVZBDgZAsZBWFEy0JjS5fky9hoh4ZCnZC9Di4Yhqu0aX0BGZBbAM12GQ4m6y75yVbRAu2p79CPyw83ohEdZC6tZAcfi3k2DRWTUtD8pZBQ8fhcFNDL9AMoFxNJLOthFAvTZAHFl2GN2ab39ZCtAZDZD
WHATSAPP_PHONE_NUMBER_ID=1012055651991416
WHATSAPP_BUSINESS_ACCOUNT_ID=2348821842224273
```

### Groq (AI Exam Generation)
```
GROQ_API_KEY=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
```
