# ♠ פוקר כסף — Poker Cash Game Manager

אפליקציה לניהול משחקי פוקר מזומן ביתיים.
Mobile-first, RTL עברית, עדכון חי (Realtime).

---

## 🗂️ מבנה הפרויקט

```
poker-app/
├── public/
│   ├── favicon.svg
│   └── manifest.json
├── src/
│   ├── lib/
│   │   ├── supabase.js       ← חיבור Supabase
│   │   ├── adminAuth.jsx     ← ניהול PIN
│   │   └── toast.jsx         ← הודעות
│   ├── utils/
│   │   └── settlement.js     ← אלגוריתם סילוקים P2P
│   ├── screens/
│   │   ├── GamesList.jsx     ← רשימת משחקים + כניסת אדמין
│   │   ├── CreateGame.jsx    ← יצירת משחק
│   │   ├── AdminDashboard.jsx← ניהול חי + buy-ins
│   │   ├── EndGame.jsx       ← הכנסת ג'ים סיום
│   │   ├── Settlements.jsx   ← סילוקים + תשלומים
│   │   ├── ViewerPage.jsx    ← צפייה בלבד (קישור משותף)
│   │   └── History.jsx       ← היסטוריה + סטטיסטיקות
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── supabase-schema.sql       ← SQL לריצה ב-Supabase
├── .env.example
├── .gitignore
├── package.json
└── vite.config.js
```

---

## 🚀 פריסה — שלב אחר שלב

### שלב 1: Supabase

1. לך ל-[supabase.com](https://supabase.com) וצור פרויקט חדש
2. לאחר יצירה, לך ל: **SQL Editor → New Query**
3. הדבק את כל תוכן `supabase-schema.sql` ולחץ **RUN**
4. לך ל-**Project Settings → API** ושמור:
   - `Project URL` → זה ה-`VITE_SUPABASE_URL`
   - `anon public` key → זה ה-`VITE_SUPABASE_ANON_KEY`

### שלב 2: GitHub

1. [צור ריפו חדש](https://github.com/new) בשם `poker-cash-game`
2. העלה את כל תיקיית `poker-app` לריפו
3. **חשוב:** אל תעלה `.env` — הוא ב-`.gitignore`

### שלב 3: Vercel

1. לך ל-[vercel.com](https://vercel.com) → **Add New Project** → Import מ-GitHub
2. Framework Preset: **Vite**
3. תחת **Environment Variables**, הוסף:
   ```
   VITE_SUPABASE_URL     = https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbG...
   ```
4. לחץ **Deploy** 🎉

---

## 🔑 שימוש

| פעולה | איך |
|-------|-----|
| כניסת אדמין | לחץ "אדמין" ← הכנס PIN: **1234** |
| משחק חדש | לחץ "משחק חדש" ← בחר שחקנים |
| Buy-in מהיר | לחץ +20 / +40 / +60 / +100 / +200 |
| שיתוף קישור | לחץ 🔗 בדשבורד |
| סיום משחק | לחץ "סיום" ← הכנס ג'ים |
| רישום תשלום | מסך סילוקים ← "רשום תשלום" |
| סטטיסטיקות | לחץ 📊 בדף הבית |

### שנה את ה-PIN:
פתח `src/lib/adminAuth.jsx` ושנה:
```js
const ADMIN_PIN = '1234' // ← שנה לפה
```

---

## 🧮 אלגוריתם סילוקים

הסילוקים מחושבים P2P (ללא בנק מרכזי):

**דוגמה:**
- שחקן A: +220
- שחקן B: +80  
- שחקן C: -100
- שחקן D: -200

**תוצאה:**
- C → A: ₪100
- D → A: ₪120
- D → B: ₪80

האלגוריתם מייצר מינימום העברות באמצעות גישה חמדנית (greedy).

---

## 🛠️ טכנולוגיות

- **React 18** + **Vite 5**
- **Supabase** — Database + Realtime + Auth
- **React Router 6** — ניווט
- **date-fns** — פורמט תאריכים
- **lucide-react** — אייקונים
- **Heebo** — פונט עברי

---

## 📱 PWA

האפליקציה תומכת בהתקנה כ-PWA:
- ב-iOS: Safari → Share → "Add to Home Screen"
- ב-Android: Chrome → "Install App"
