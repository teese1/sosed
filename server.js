/* ============================================================
   СоСед — серверная часть (Node.js + Express)
   ------------------------------------------------------------
   • Регистрация пользователей и администраторов
   • Вход по почте и паролю (пароль высылается на e-mail)
   • Управление анкетами (создание, удаление админом)
   • Данные хранятся в JSON-файлах в папке data/ — без установки СУБД
   ============================================================ */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sosed-dev-secret-change-me';
const ADMIN_CODE = process.env.ADMIN_CODE || 'admin2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- «База данных» в JSON-файлах ---------- */
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LISTINGS_FILE = path.join(DATA_DIR, 'listings.json');

const SEED_LISTINGS = [
  {id:1,name:'Анна',age:24,gender:'f',occ:'Дизайнер',city:'Москва',district:'Хамовники',budget:45000,smoking:false,pets:'cat',cleanliness:'high',schedule:'night',guests:'sometimes',noise:'quiet',looking:'flatmate',verified:true,base:91,moveIn:'1 июля',about:'Работаю удалённо дизайнером, люблю порядок и уют. Есть спокойная кошка. Ищу аккуратную соседку, чтобы вместе создавать домашнюю атмосферу.'},
  {id:2,name:'Дмитрий',age:27,gender:'m',occ:'Разработчик',city:'Москва',district:'Басманный',budget:42000,smoking:false,pets:'none',cleanliness:'medium',schedule:'night',guests:'rarely',noise:'quiet',looking:'room',verified:true,base:88,moveIn:'15 июля',about:'Backend-разработчик, часто работаю по вечерам в наушниках. Тихий, не курю, гостей почти не зову. Ищу комнату у спокойных людей.'},
  {id:3,name:'Мария',age:22,gender:'f',occ:'Студентка',city:'Санкт-Петербург',district:'Петроградский',budget:28000,smoking:false,pets:'none',cleanliness:'high',schedule:'early',guests:'rarely',noise:'quiet',looking:'apartment',verified:false,base:90,moveIn:'1 августа',about:'Учусь в магистратуре, рано встаю. Очень чистоплотная, не курю. Хочу снять уютную квартиру вместе со спокойной девушкой.'},
  {id:4,name:'Игорь',age:30,gender:'m',occ:'Менеджер',city:'Москва',district:'Пресненский',budget:60000,smoking:true,pets:'none',cleanliness:'medium',schedule:'flexible',guests:'often',noise:'lively',looking:'flatmate',verified:true,base:74,moveIn:'сейчас',about:'Активный, общительный, люблю когда дома бывают друзья. Курю на балконе. Снимаю двушку в центре, ищу лёгкого на подъём соседа.'},
  {id:5,name:'Елена',age:26,gender:'f',occ:'Маркетолог',city:'Санкт-Петербург',district:'Адмиралтейский',budget:38000,smoking:false,pets:'dog',cleanliness:'high',schedule:'early',guests:'sometimes',noise:'moderate',looking:'flatmate',verified:true,base:86,moveIn:'10 июля',about:'У меня добрый небольшой пёс. Люблю утренние пробежки и чистоту в доме. Ищу соседку, которая любит животных.'},
  {id:6,name:'Артём',age:23,gender:'m',occ:'Студент',city:'Казань',district:'Вахитовский',budget:22000,smoking:false,pets:'none',cleanliness:'relaxed',schedule:'night',guests:'often',noise:'lively',looking:'room',verified:false,base:79,moveIn:'1 сентября',about:'Студент-музыкант, живу активно и шумно по вечерам. Без фанатизма насчёт уборки. Ищу комнату недорого рядом с центром.'},
  {id:7,name:'Ольга',age:29,gender:'f',occ:'Врач',city:'Екатеринбург',district:'Центр',budget:35000,smoking:false,pets:'cat',cleanliness:'high',schedule:'early',guests:'rarely',noise:'quiet',looking:'flatmate',verified:true,base:89,moveIn:'20 июля',about:'Работаю в больнице по сменам, ценю тишину и порядок. Есть ласковый кот. Ищу спокойную соседку, уважающую личное пространство.'},
  {id:8,name:'Павел',age:25,gender:'m',occ:'Фотограф',city:'Москва',district:'Таганский',budget:43000,smoking:true,pets:'none',cleanliness:'medium',schedule:'night',guests:'sometimes',noise:'moderate',looking:'apartment',verified:false,base:78,moveIn:'5 августа',about:'Фотограф, часто в разъездах. Сова, курю. Ищу соседа, чтобы вместе снять светлую квартиру под студию и жильё.'},
  {id:9,name:'София',age:21,gender:'f',occ:'Студентка',city:'Новосибирск',district:'Центральный',budget:20000,smoking:false,pets:'none',cleanliness:'medium',schedule:'flexible',guests:'sometimes',noise:'moderate',looking:'room',verified:false,base:83,moveIn:'25 августа',about:'Первокурсница, приехала учиться. Открытая и дружелюбная, легко нахожу общий язык. Ищу недорогую комнату у приятных людей.'},
  {id:10,name:'Никита',age:28,gender:'m',occ:'Инженер',city:'Санкт-Петербург',district:'Василеостровский',budget:36000,smoking:false,pets:'none',cleanliness:'high',schedule:'early',guests:'rarely',noise:'quiet',looking:'flatmate',verified:true,base:87,moveIn:'12 июля',about:'Инженер-проектировщик, ранний и собранный. Не курю, гостей зову редко. Снимаю чистую двушку, ищу такого же аккуратного соседа.'},
  {id:11,name:'Виктория',age:27,gender:'f',occ:'Юрист',city:'Москва',district:'Замоскворечье',budget:55000,smoking:false,pets:'cat',cleanliness:'high',schedule:'flexible',guests:'rarely',noise:'quiet',looking:'flatmate',verified:true,base:85,moveIn:'1 августа',about:'Юрист, много работаю. Дома люблю тишину и порядок, есть кошка. Ищу ответственную соседку в просторную квартиру в центре.'},
  {id:12,name:'Максим',age:24,gender:'m',occ:'Бариста',city:'Казань',district:'Советский',budget:25000,smoking:false,pets:'dog',cleanliness:'medium',schedule:'night',guests:'often',noise:'lively',looking:'room',verified:false,base:80,moveIn:'сейчас',about:'Работаю в кофейне, по вечерам люблю компанию. Со мной дружелюбный пёс. Ищу комнату у людей, которые любят живую атмосферу.'}
];

