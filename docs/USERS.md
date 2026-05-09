# stibe Portal — Test User Accounts

**Default Password (all accounts):** `Test@1234`  
**Login URL:** `http://localhost:3000/login` (dev) · `https://stibelearning.online` (prod)  
**Last Updated:** February 21, 2026

---

## All Accounts

| # | Name | Email | Password | Portal Role | Dashboard |
|---|------|-------|----------|-------------|-----------|
| 1 | Admin Owner | `stibelearningventures@gmail.com` | `Test@1234` | `owner` | `/owner` |
| 2 | Seema Verma | `tech.poornasree@gmail.com` | `Test@1234` | `coordinator` | `/coordinator` |
| 3 | Dr. Mehta | `dev.poornasree@gmail.com` | `Test@1234` | `academic_operator` | `/academic-operator` |
| 4 | Ayesha Khan | `info.pydart@gmail.com` | `Test@1234` | `hr` | `/hr` |
| 5 | Priya Sharma | `abcdqrst404@gmail.com` | `Test@1234` | `teacher` | `/teacher` |
| 6 | Rahul Nair | `official.tishnu@gmail.com` | `Test@1234` | `student` | `/student` |
| 7 | Nair P. | `idukki.karan404@gmail.com` | `Test@1234` | `parent` | `/parent` |
| 8 | Nour Observer | `info.pydart@gmail.com` | `Test@1234` | `ghost` | `/ghost` |

---

## By Role

### 👑 Owner
| Name | Email | Password |
|------|-------|----------|
| Admin Owner | `stibelearningventures@gmail.com` | `Test@1234` |

> Full access to all routes and dashboards. Can access every portal role's pages.

---

### 📋 Coordinator
| Name | Email | Password |
|------|-------|----------|
| Seema Verma | `official4tishnu@gmail.com` | `Test@1234` |

> Creates and manages class rooms, assigns students, sends invite emails.

---

### 🎓 Academic Operator
| Name | Email | Password |
|------|-------|----------|
| Dr. Mehta | `dev.poornasree@gmail.com` | `Test@1234` |

> Read-only view of all rooms. Curriculum oversight and class scheduling.

---

### 🧑‍💼 HR Associate
| Name | Email | Password |
|------|-------|----------|
| Ayesha Khan | `tech.poornasree@gmail.com` | `Test@1234` |

> Creates and manages user accounts (teachers, students, parents, coordinators). Issues login credentials.

---

### 👩‍🏫 Teacher
| Name | Email | Password |
|------|-------|----------|
| Priya Sharma | `abcdqrst404@gmail.com` | `Test@1234` |

> Views assigned classes. Joins live rooms as host/presenter.

---

### 🎒 Student
| Name | Email | Password |
|------|-------|----------|
| Rahul Nair | `official.tishnu@gmail.com` | `Test@1234` |

> Views enrolled classes with payment status. Joins live rooms as participant via `/join/[room_id]`.

---

### 👨‍👩‍👦 Parent
| Name | Email | Password |
|------|-------|----------|
| Nair P. | `idukki.karan404@gmail.com` | `Test@1234` |

> Views child's assigned classes. Can observe live rooms.

---

### 👻 Ghost Observer
| Name | Email | Password |
|------|-------|----------|
| Nour Observer | `info.pydart@gmail.com` | `Test@1234` |

> Silent read-only observer. Hidden from participant lists. Access to `/ghost` and `/ghost/monitor`.

---

## Role Permissions Summary

| Capability | Owner | Coordinator | Academic Op | HR | Teacher | Student | Parent | Ghost |
|------------|:-----:|:-----------:|:-----------:|:--:|:-------:|:-------:|:------:|:-----:|
| Access all routes | ✅ | — | — | — | — | — | — | — |
| Create rooms | ✅ | ✅ | — | — | — | — | — | — |
| Manage students in room | ✅ | ✅ | — | — | — | — | — | — |
| Send invite emails | ✅ | ✅ | — | — | — | — | — | — |
| Create user accounts | ✅ | — | — | ✅ | — | — | — | — |
| Issue credentials | ✅ | — | — | ✅ | — | — | — | — |
| View all rooms (read) | ✅ | ✅ | ✅ | — | — | — | — | — |
| Join room as presenter | ✅ | — | — | — | ✅ | — | — | — |
| Join room as student | ✅ | — | — | — | — | ✅ | — | — |
| Observe room (silent) | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ |
| Ghost monitor board | ✅ | — | — | — | — | — | — | ✅ |
| View child's rooms | ✅ | — | — | — | — | — | ✅ | — |

---

## Notes

- **Seeding:** Run `npm run db:seed` from `stibe-portal/` to create all accounts in PostgreSQL.
- **Passwords** are bcrypt-hashed (`rounds=12`) and stored in `portal_users.password_hash`.
- **Adding new users:** Log in as `Ayesha Khan` (HR) and use the HR dashboard to create accounts — a generated password is emailed automatically.
- **Owner bypass:** `stibelearningventures@gmail.com` can log in to any role's dashboard regardless of route restrictions.
- **`academic` role** is a legacy alias — users with this role are redirected to `/academic-operator`.
