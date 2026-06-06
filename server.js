require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const mysql   = require('mysql2/promise');

const app        = express();
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sosed-dev-secret-change-me';
const ADMIN_CODE = process.env.ADMIN_CODE || 'admin2026';

app.use(cors());
app.use(express.json());
app.use((req,res,next)=>{ res.set('Cache-Control', req.path.startsWith('/api/')?'no-store':'no-cache'); next(); });
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- Подключение к MySQL ----------
   На Railway добавьте переменную DATABASE_URL = ${{ MySQL.MYSQL_URL }}.
   Локально — используются переменные DB_* из .env (по умолчанию localhost). */
const pool = mysql.createPool(
  (process.env.DATABASE_URL || process.env.MYSQL_URL)
    ? (process.env.DATABASE_URL || process.env.MYSQL_URL)
    : {
        host:     process.env.DB_HOST     || process.env.MYSQLHOST     || 'localhost',
        port:     process.env.DB_PORT     || process.env.MYSQLPORT     || 3306,
        user:     process.env.DB_USER     || process.env.MYSQLUSER     || 'root',
        password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
        database: process.env.DB_NAME     || process.env.MYSQLDATABASE || 'sosed',
        waitForConnections: true,
        connectionLimit: 10
      }
);

/* ---------- Сид-данные ---------- */
const SEED_USERS = [
  {id:'u01',name:'Анна',    email:'anna@sosed.ru',     password:'anna2024',     role:'user'},
  {id:'u02',name:'Дмитрий', email:'dmitry@sosed.ru',   password:'dmitry2024',   role:'user'},
  {id:'u03',name:'Мария',   email:'maria@sosed.ru',    password:'maria2024',    role:'user'},
  {id:'u04',name:'Игорь',   email:'igor@sosed.ru',     password:'igor2024',     role:'user'},
  {id:'u05',name:'Елена',   email:'elena@sosed.ru',    password:'elena2024',    role:'user'},
  {id:'u06',name:'Артём',   email:'artem@sosed.ru',    password:'artem2024',    role:'user'},
  {id:'u07',name:'Ольга',   email:'olga@sosed.ru',     password:'olga2024',     role:'user'},
  {id:'u08',name:'Павел',   email:'pavel@sosed.ru',    password:'pavel2024',    role:'user'},
  {id:'u09',name:'София',   email:'sofia@sosed.ru',    password:'sofia2024',    role:'user'},
  {id:'u10',name:'Никита',  email:'nikita@sosed.ru',   password:'nikita2024',   role:'user'},
  {id:'u11',name:'Виктория',email:'viktoria@sosed.ru', password:'viktoria2024', role:'user'},
  {id:'u12',name:'Максим',  email:'maksim@sosed.ru',   password:'maksim2024',   role:'user'},
  {id:'u13',name:'Дарья',   email:'darya@sosed.ru',    password:'darya2024',    role:'user'},
  {id:'u14',name:'Роман',   email:'roman@sosed.ru',    password:'roman2024',    role:'user'},
  {id:'u15',name:'Алина',   email:'alina@sosed.ru',    password:'alina2024',    role:'user'},
  {id:'u16',name:'Сергей',  email:'sergey@sosed.ru',   password:'sergey2024',   role:'user'},
  {id:'u17',name:'Карина',  email:'karina@sosed.ru',   password:'karina2024',   role:'user'},
  {id:'u18',name:'Владимир',email:'vladimir@sosed.ru', password:'vladimir2024', role:'user'},
  {id:'u19',name:'Полина',  email:'polina@sosed.ru',   password:'polina2024',   role:'user'},
  {id:'u20',name:'Денис',   email:'denis@sosed.ru',    password:'denis2024',    role:'user'}
];

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
  {id:12,name:'Максим',age:24,gender:'m',occ:'Бариста',city:'Казань',district:'Советский',budget:25000,smoking:false,pets:'dog',cleanliness:'medium',schedule:'night',guests:'often',noise:'lively',looking:'room',verified:false,base:80,moveIn:'сейчас',about:'Работаю в кофейне, по вечерам люблю компанию. Со мной дружелюбный пёс. Ищу комнату у людей, которые любят живую атмосферу.'},
  {id:13,name:'Дарья',age:25,gender:'f',occ:'Копирайтер',city:'Нижний Новгород',district:'Нижегородский',budget:30000,smoking:false,pets:'cat',cleanliness:'high',schedule:'flexible',guests:'sometimes',noise:'quiet',looking:'flatmate',verified:true,base:84,moveIn:'1 августа',about:'Пишу тексты на удалёнке, ценю спокойную обстановку. Есть кошка. Ищу дружелюбную соседку, с которой будет комфортно.'},
  {id:14,name:'Роман',age:29,gender:'m',occ:'Логист',city:'Краснодар',district:'Центральный',budget:32000,smoking:false,pets:'none',cleanliness:'medium',schedule:'early',guests:'rarely',noise:'quiet',looking:'room',verified:false,base:80,moveIn:'сейчас',about:'Работаю в логистике, рано встаю. Аккуратный, спокойный, не курю. Ищу комнату в тихом районе.'},
  {id:15,name:'Алина',age:23,gender:'f',occ:'Бариста',city:'Сочи',district:'Центральный',budget:28000,smoking:false,pets:'none',cleanliness:'medium',schedule:'flexible',guests:'sometimes',noise:'moderate',looking:'flatmate',verified:false,base:82,moveIn:'15 августа',about:'Переехала к морю, работаю в кофейне. Лёгкая на подъём и общительная. Ищу соседку, чтобы снять квартиру у побережья.'},
  {id:16,name:'Сергей',age:31,gender:'m',occ:'Прораб',city:'Самара',district:'Ленинский',budget:27000,smoking:true,pets:'none',cleanliness:'medium',schedule:'early',guests:'rarely',noise:'quiet',looking:'room',verified:true,base:77,moveIn:'1 сентября',about:'Работаю на стройке, встаю рано. Курю на улице. Спокойный, надёжный. Ищу недорогую комнату.'},
  {id:17,name:'Карина',age:26,gender:'f',occ:'HR-менеджер',city:'Ростов-на-Дону',district:'Кировский',budget:29000,smoking:false,pets:'dog',cleanliness:'high',schedule:'early',guests:'sometimes',noise:'moderate',looking:'flatmate',verified:true,base:85,moveIn:'10 августа',about:'Работаю в HR, люблю порядок и активный отдых. Есть небольшая собака. Ищу соседку, которая ладит с животными.'},
  {id:18,name:'Владимир',age:28,gender:'m',occ:'Преподаватель',city:'Воронеж',district:'Центральный',budget:24000,smoking:false,pets:'none',cleanliness:'high',schedule:'early',guests:'rarely',noise:'quiet',looking:'room',verified:false,base:83,moveIn:'25 августа',about:'Преподаю в университете, ценю тишину для подготовки к занятиям. Не курю, аккуратный. Ищу спокойную комнату.'},
  {id:19,name:'Полина',age:22,gender:'f',occ:'Студентка',city:'Уфа',district:'Кировский',budget:19000,smoking:false,pets:'none',cleanliness:'medium',schedule:'night',guests:'often',noise:'lively',looking:'room',verified:false,base:81,moveIn:'1 сентября',about:'Студентка, активная и дружелюбная. Люблю компанию и вечерние посиделки. Ищу недорогую комнату рядом с вузом.'},
  {id:20,name:'Денис',age:30,gender:'m',occ:'IT-специалист',city:'Владивосток',district:'Ленинский',budget:38000,smoking:false,pets:'cat',cleanliness:'high',schedule:'night',guests:'rarely',noise:'quiet',looking:'flatmate',verified:true,base:88,moveIn:'12 августа',about:'Работаю в IT на удалёнке, сова. Есть кот. Тихий и чистоплотный. Ищу аккуратного соседа в просторную квартиру.'}
];

