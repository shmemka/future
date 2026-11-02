-- «Путь в будущее» — схема базы данных (SQLite).
-- Таблицы сгруппированы по доменам: пользователи, обучение, мероприятия,
-- мотивация (жетоны и достижения), сообщество, безопасность.

PRAGMA foreign_keys = ON;

-- ───────────── Пользователи ─────────────
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'participant' CHECK (role IN ('participant','mentor','admin')),
  status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','blocked')),
  avatar        TEXT    NOT NULL DEFAULT 'violet',      -- ключ цветовой схемы аватара
  avatar_emoji  TEXT    NOT NULL DEFAULT '🚀',
  city          TEXT    NOT NULL DEFAULT '',
  school        TEXT    NOT NULL DEFAULT '',
  bio           TEXT    NOT NULL DEFAULT '',
  headline      TEXT    NOT NULL DEFAULT '',            -- для наставников: специализация
  interests     TEXT    NOT NULL DEFAULT '[]',          -- JSON-массив ключей направлений
  show_in_rating INTEGER NOT NULL DEFAULT 1,
  allow_messages INTEGER NOT NULL DEFAULT 1,            -- разрешать личные сообщения от участников
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  last_seen_at  TEXT
);

-- ───────────── Обучение ─────────────
CREATE TABLE IF NOT EXISTS courses (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT    NOT NULL UNIQUE,
  title          TEXT    NOT NULL,
  direction      TEXT    NOT NULL,                      -- ключ направления (см. shared/directions)
  short          TEXT    NOT NULL DEFAULT '',
  description    TEXT    NOT NULL DEFAULT '',
  outcomes       TEXT    NOT NULL DEFAULT '[]',         -- JSON: чему научишься
  mentor_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  level          TEXT    NOT NULL DEFAULT 'start' CHECK (level IN ('start','middle','advanced')),
  duration_weeks INTEGER NOT NULL DEFAULT 3,
  tokens_reward  INTEGER NOT NULL DEFAULT 30,
  published      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lessons (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id    INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0,
  title        TEXT    NOT NULL,
  body         TEXT    NOT NULL DEFAULT '',             -- простая разметка: абзацы, «- » списки, «## » подзаголовки
  duration_min INTEGER NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id     INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id     INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  title         TEXT    NOT NULL,
  prompt        TEXT    NOT NULL,
  kind          TEXT    NOT NULL DEFAULT 'text' CHECK (kind IN ('text','quiz')),
  quiz          TEXT,                                   -- JSON: [{q, options:[...], answer:index}]
  tokens_reward INTEGER NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS enrollments (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id    INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer      TEXT    NOT NULL,
  score       INTEGER,                                  -- для тестов: число верных ответов
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','revision')),
  feedback    TEXT    NOT NULL DEFAULT '',
  reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  UNIQUE (task_id, user_id)
);

-- ───────────── Мероприятия ─────────────
CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL,
  kind          TEXT    NOT NULL,                       -- masterclass | meeting | openmic | career | psychology | excursion | lecture
  description   TEXT    NOT NULL DEFAULT '',
  starts_at     TEXT    NOT NULL,                       -- ISO-строка, местное время Новосибирска хранится как есть
  ends_at       TEXT    NOT NULL,
  location      TEXT    NOT NULL DEFAULT '',
  format        TEXT    NOT NULL DEFAULT 'offline' CHECK (format IN ('offline','online')),
  capacity      INTEGER NOT NULL DEFAULT 30,
  tokens_reward INTEGER NOT NULL DEFAULT 20,
  host          TEXT    NOT NULL DEFAULT '',
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  published     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_registrations (
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT    NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','attended')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_id, user_id)
);

-- ───────────── Мотивация ─────────────
CREATE TABLE IF NOT EXISTS token_tx (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL,
  category   TEXT    NOT NULL CHECK (category IN ('course','task','event','team','initiative','bonus','correction')),
  reason     TEXT    NOT NULL,
  ref        TEXT,                                      -- ключ источника, защищает от двойного начисления
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS token_tx_ref ON token_tx(user_id, ref) WHERE ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code      TEXT    NOT NULL,
  earned_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, code)
);

CREATE TABLE IF NOT EXISTS activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL,
  text       TEXT    NOT NULL,
  link       TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT    NOT NULL,
  link       TEXT,
  read_at    TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ───────────── Сообщество ─────────────
CREATE TABLE IF NOT EXISTS channels (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  emoji       TEXT NOT NULL DEFAULT '💬',
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id      INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT    NOT NULL DEFAULT 'discussion' CHECK (kind IN ('discussion','idea','question')),
  title           TEXT    NOT NULL,
  body            TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'published' CHECK (status IN ('published','pending','hidden','rejected')),
  moderation_note TEXT    NOT NULL DEFAULT '',
  pinned          INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'published' CHECK (status IN ('published','pending','hidden')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS post_supports (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT    NOT NULL,
  hidden       INTEGER NOT NULL DEFAULT 0,
  read_at      TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS messages_pair ON messages(sender_id, recipient_id);

-- ───────────── Безопасность ─────────────
CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT    NOT NULL CHECK (target_type IN ('post','comment','message','user')),
  target_id   INTEGER NOT NULL,
  reason      TEXT    NOT NULL,
  details     TEXT    NOT NULL DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolution  TEXT    NOT NULL DEFAULT '',
  handled_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  handled_at  TEXT
);

CREATE TABLE IF NOT EXISTS help_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee  TEXT    NOT NULL CHECK (addressee IN ('moderator','mentor','psychologist')),
  topic      TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  anonymous  INTEGER NOT NULL DEFAULT 0,
  status     TEXT    NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','closed')),
  response   TEXT    NOT NULL DEFAULT '',
  handled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  handled_at TEXT
);