function ensureData(){
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive:true});
  if(!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
  if(!fs.existsSync(LISTINGS_FILE)) fs.writeFileSync(LISTINGS_FILE, JSON.stringify(SEED_LISTINGS, null, 2));
}
const readUsers = () => JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
const writeUsers = d => fs.writeFileSync(USERS_FILE, JSON.stringify(d, null, 2));
const readListings = () => JSON.parse(fs.readFileSync(LISTINGS_FILE, 'utf8'));
const writeListings = d => fs.writeFileSync(LISTINGS_FILE, JSON.stringify(d, null, 2));
ensureData();

/* ---------- Отправка почты ---------- */
let transporter = null;
if(process.env.SMTP_USER && process.env.SMTP_PASS){
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  console.log('📧 Почта настроена: ' + process.env.SMTP_USER);
} else {
  console.log('📭 Почта НЕ настроена — пароли будут выводиться в консоль и на экран.');
}

async function sendPasswordEmail(to, name, password){
  if(!transporter) return false;
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Ваш пароль для входа в СоСед',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:12px">
        <h2 style="color:#EE5230;margin:0 0 16px">🏠 СоСед</h2>
        <p>Здравствуйте, <b>${name}</b>!</p>
        <p>Вы зарегистрировались в сервисе поиска соседей <b>СоСед</b>. Ваш пароль для входа:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:3px;background:#FBF6EE;padding:16px;border-radius:10px;text-align:center;margin:18px 0">${password}</p>
        <p>Войдите, используя вашу электронную почту и этот пароль. Никому не сообщайте его.</p>
        <p style="color:#999;font-size:13px;margin-top:24px">Это автоматическое письмо, отвечать на него не нужно.</p>
      </div>`
  });
  return true;
}

/* ---------- Утилиты ---------- */
function genPassword(len = 10){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(len);
  let p = '';
  for(let i = 0; i < len; i++) p += chars[bytes[i] % chars.length];
  return p;
}
const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt });

function auth(req, res, next){
  const h = req.headers.authorization || '';
  const tk = h.startsWith('Bearer ') ? h.slice(7) : null;
  if(!tk) return res.status(401).json({ error: 'Требуется вход в аккаунт' });
  try { req.user = jwt.verify(tk, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Сессия истекла, войдите снова' }); }
}
function adminOnly(req, res, next){
  if(!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ только для администратора' });
  next();
}

/* ============ МАРШРУТЫ: АВТОРИЗАЦИЯ ============ */

// Регистрация (пароль генерируется и отправляется на почту)
app.post('/api/register', async (req, res) => {
  try {
    let { name, email, role, adminCode } = req.body || {};
    name = (name || '').trim();
    email = (email || '').trim().toLowerCase();
    role = role === 'admin' ? 'admin' : 'user';

    if(!name || !isEmail(email)) return res.status(400).json({ error: 'Укажите имя и корректную почту' });
    if(role === 'admin' && adminCode !== ADMIN_CODE) return res.status(403).json({ error: 'Неверный код администратора' });

    const users = readUsers();
    if(users.find(u => u.email === email)) return res.status(409).json({ error: 'Эта почта уже зарегистрирована' });

    const password = genPassword();
    const user = {
      id: crypto.randomUUID(),
      name, email, role,
      passwordHash: bcrypt.hashSync(password, 10),
      createdAt: new Date().toISOString()
    };
    users.push(user);
    writeUsers(users);

    let emailSent = false;
    try { emailSent = await sendPasswordEmail(email, name, password); }
    catch(e){ console.error('Ошибка отправки письма:', e.message); }
    if(!emailSent) console.log(`\n🔑 Пароль для ${email}: ${password}\n`);

    res.json({
      ok: true,
      emailSent,
      role,
      message: emailSent ? 'Пароль отправлен на почту' : 'Почта не настроена — пароль показан на экране',
      devPassword: emailSent ? undefined : password
    });
  } catch(e){ console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Вход
app.post('/api/login', (req, res) => {
  let { email, password } = req.body || {};
  email = (email || '').trim().toLowerCase();
  const users = readUsers();
  const user = users.find(u => u.email === email);
  if(!user || !bcrypt.compareSync(password || '', user.passwordHash)){
    return res.status(401).json({ error: 'Неверная почта или пароль' });
  }
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: publicUser(user) });
});

// Текущий пользователь
app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));

/* ============ МАРШРУТЫ: АНКЕТЫ ============ */

// Все анкеты (публично)
app.get('/api/listings', (req, res) => res.json(readListings()));

// Создать анкету (нужен вход)
app.post('/api/listings', auth, (req, res) => {
  const b = req.body || {};
  if(!b.name || !b.age || !b.city || !b.budget) return res.status(400).json({ error: 'Заполните имя, возраст, город и бюджет' });
  const listings = readListings();
  const listing = {
    id: Date.now(),
    name: String(b.name).trim(),
    age: Number(b.age),
    gender: b.gender === 'f' ? 'f' : 'm',
    occ: b.occ || 'Пользователь',
    city: b.city,
    district: (b.district || 'Центр').trim() || 'Центр',
    budget: Number(b.budget),
    smoking: !!b.smoking,
    pets: b.pets || 'none',
    cleanliness: b.cleanliness || 'medium',
    schedule: b.schedule || 'flexible',
    guests: b.guests || 'sometimes',
    noise: b.noise || 'moderate',
    looking: b.looking || 'flatmate',
    verified: false,
    base: 82,
    moveIn: b.moveIn || 'сейчас',
    about: (b.about || '').trim() || 'Анкета создана пользователем.',
    ownerId: req.user.id,
    ownerEmail: req.user.email
  };
  listings.unshift(listing);
  writeListings(listings);
  res.json({ ok: true, listing });
});

// Удалить анкету (только админ)
app.delete('/api/listings/:id', auth, adminOnly, (req, res) => {
  const listings = readListings();
  const next = listings.filter(l => String(l.id) !== String(req.params.id));
  if(next.length === listings.length) return res.status(404).json({ error: 'Анкета не найдена' });
  writeListings(next);
  res.json({ ok: true });
});

/* ============ МАРШРУТЫ: ПОЛЬЗОВАТЕЛИ (админ) ============ */

app.get('/api/users', auth, adminOnly, (req, res) => res.json(readUsers().map(publicUser)));

app.delete('/api/users/:id', auth, adminOnly, (req, res) => {
  if(req.params.id === req.user.id) return res.status(400).json({ error: 'Нельзя удалить собственный аккаунт' });
  const users = readUsers();
  const next = users.filter(u => u.id !== req.params.id);
  if(next.length === users.length) return res.status(404).json({ error: 'Пользователь не найден' });
  writeUsers(next);
  res.json({ ok: true });
});

/* ---------- Запуск ---------- */
app.listen(PORT, () => {
  console.log(`\n🏠 СоСед запущен!`);
  console.log(`   Локально:        http://localhost:${PORT}`);
  console.log(`   Код админа:      ${ADMIN_CODE}`);
  console.log(`   (изменить можно в файле .env)\n`);
});