/* ---------- Создание таблиц и наполнение ---------- */
async function initDb(){
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    password VARCHAR(255),
    passwordHash VARCHAR(255) NOT NULL,
    createdAt DATETIME NOT NULL
  ) CHARACTER SET utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS listings (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255), age INT, gender VARCHAR(5), occ VARCHAR(255),
    city VARCHAR(255), district VARCHAR(255), budget INT,
    smoking TINYINT(1), pets VARCHAR(20), cleanliness VARCHAR(20),
    schedule VARCHAR(20), guests VARCHAR(20), noise VARCHAR(20),
    looking VARCHAR(20), verified TINYINT(1), base INT,
    moveIn VARCHAR(255), about TEXT,
    ownerId VARCHAR(64), ownerEmail VARCHAR(255)
  ) CHARACTER SET utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS contacts (
    id VARCHAR(64) PRIMARY KEY,
    fromUserId VARCHAR(64), fromUserName VARCHAR(255),
    toUserId VARCHAR(64), listingId VARCHAR(64),
    listingName VARCHAR(255), listingCity VARCHAR(255),
    status VARCHAR(20), contactInfo VARCHAR(500),
    requesterSeen TINYINT(1) DEFAULT 0,
    createdAt DATETIME, sharedAt DATETIME NULL
  ) CHARACTER SET utf8mb4`);

  // Наполняем пользователями, если таблица пуста
  const [[uc]] = await pool.query('SELECT COUNT(*) AS c FROM users');
  if(uc.c === 0){
    for(const u of SEED_USERS){
      await pool.query(
        'INSERT INTO users (id,name,email,role,password,passwordHash,createdAt) VALUES (?,?,?,?,?,?,NOW())',
        [u.id,u.name,u.email,u.role,u.password,bcrypt.hashSync(u.password,10)]
      );
    }
    console.log('🌱 Добавлено пользователей:', SEED_USERS.length);
  }

  // Наполняем анкетами, если таблица пуста
  const [[lc]] = await pool.query('SELECT COUNT(*) AS c FROM listings');
  if(lc.c === 0){
    for(const l of SEED_LISTINGS){
      const owner = SEED_USERS.find(s=>s.name===l.name);
      await pool.query(
        `INSERT INTO listings (id,name,age,gender,occ,city,district,budget,smoking,pets,cleanliness,schedule,guests,noise,looking,verified,base,moveIn,about,ownerId,ownerEmail)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [l.id,l.name,l.age,l.gender,l.occ,l.city,l.district,l.budget,l.smoking?1:0,l.pets,l.cleanliness,l.schedule,l.guests,l.noise,l.looking,l.verified?1:0,l.base,l.moveIn,l.about, owner?owner.id:null, owner?owner.email:null]
      );
    }
    console.log('🌱 Добавлено анкет:', SEED_LISTINGS.length);
  }
}

/* ---------- Утилиты ---------- */
const isEmail = e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const publicUser = u=>({id:u.id,name:u.name,email:u.email,role:u.role,createdAt:u.createdAt});
const normListing = r=>({...r, smoking:!!r.smoking, verified:!!r.verified});
const normContact = r=>({...r, requesterSeen:!!r.requesterSeen});

function auth(req,res,next){
  const h=req.headers.authorization||'';
  const tk=h.startsWith('Bearer ')?h.slice(7):null;
  if(!tk) return res.status(401).json({error:'Требуется вход в аккаунт'});
  try{req.user=jwt.verify(tk,JWT_SECRET);next();}
  catch{return res.status(401).json({error:'Сессия истекла, войдите снова'});}
}
function adminOnly(req,res,next){
  if(!req.user||req.user.role!=='admin') return res.status(403).json({error:'Доступ только для администратора'});
  next();
}

/* ============ АВТОРИЗАЦИЯ ============ */
app.post('/api/register', async (req,res)=>{
  try{
    let{name,email,password,role,adminCode}=req.body||{};
    name=(name||'').trim(); email=(email||'').trim().toLowerCase(); role=role==='admin'?'admin':'user';
    if(!name||!isEmail(email)) return res.status(400).json({error:'Укажите имя и корректную почту'});
    if(!password||password.length<6) return res.status(400).json({error:'Пароль должен быть не менее 6 символов'});
    if(role==='admin'&&adminCode!==ADMIN_CODE) return res.status(403).json({error:'Неверный код администратора'});
    const [ex] = await pool.query('SELECT id FROM users WHERE email=?',[email]);
    if(ex.length) return res.status(409).json({error:'Эта почта уже зарегистрирована'});
    const id=crypto.randomUUID();
    await pool.query('INSERT INTO users (id,name,email,role,password,passwordHash,createdAt) VALUES (?,?,?,?,?,?,NOW())',
      [id,name,email,role,password,bcrypt.hashSync(password,10)]);
    res.json({ok:true,role,message:'Регистрация успешна'});
  }catch(e){console.error(e);res.status(500).json({error:'Ошибка сервера'});}
});

app.post('/api/login', async (req,res)=>{
  try{
    let{email,password}=req.body||{};
    email=(email||'').trim().toLowerCase();
    const [rows] = await pool.query('SELECT * FROM users WHERE email=?',[email]);
    const user=rows[0];
    if(!user||!bcrypt.compareSync(password||'',user.passwordHash))
      return res.status(401).json({error:'Неверная почта или пароль'});
    const token=jwt.sign({id:user.id,name:user.name,email:user.email,role:user.role},JWT_SECRET,{expiresIn:'7d'});
    res.json({token,user:publicUser(user)});
  }catch(e){console.error(e);res.status(500).json({error:'Ошибка сервера'});}
});

app.get('/api/me',auth,(req,res)=>res.json({user:req.user}));

/* ============ СТАТИСТИКА ============ */
app.get('/api/stats', async (req,res)=>{
  try{
    const [[a]] = await pool.query('SELECT COUNT(*) AS listings FROM listings');
    const [[b]] = await pool.query('SELECT COUNT(DISTINCT city) AS cities FROM listings');
    const [[c]] = await pool.query("SELECT COUNT(*) AS matches FROM contacts WHERE status='shared'");
    res.json({listings:a.listings, cities:b.cities, matches:c.matches});
  }catch(e){res.status(500).json({error:'Ошибка сервера'});}
});

/* ============ АНКЕТЫ ============ */
app.get('/api/listings', async (req,res)=>{
  try{
    const [rows] = await pool.query('SELECT * FROM listings ORDER BY id DESC');
    res.json(rows.map(normListing));
  }catch(e){res.status(500).json({error:'Ошибка сервера'});}
});

app.post('/api/listings', auth, async (req,res)=>{
  try{
    const b=req.body||{};
    if(!b.name||!b.age||!b.city||!b.budget) return res.status(400).json({error:'Заполните имя, возраст, город и бюджет'});
    const listing={
      id:Date.now(), name:String(b.name).trim(), age:Number(b.age),
      gender:b.gender==='f'?'f':'m', occ:b.occ||'Пользователь',
      city:b.city, district:(b.district||'Центр').trim()||'Центр', budget:Number(b.budget),
      smoking:!!b.smoking, pets:b.pets||'none', cleanliness:b.cleanliness||'medium',
      schedule:b.schedule||'flexible', guests:b.guests||'sometimes', noise:b.noise||'moderate',
      looking:b.looking||'flatmate', verified:false, base:82,
      moveIn:b.moveIn||'сейчас', about:(b.about||'').trim()||'Анкета создана пользователем.',
      ownerId:req.user.id, ownerEmail:req.user.email
    };
    await pool.query(
      `INSERT INTO listings (id,name,age,gender,occ,city,district,budget,smoking,pets,cleanliness,schedule,guests,noise,looking,verified,base,moveIn,about,ownerId,ownerEmail)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [listing.id,listing.name,listing.age,listing.gender,listing.occ,listing.city,listing.district,listing.budget,listing.smoking?1:0,listing.pets,listing.cleanliness,listing.schedule,listing.guests,listing.noise,listing.looking,0,listing.base,listing.moveIn,listing.about,listing.ownerId,listing.ownerEmail]
    );
    res.json({ok:true,listing});
  }catch(e){console.error(e);res.status(500).json({error:'Ошибка сервера'});}
});

app.delete('/api/listings/:id', auth, adminOnly, async (req,res)=>{
  try{
    const [r] = await pool.query('DELETE FROM listings WHERE id=?',[req.params.id]);
    if(r.affectedRows===0) return res.status(404).json({error:'Анкета не найдена'});
    res.json({ok:true});
  }catch(e){res.status(500).json({error:'Ошибка сервера'});}
});

/* ============ ПОЛЬЗОВАТЕЛИ (админ) ============ */
app.get('/api/users', auth, adminOnly, async (req,res)=>{
  try{
    const [rows] = await pool.query('SELECT id,name,email,role,password,createdAt FROM users ORDER BY createdAt');
    res.json(rows.map(u=>({...u, password:u.password||'—'})));
  }catch(e){res.status(500).json({error:'Ошибка сервера'});}
});

app.delete('/api/users/:id', auth, adminOnly, async (req,res)=>{
  try{
    if(req.params.id===req.user.id) return res.status(400).json({error:'Нельзя удалить собственный аккаунт'});
    const [r] = await pool.query('DELETE FROM users WHERE id=?',[req.params.id]);
    if(r.affectedRows===0) return res.status(404).json({error:'Пользователь не найден'});
    res.json({ok:true});
  }catch(e){res.status(500).json({error:'Ошибка сервера'});}
});

/* ============ ЗАПРОСЫ КОНТАКТОВ ============ */
app.post('/api/contacts/request', auth, async (req,res)=>{
  try{
    const{listingId}=req.body||{};
    const [lr] = await pool.query('SELECT * FROM listings WHERE id=?',[listingId]);
    const listing=lr[0];
    if(!listing) return res.status(404).json({error:'Анкета не найдена'});
    if(!listing.ownerId) return res.status(400).json({error:'У этой анкеты нет владельца'});
    if(listing.ownerId===req.user.id) return res.status(400).json({error:'Это ваша собственная анкета'});
    const [ex] = await pool.query('SELECT * FROM contacts WHERE fromUserId=? AND listingId=?',[req.user.id,String(listing.id)]);
    if(ex.length) return res.json({ok:true,request:normContact(ex[0]),alreadyExists:true});
    const id=crypto.randomUUID();
    await pool.query(
      `INSERT INTO contacts (id,fromUserId,fromUserName,toUserId,listingId,listingName,listingCity,status,contactInfo,requesterSeen,createdAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,NOW())`,
      [id,req.user.id,req.user.name,listing.ownerId,String(listing.id),listing.name,listing.city,'pending',null,0]
    );
    const [nr] = await pool.query('SELECT * FROM contacts WHERE id=?',[id]);
    res.json({ok:true,request:normContact(nr[0])});
  }catch(e){console.error(e);res.status(500).json({error:'Ошибка сервера'});}
});

app.get('/api/contacts/notifications', auth, async (req,res)=>{
  try{
    const me=req.user.id;
    const [inc] = await pool.query('SELECT * FROM contacts WHERE toUserId=? ORDER BY createdAt DESC',[me]);
    const [out] = await pool.query('SELECT * FROM contacts WHERE fromUserId=? ORDER BY createdAt DESC',[me]);
    const incoming=inc.map(normContact), outgoing=out.map(normContact);
    const badgeCount = incoming.filter(c=>c.status==='pending').length + outgoing.filter(c=>c.status==='shared'&&!c.requesterSeen).length;
    res.json({incoming,outgoing,badgeCount});
  }catch(e){res.status(500).json({error:'Ошибка сервера'});}
});

app.post('/api/contacts/:id/share', auth, async (req,res)=>{
  try{
    const{contactInfo}=req.body||{};
    if(!contactInfo||!String(contactInfo).trim()) return res.status(400).json({error:'Введите контактные данные'});
    const [cr] = await pool.query('SELECT * FROM contacts WHERE id=?',[req.params.id]);
    const c=cr[0];
    if(!c) return res.status(404).json({error:'Запрос не найден'});
    if(c.toUserId!==req.user.id) return res.status(403).json({error:'Нет доступа'});
    await pool.query("UPDATE contacts SET status='shared', contactInfo=?, sharedAt=NOW() WHERE id=?",[String(contactInfo).trim(),req.params.id]);
    res.json({ok:true});
  }catch(e){res.status(500).json({error:'Ошибка сервера'});}
});

app.post('/api/contacts/:id/seen', auth, async (req,res)=>{
  try{
    await pool.query('UPDATE contacts SET requesterSeen=1 WHERE id=? AND fromUserId=?',[req.params.id,req.user.id]);
    res.json({ok:true});
  }catch(e){res.status(500).json({error:'Ошибка сервера'});}
});

app.delete('/api/contacts/:id', auth, async (req,res)=>{
  try{
    const [cr] = await pool.query('SELECT * FROM contacts WHERE id=?',[req.params.id]);
    const c=cr[0];
    if(!c) return res.status(404).json({error:'Запрос не найден'});
    if(c.toUserId!==req.user.id && c.fromUserId!==req.user.id) return res.status(403).json({error:'Нет доступа'});
    await pool.query('DELETE FROM contacts WHERE id=?',[req.params.id]);
    res.json({ok:true});
  }catch(e){res.status(500).json({error:'Ошибка сервера'});}
});

/* ---------- Запуск ---------- */
initDb()
  .then(()=>{
    app.listen(PORT,()=>{
      console.log(`\n🏠 СоСед запущен! http://localhost:${PORT}`);
      console.log(`   База данных: MySQL`);
      console.log(`   Код админа: ${ADMIN_CODE}\n`);
    });
  })
  .catch(err=>{
    console.error('❌ Не удалось подключиться к базе данных MySQL:', err.message);
    console.error('   Проверьте переменные подключения (DATABASE_URL или DB_HOST/DB_USER/...)');
    process.exit(1);
  });
