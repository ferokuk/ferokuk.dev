'use strict';

// ferokuk.dev: page behaviour and the two hero diagrams (three.js).
// The diagram code (initScene, initReview and their data) comes from the design file as is.
(function () {
  const YM_ID = 112122572;
  const LANG = document.documentElement.lang === 'en' ? 'en' : 'ru';
  const STR = {
    en: { light: 'Light', dark: 'Dark', calmOn: 'Less motion', calmOff: 'Full motion' },
    ru: { light: 'Светлая', dark: 'Тёмная', calmOn: 'Меньше анимаций', calmOff: 'Все анимации' }
  };
  const THEME_BG = { dark: '#0b0d0c', light: '#f3f4ef' };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const NODES = [
    { id: 'web', name: 'web UI', sub: 'payment.received', x: -12.5, z: -5, shape: 'screen' },
    { id: 'mob', name: 'mobile app', sub: 'payment.received', x: -12.5, z: 0, shape: 'phone' },
    { id: 'api', name: 'partner API', sub: 'payment.received', x: -12.5, z: 5, shape: 'box', w: 1.3, h: 1.3, d: 1.3 },
    { id: 'gw', name: 'FastAPI gateway', sub: '4 pods', x: -7.5, z: 0, shape: 'rack', w: 2.4, h: 1.8, d: 2.8, brand: 'fastapi' },
    { id: 'redis', name: 'Redis', sub: 'velocity cache', x: -2.5, z: -6, shape: 'slabs', w: 2, h: 1.5, d: 2, brand: 'redis' },
    { id: 'pg', name: 'PostgreSQL', sub: 'customer profile', x: -2.5, z: 6, shape: 'cyl', w: 2.1, h: 1.8, brand: 'postgresql' },
    { id: 'enrich', name: '01 enrich', sub: 'Redis · PostgreSQL', x: -2.5, z: 0, shape: 'box', w: 2.1, h: 1.2, d: 2.3 },
    { id: 'score', name: '02 score', sub: 'rules · model v7 · flag > 0.80', x: 2.5, z: 0, shape: 'box', w: 2.1, h: 2.4, d: 2.3 },
    { id: 'kafka', name: 'Kafka', sub: 'decisions', x: 7.5, z: 0, shape: 'box', w: 3, h: 1.6, d: 3, brand: 'kafka' },
    { id: 'ch', name: 'ClickHouse', sub: 'audit log', x: 12.5, z: -5, shape: 'bars', w: 2.1, h: 1.9, d: 1.6, brand: 'clickhouse' },
    { id: 'queue', name: 'case queue', sub: 'manual review', x: 12.5, z: 0, shape: 'stack', w: 1.7, h: 1.1, d: 1.7 },
    { id: 'alert', name: 'ops alert', sub: 'high-risk only', x: 12.5, z: 5, shape: 'beacon', w: 1.4, h: 0.4, d: 1.4 }
  ];
  const LINKS = [['web', 'gw'], ['mob', 'gw'], ['api', 'gw'], ['gw', 'enrich'], ['enrich', 'redis'], ['enrich', 'pg'], ['enrich', 'score'], ['score', 'kafka'], ['kafka', 'ch'], ['kafka', 'queue'], ['kafka', 'alert']];
  const BRANDS = {
    fastapi: { slug: 'fastapi', color: 0x009688, ink: '#ffffff', text: 'FastAPI' },
    redis: { slug: 'redis', color: 0xd82c20, ink: '#ffffff' },
    postgresql: { slug: 'postgresql', color: 0x336791, ink: '#ffffff' },
    kafka: { slug: 'apachekafka', color: 0xf4f4f1, ink: '#16181a', colorLight: 0x1d1f21, inkLight: '#ffffff', text: 'kafka' },
    clickhouse: { slug: 'clickhouse', color: 0xffcc01, ink: '#16181a' }
  };
  const PAL = {
    dark: { box: 0x39423a, own: 0x4c632a, edge: 0x5d6a5b, acc: 0xb9f24e, warn: 0xff7a59, grid: 0x39443a, dust: 0xa9b4a7, ev: 0xffffff, link: 0x4a564a },
    light: { box: 0xaab2a6, own: 0x7fb56a, edge: 0x8f9b8f, acc: 0x3f9a1c, warn: 0xd9482b, grid: 0xb4bdb0, dust: 0x6f7b6f, ev: 0x1b211b, link: 0x9aa498 }
  };
  const NODE_COPY = {
    en: {
      web: ['source', 'Web interface. Payments made in the browser start here.'],
      mob: ['source', 'Mobile app. Payments made on phones start here.'],
      api: ['source', 'Partner API. External systems send payments through it.'],
      gw: ['API gateway', 'Receives payments from every source and passes them to antifraud. Runs in 4 pods.'],
      redis: ['cache', 'Fast in-memory store. Keeps per-customer counters of how often operations happen.'],
      pg: ['database', 'Main database. Stores customer profiles.'],
      enrich: ['antifraud · step 1', 'Enrichment. Adds counters from Redis and the customer profile from PostgreSQL to the payment.'],
      score: ['antifraud · step 2', 'Scoring. Rules and model v7 rate the risk. A payment scoring above 0.80 is flagged as suspicious.'],
      kafka: ['event broker', 'Takes antifraud decisions into the decisions topic and delivers them to consumers.'],
      ch: ['analytics database', 'Columnar database for analytics. Stores the decision log for audit.'],
      queue: ['review queue', 'Suspicious payments land here. An analyst checks them manually.'],
      alert: ['alerting', 'Tells the on-call team about high-risk payments.']
    },
    ru: {
      web: ['источник', 'Веб-интерфейс. Отсюда приходят платежи, сделанные в браузере.'],
      mob: ['источник', 'Мобильное приложение. Отсюда приходят платежи с телефонов.'],
      api: ['источник', 'API для партнёров. Через него платежи отправляют внешние системы.'],
      gw: ['API-шлюз', 'Принимает платежи из всех источников и передаёт их в антифрод. Работает в 4 подах.'],
      redis: ['кеш', 'Быстрое хранилище в памяти. Держит счётчики частоты операций по каждому клиенту.'],
      pg: ['база данных', 'Основная база данных. Хранит профили клиентов.'],
      enrich: ['антифрод · шаг 1', 'Обогащение. Добавляет к платежу счётчики из Redis и профиль клиента из PostgreSQL.'],
      score: ['антифрод · шаг 2', 'Скоринг. Правила и модель v7 оценивают риск. Платёж с оценкой выше 0.80 помечается как подозрительный.'],
      kafka: ['брокер событий', 'Принимает решения антифрода в топик decisions и раздаёт их получателям.'],
      ch: ['аналитическая база', 'Колоночная база для аналитики. Хранит журнал решений для аудита.'],
      queue: ['очередь разбора', 'Сюда попадают подозрительные платежи. Их вручную проверяет аналитик.'],
      alert: ['оповещения', 'Сообщает дежурным о платежах с высоким риском.']
    }
  };
  // ---- second hero scene: AI code reviewer ----
  const RNODES = [
    { id: 'rgl', name: 'GitLab', sub: 'repositories · merge requests', x: -14, z: -7.3, main: 1, lr: [1.4, -1.3] },
    { id: 'rA', name: 'repo · Java', sub: 'merge request → CI job', x: -14, z: -4, short: 'Java' },
    { id: 'rB', name: 'repo · Python', sub: 'merge request → CI job', x: -14, z: 0, short: 'Python' },
    { id: 'rC', name: 'repo · JS', sub: 'merge request → CI job', x: -14, z: 4, short: 'JS' },
    { id: 'rq', name: 'RabbitMQ', sub: 'review tasks', x: -9, z: 0, main: 1 },
    { id: 'rapi', name: 'FastAPI', sub: 'consumer', x: -4.5, z: 0, main: 1 },
    { id: 'ragent', name: 'ReAct agent', sub: 'LangGraph · think → act → observe', x: 2, z: 0, main: 1 },
    { id: 'rllm', name: 'corp LLM', sub: 'separate system', x: 2, z: -10, main: 1 },
    { id: 'rmG', name: 'MCP · GitLab', sub: 'FastMCP server', x: -1.57, z: -6.71 },
    { id: 'rmS', name: 'MCP · security', sub: 'FastMCP server', x: 8.15, z: -4.47 },
    { id: 'rmC', name: 'MCP · code style', short: 'MCP · style', sub: 'FastMCP server', x: 9.43, z: 1.58 },
    { id: 'rmU', name: 'MCP · UI toolkit', short: 'MCP · UI kit', sub: 'FastMCP server · JS merge requests only', x: 6.36, z: 6.23, ll: 1 },
    { id: 'rsec', name: 'security rules', sub: 'knowledge base', x: 11.55, z: -6.94, lb: 1 },
    { id: 'rsty', name: 'code style', sub: 'knowledge base', x: 13.54, z: 2.45, lb: 1 },
    { id: 'rui', name: 'UI toolkit', sub: 'component library', x: 8.77, z: 9.67, lb: 1 }
  ];
  const RCOPY = {
    en: {
      rgl: ['source and result', 'Corporate GitLab inside the closed perimeter. Team repositories live here, merge requests come from here, and line comments with a summary come back here.'],
      rA: ['source', 'A team repository. A merge request starts a review automatically, so teams run nothing on their side. Click the block to open a merge request.'],
      rB: ['source', 'A team repository. A merge request starts a review automatically, so teams run nothing on their side. Click the block to open a merge request.'],
      rC: ['source', 'A team repository. A merge request starts a review automatically, so teams run nothing on their side. Click the block to open a merge request.'],
      rq: ['queue', 'Compute for the model is scarce and merge requests arrive in bursts. The queue smooths the load: tasks wait their turn instead of being lost or overloading the model.'],
      rapi: ['consumer', 'Takes tasks from the queue at the pace the model can handle and starts a review.'],
      ragent: ['my code · agent', 'A ReAct agent on LangGraph. It works in laps: asks the model what to do next, calls tools, reads the result. The number of laps is not known in advance, so it is capped.'],
      rllm: ['model', 'The corporate LLM runs inside the closed perimeter, so code never goes to external services. Its capacity is limited, which is why requests reach it through the queue.'],
      rmG: ['my code · tool', 'MCP server for GitLab with about a dozen tools. The agent reads the changes and files from any branch of the project, comments on exact lines and labels the merge request.'],
      rmS: ['my code · tool', 'MCP server over the security rules base. The agent fetches only the rules that apply to the changed code instead of spending the model context on the whole base.'],
      rmC: ['my code · tool', 'MCP server over the code style guide. The agent fetches only the rules that apply to the changed code instead of spending the model context on the whole guide.'],
      rmU: ['my code · tool', 'MCP server over the corporate frontend toolkit. The agent calls it only for JavaScript merge requests, to check that the interface is built from the shared components.'],
      rui: ['component library', 'The corporate UI toolkit: shared interface components and the rules for using them.'],
      rsec: ['knowledge base', 'Corporate security rules. They stay inside the perimeter; the agent reads them through its MCP server.'],
      rsty: ['knowledge base', 'Corporate code style rules. They stay inside the perimeter; the agent reads them through its MCP server.']
    },
    ru: {
      rgl: ['источник и результат', 'Корпоративный GitLab внутри закрытого контура. Здесь лежат репозитории команд, отсюда приходят запросы на слияние, сюда же возвращаются комментарии к строкам и общий итог.'],
      rA: ['источник', 'Репозиторий команды. Запрос на слияние запускает проверку автоматически, командам не нужно ничего разворачивать у себя. Нажмите на блок, чтобы открыть запрос на слияние.'],
      rB: ['источник', 'Репозиторий команды. Запрос на слияние запускает проверку автоматически, командам не нужно ничего разворачивать у себя. Нажмите на блок, чтобы открыть запрос на слияние.'],
      rC: ['источник', 'Репозиторий команды. Запрос на слияние запускает проверку автоматически, командам не нужно ничего разворачивать у себя. Нажмите на блок, чтобы открыть запрос на слияние.'],
      rq: ['очередь', 'Вычислительных мощностей под модель мало, а запросы на слияние приходят всплесками. Очередь сглаживает нагрузку: задания ждут своей очереди, а не теряются и не перегружают модель.'],
      rapi: ['потребитель', 'Забирает задания из очереди в том темпе, который выдерживает модель, и запускает проверку.'],
      ragent: ['мой код · агент', 'ReAct-агент на LangGraph. Работает по кругу: спрашивает модель, что делать дальше, вызывает инструменты, читает результат. Сколько кругов понадобится, заранее неизвестно, поэтому их число ограничено.'],
      rllm: ['модель', 'Корпоративная LLM работает внутри закрытого контура, поэтому код не уходит во внешние сервисы. Её мощности ограничены, поэтому запросы приходят к ней через очередь.'],
      rmG: ['мой код · инструмент', 'MCP-сервер для GitLab, около 12 инструментов. Агент читает изменения и файлы из любой ветки проекта, оставляет комментарии к конкретным строкам, ставит метки на запрос на слияние.'],
      rmS: ['мой код · инструмент', 'MCP-сервер над базой правил безопасности. Агент получает только правила, относящиеся к изменённому коду, и не тратит контекст модели на всю базу.'],
      rmC: ['мой код · инструмент', 'MCP-сервер над руководством по стилю кода. Агент получает только правила, относящиеся к изменённому коду, и не тратит контекст модели на всё руководство.'],
      rmU: ['мой код · инструмент', 'MCP-сервер над корпоративным фронтенд-тулкитом. Агент обращается к нему только на JavaScript-запросах: проверяет, что интерфейс собран из общих компонентов.'],
      rui: ['библиотека компонентов', 'Корпоративный UI-тулкит: общие компоненты интерфейса и правила их использования.'],
      rsec: ['база знаний', 'Корпоративные правила безопасности. Остаются внутри контура, агент читает их через свой MCP-сервер.'],
      rsty: ['база знаний', 'Корпоративные правила стиля кода. Остаются внутри контура, агент читает их через свой MCP-сервер.']
    }
  };
  const RICON = {
    rq: 'M23.035 9.601h-7.677a.956.956 0 01-.962-.962V.962a.956.956 0 00-.962-.956H10.56a.956.956 0 00-.962.956V8.64a.956.956 0 01-.962.962H5.762a.956.956 0 01-.961-.962V.962A.956.956 0 003.839 0H.959a.956.956 0 00-.956.962v22.076A.956.956 0 00.965 24h22.07a.956.956 0 00.962-.962V10.58a.956.956 0 00-.962-.98zm-3.86 8.152a1.437 1.437 0 01-1.437 1.443h-1.924a1.437 1.437 0 01-1.436-1.443v-1.917a1.437 1.437 0 011.436-1.443h1.924a1.437 1.437 0 011.437 1.443z',
    rgl: 'm23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0537.8585.8585 0 0 0-.3362.4049L.4332 9.5015l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.03.0213 4.976 3.7264 2.462 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.4619-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0094-7.003z',
    mcp: 'M13.85 0a4.16 4.16 0 0 0-2.95 1.217L1.456 10.66a.835.835 0 0 0 0 1.18.835.835 0 0 0 1.18 0l9.442-9.442a2.49 2.49 0 0 1 3.541 0 2.49 2.49 0 0 1 0 3.541L8.59 12.97l-.1.1a.835.835 0 0 0 0 1.18.835.835 0 0 0 1.18 0l.1-.098 7.03-7.034a2.49 2.49 0 0 1 3.542 0l.049.05a2.49 2.49 0 0 1 0 3.54l-8.54 8.54a1.96 1.96 0 0 0 0 2.755l1.753 1.753a.835.835 0 0 0 1.18 0 .835.835 0 0 0 0-1.18l-1.753-1.753a.266.266 0 0 1 0-.394l8.54-8.54a4.185 4.185 0 0 0 0-5.9l-.05-.05a4.16 4.16 0 0 0-2.95-1.218c-.2 0-.401.02-.6.048a4.17 4.17 0 0 0-1.17-3.552A4.16 4.16 0 0 0 13.85 0m0 3.333a.84.84 0 0 0-.59.245L6.275 10.56a4.186 4.186 0 0 0 0 5.902 4.186 4.186 0 0 0 5.902 0L19.16 9.48a.835.835 0 0 0 0-1.18.835.835 0 0 0-1.18 0l-6.985 6.984a2.49 2.49 0 0 1-3.54 0 2.49 2.49 0 0 1 0-3.54l6.983-6.985a.835.835 0 0 0 0-1.18.84.84 0 0 0-.59-.245',
    py: 'M14.25.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.07-.26.04-.21.02H8.77l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.37-.1.35-.07.32-.04.27-.02.21v3.06H3.17l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05-.05-1.23.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.18l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09zm13.09 3.95l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08z',
    js: 'M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z',
    rapi: 'M12 .0387C5.3729.0384.0003 5.3931 0 11.9988c-.001 6.6066 5.372 11.9628 12 11.9625 6.628.0003 12.001-5.3559 12-11.9625-.0003-6.6057-5.3729-11.9604-12-11.96m-.829 5.4153h7.55l-7.5805 5.3284h5.1828L5.279 18.5436q2.9466-6.5444 5.892-13.0896'
  };
  // example diffs shown on the review card, five per repository language: [marker, code]; notes point at a line index
  const RDIFFS = {
    rA: [
      { file: "dao/UserDao.java", lines: [[" ", "public User find(String name) {"], ["-", "  return repo.findByName(name);"], ["+", "  String q = \"SELECT * FROM users\""], ["+", "      + \" WHERE name='\" + name + \"'\";"], ["+", "  return jdbc.queryForObject(q,"], ["+", "      User.class);"], [" ", "}"]], notes: [{ l: 3, k: "sec" }] },
      { file: "pay/PaymentService.java", lines: [[" ", "public void pay(Order o) {"], ["-", "  gateway.charge(o.getTotal());"], ["+", "  try {"], ["+", "    gateway.charge(o.getTotal());"], ["+", "  } catch (Exception e) {"], ["+", "    e.printStackTrace();"], ["+", "  }"], [" ", "}"]], notes: [{ l: 4, k: "style" }, { l: 5, k: "style" }] },
      { file: "auth/TokenUtil.java", lines: [[" ", "public String sign(String data) {"], ["-", "  return hmac.sign(data);"], ["+", "  MessageDigest md ="], ["+", "      MessageDigest.getInstance(\"MD5\");"], ["+", "  byte[] h = md.digest(data.getBytes());"], ["+", "  return Hex.encode(h);"], [" ", "}"]], notes: [{ l: 3, k: "sec" }, { l: 4, k: "style" }] },
      { file: "web/FileController.java", lines: [[" ", "@GetMapping(\"/files/{name}\")"], [" ", "public Resource get(String name) {"], ["-", "  return storage.load(name);"], ["+", "  File f = new File(BASE + name);"], ["+", "  log.info(\"download \" + f);"], ["+", "  return new FileSystemResource(f);"], [" ", "}"]], notes: [{ l: 3, k: "sec" }, { l: 4, k: "style" }] },
      { file: "order/OrderMapper.java", lines: [[" ", "public OrderDto map(Order o) {"], ["+", "  if (o.getItems() == null) return null;"], [" ", "  OrderDto d = new OrderDto();"], [" ", "  d.setId(o.getId());"], ["+", "  d.setCard(o.getCardNumber());"], [" ", "  return d;"], [" ", "}"]], notes: [{ l: 4, k: "sec" }, { l: 1, k: "style" }] }
    ],
    rB: [
      { file: "auth/service.py", lines: [[" ", "def login(user, password):"], ["-", "    q = f\"... WHERE name='{user}'\""], ["+", "    q = \"... WHERE name = %s\""], ["+", "    row = db.execute(q, (user,))"], [" ", "    if row is None:"], ["+", "        log.info(\"fail: \" + password)"], [" ", "        return None"], ["+", "    return jwt.encode(data, KEY)"]], notes: [{ l: 5, k: "sec" }, { l: 7, k: "style" }] },
      { file: "billing/tasks.py", lines: [[" ", "@app.task"], ["-", "def charge(order_id):"], ["+", "def charge(order_id, retries=3):"], ["+", "    r = requests.post(URL, json=o)"], ["+", "    if r.status_code != 200:"], ["+", "        print(\"failed\", r.text)"], ["+", "        charge(order_id, retries - 1)"], [" ", "    return r.json()"]], notes: [{ l: 3, k: "sec" }, { l: 5, k: "style" }, { l: 6, k: "style" }] },
      { file: "api/views.py", lines: [[" ", "class OrderView(APIView):"], ["+", "    permission_classes = []"], [" ", "    def get(self, request, pk):"], ["-", "        o = get_object_or_404(Order, pk)"], ["+", "        o = Order.objects.get(pk=pk)"], ["+", "        f = eval(request.GET[\"f\"])"], [" ", "        return Response(f(o))"]], notes: [{ l: 1, k: "sec" }, { l: 5, k: "sec" }] },
      { file: "utils/reports.py", lines: [[" ", "def read_report(name):"], ["-", "    return cache[name]"], ["+", "    path = REPORTS + \"/\" + name"], ["+", "    f = open(path)"], ["+", "    data = f.read()"], ["+", "    return yaml.load(data)"]], notes: [{ l: 2, k: "sec" }, { l: 3, k: "style" }, { l: 5, k: "sec" }] },
      { file: "services/notify.py", lines: [[" ", "def send_sms(phone, text):"], ["+", "    token = \"a1b2c3d4e5\""], ["+", "    url = f\"http://sms.local/send\""], ["+", "    r = requests.get(url, params={"], ["+", "        \"to\": phone, \"t\": text})"], ["-", "    return True"], ["+", "    return r.ok"]], notes: [{ l: 1, k: "sec" }, { l: 2, k: "style" }] }
    ],
    rC: [
      { file: "routes/users.js", lines: [[" ", "router.get(\"/users\", (req, res) => {"], ["-", "  const q = User.find({ active: true });"], ["+", "  const q = User.find(req.query);"], ["+", "  q.then(u => res.send(u));"], [" ", "});"]], notes: [{ l: 2, k: "sec" }, { l: 3, k: "style" }] },
      { file: "ui/Comment.jsx", lines: [[" ", "export function Comment({ text }) {"], ["-", "  return <p>{text}</p>;"], ["+", "  return <p dangerouslySetInnerHTML={"], ["+", "    { __html: text }} />;"], [" ", "}"]], notes: [{ l: 2, k: "sec" }] },
      { file: "ui/OrderForm.jsx", lines: [[" ", "export function OrderForm({ onSave }) {"], ["-", "  return <Button onClick={onSave}>"], ["+", "  return <button className=\"btn-blue\""], ["+", "    style={{ padding: 7 }} onClick={onSave}>"], [" ", "    Save"], ["-", "  </Button>;"], ["+", "  </button>;"], [" ", "}"]], notes: [{ l: 2, k: "ui" }, { l: 3, k: "style" }] },
      { file: "ui/Confirm.jsx", lines: [[" ", "export function Confirm({ open }) {"], ["+", "  if (!open) return null;"], ["-", "  return <Modal title=\"Confirm\" />;"], ["+", "  return <div className=\"overlay\">"], ["+", "    <div className=\"popup\">Confirm?</div>"], ["+", "  </div>;"], [" ", "}"]], notes: [{ l: 3, k: "ui" }] },
      { file: "auth/session.js", lines: [[" ", "function login(req, res) {"], ["+", "  const t = jwt.sign(req.body, \"secret\");"], ["-", "  res.cookie(\"token\", t, SAFE);"], ["+", "  res.cookie(\"token\", t);"], ["+", "  console.log(\"login\", req.body);"], [" ", "}"]], notes: [{ l: 1, k: "sec" }, { l: 3, k: "sec" }, { l: 4, k: "style" }] }
    ]
  };
  const UI = { en: { events: 'events', scA: 'Pipeline', scB: 'AI reviewer', hudA: ['traffic', 'rps', 'p99', '5xx'], hudB: ['reviews', 'queue', 'step', 'tool_calls'], arch: 'Show the architecture on the diagram' }, ru: { events: 'событий', scA: 'Пайплайн', scB: 'ИИ-ревьюер', hudA: ['traffic', 'rps', 'p99', '5xx'], hudB: ['reviews', 'queue', 'step', 'tool_calls'], arch: 'Показать архитектуру на схеме' } };
  const NAV_IDS = ['work', 'stack', 'path', 'contact'];
  const REFS = ['canvasRef', 'labelsRef', 'slotRef', 'heroRef', 'bg1Ref', 'bg2Ref', 'nodeCountRef', 'rpsRef', 'p99Ref', 'errRef', 'rpsSpark', 'p99Spark', 'errSpark', 'tipRef', 'tipPosRef', 'tipCardRef', 'tipLineRef'];

  class App {
    constructor() {
      const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const theme = store.get('theme'), calm = store.get('calm');
      // scene options the design exposed as editor tweaks; fixed at their defaults
      this.props = { packetStyle: 'streaks', packetDensity: 1.1, sceneDensity: 'auto', showLabels: true, tiltCards: true };
      this.state = { theme: theme === 'light' ? 'light' : 'dark', calm: calm === null ? rm : calm === '1', sel: null, tip: null, explore: false, scene: 'fraud', nav: '' };
      REFS.forEach(k => { this[k] = { current: $('[data-ref="' + k + '"]') }; });
      this.counts = {};
    }
    setState(patch) {
      const next = typeof patch === 'function' ? patch(this.state) : patch;
      if (!next) return;
      Object.assign(this.state, next);
      this.render();
      this.didUpdate();
    }
    mount() {
      this.bind();
      this.render();
      this.applyTheme();
      this._prev = { theme: this.state.theme, calm: this.state.calm, dens: this.densKey(), sel: null, explore: false };
      // a page restored from the back/forward cache picks up choices made on the other language version
      window.addEventListener('pageshow', e => {
        if (!e.persisted) return;
        const theme = store.get('theme'), calm = store.get('calm'), next = {};
        if ((theme === 'light' || theme === 'dark') && theme !== this.state.theme) next.theme = theme;
        if (calm !== null && (calm === '1') !== this.state.calm) next.calm = calm === '1';
        if ('theme' in next || 'calm' in next) this.setState(next);
      });
      this.onScroll = () => {
        if (this.sT) return;
        this.sT = requestAnimationFrame(() => {
          this.sT = 0; const y = window.scrollY || 0; this.scrollY = y;
          // scroll spy: the last section whose top has passed 40% of the viewport; the page bottom always means contact
          let nav = ''; NAV_IDS.forEach(id => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) nav = id; });
          if (y > 0 && window.innerHeight + y >= document.documentElement.scrollHeight - 4) nav = 'contact';
          if (nav !== this.state.nav) this.setState({ nav });
          if (this.state.calm) return;
          const a = this.bg1Ref.current, b = this.bg2Ref.current;
          if (a) a.style.transform = 'translate3d(0,' + (-((y * 0.07) % 24)) + 'px,0)';
          if (b) b.style.transform = 'translate3d(0,' + (-((y * 0.22) % 120)) + 'px,0)';
        });
      };
      this.onKey = e => { if (e.key !== 'Escape') return; if (this.state.sel) this.select(null); else if (this.state.explore) this.setState({ explore: false }); };
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('keydown', this.onKey);
      this.boot = setInterval(() => { if (window.THREE && this.canvasRef.current && this.slotRef.current) { clearInterval(this.boot); this.initScene(); } }, 60);
      setTimeout(() => this.setupReveal(), 300);
    }
    bind() {
      const on = (sel, ev, fn) => $$(sel).forEach(el => el.addEventListener(ev, fn));
      on('[data-act="theme"]', 'click', () => this.setState(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })));
      on('[data-act="calm"]', 'click', () => this.setState(s => ({ calm: !s.calm })));
      on('[data-act="explore"]', 'click', () => this.setState(s => ({ explore: !s.explore })));
      on('[data-act="close-tip"]', 'click', () => this.select(null));
      on('[data-scene]', 'click', e => { const scene = e.currentTarget.dataset.scene; if (scene !== this.state.scene) this.setState({ scene, sel: null, tip: null }); });
      on('[data-zoom]', 'click', e => {
        const s = this.three, z = e.currentTarget.dataset.zoom; if (!s) return;
        if (z === 'in') s.zoomBy(1.25); else if (z === 'out') s.zoomBy(0.8); else s.reset();
      });
      on('[data-arch]', 'click', e => this.openArch(e.currentTarget.dataset.arch, e));
      on('[data-tilt]', 'pointermove', this.tilt);
      on('[data-tilt]', 'pointerleave', this.untilt);
    }
    // writes the state into the page: everything the design re-rendered through its template
    render() {
      const { theme, calm, tip, explore, scene, nav } = this.state, str = STR[LANG], rv = scene === 'review', ui = UI[LANG], hud = rv ? ui.hudB : ui.hudA;
      const tn = tip ? (rv ? RNODES : NODES).find(x => x.id === tip) : null, nc = tn ? (rv ? RCOPY : NODE_COPY)[LANG][tn.id] : null;
      const text = (sel, v) => { const el = $(sel); if (el && el.textContent !== v) el.textContent = v; };
      $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === nav));
      text('[data-act="theme"]', theme === 'dark' ? str.light : str.dark);
      text('[data-act="calm"]', calm ? str.calmOff : str.calmOn);
      const heroText = $('[data-hero-text]'), heroHide = $('[data-hero-hide]');
      if (heroText) heroText.hidden = explore;
      if (heroHide) heroHide.hidden = !explore;
      $$('[data-scene]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scene === scene)));
      ['t', 'a', 'b', 'c'].forEach((k, i) => text('[data-hud="' + k + '"]', hud[i]));
      text('[data-tip="kind"]', nc ? nc[0] : '');
      text('[data-tip="title"]', tn ? tn.name : '');
      text('[data-tip="text"]', nc ? nc[1] : '');
    }
    didUpdate() {
      const pv = this._prev || {}, dens = this.densKey();
      this._prev = { theme: this.state.theme, calm: this.state.calm, dens, sel: this.state.sel, explore: this.state.explore };
      if (pv.theme !== this.state.theme) { this.applyTheme(); store.set('theme', this.state.theme); }
      if (pv.calm !== this.state.calm) store.set('calm', this.state.calm ? '1' : '0');
      if (pv.dens !== undefined && pv.dens !== dens && this.three) { this.disposeScene(); this.initScene(); }
      if (this.three) { this.three.fit(); this.three.setLabels(this.props.showLabels ?? true); }
      if (this.state.calm && !pv.calm) $$('[data-reveal]').forEach(el => { el.style.opacity = ''; el.style.transform = ''; });
      if (pv.sel !== this.state.sel) this.animateTip();
      if (pv.explore !== undefined && pv.explore !== this.state.explore) {
        // keep keyboard focus on the paired button, unless the visitor has moved focus out of the hero
        const el = $(this.state.explore ? '[data-hero-hide]' : '[data-hero-show]'), act = document.activeElement, hero = this.heroRef.current;
        if (el && (!act || act === document.body || (hero && hero.contains(act)))) el.focus({ preventScroll: true });
      }
    }
    applyTheme() {
      document.documentElement.setAttribute('data-theme', this.state.theme);
      const meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', THEME_BG[this.state.theme]);
      if (this.three) this.three.palette(this.state.theme);
    }
    densKey() { return (this.props.sceneDensity ?? 'auto') + '|' + (this.props.packetStyle ?? 'streaks') + '|' + (this.props.packetDensity ?? 1.1) + '|' + this.state.scene; }
    animateTip() {
      const sel = this.state.sel, tip = this.tipRef.current, card = this.tipCardRef.current, line = this.tipLineRef.current, cnt = this.nodeCountRef.current;
      if (!tip) return;
      if (!sel) { tip.style.visibility = 'hidden'; return; }
      if (cnt) cnt.textContent = String(this.counts[sel] || 0);
      if (this.state.calm || !card || !card.animate) return;
      line.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
      card.animate([{ opacity: 0, transform: 'translateY(10px) scale(.96)', clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)' }], { duration: 300, delay: 60, fill: 'backwards', easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    setupReveal() {
      if (this.state.calm || !('IntersectionObserver' in window)) return;
      const vh = window.innerHeight;
      this.io = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.style.opacity = ''; e.target.style.transform = ''; this.io.unobserve(e.target);
      }), { rootMargin: '0px 0px -8% 0px' });
      document.querySelectorAll('[data-reveal]').forEach(el => {
        if (el.getBoundingClientRect().top < vh * 0.95) return;
        el.style.transition = 'opacity .7s cubic-bezier(.2,.7,.2,1), transform .7s cubic-bezier(.2,.7,.2,1)';
        el.style.opacity = '0'; el.style.transform = 'translateY(28px)';
        this.io.observe(el);
      });
    }
    disposeScene() {
      const s = this.three; if (!s) return; this.three = null;
      cancelAnimationFrame(s.raf); s.cleanup.forEach(f => f());
      s.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
      s.renderer.dispose(); if (this.labelsRef.current) this.labelsRef.current.innerHTML = '';
    }
    initScene() {
      if (this.state.scene === 'review') return this.initReview();
      const THREE = window.THREE, self = this, canvas = this.canvasRef.current, slot = this.slotRef.current, hero = this.heroRef.current, labelLayer = this.labelsRef.current;
      const mobile = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
      const dens = this.props.sceneDensity ?? 'auto';
      const hi = dens === 'high' || (dens === 'auto' && !mobile);
      const streak = (this.props.packetStyle ?? 'streaks') === 'streaks', XA = new THREE.Vector3(1, 0, 0);
      const EV = Math.max(8, Math.round((dens === 'high' ? 260 : hi ? 150 : 60) * (this.props.packetDensity ?? 1.1) * (streak ? 0.25 : 1))), DUST = dens === 'high' ? 900 : hi ? 520 : 180;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
      let renderer;
      try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return; }
      renderer.setPixelRatio(dpr); renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -300, 300);
      cam.position.set(40, 33, 40); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
      const root = new THREE.Group(); scene.add(root);
      scene.add(new THREE.AmbientLight(0xffffff, 2.3));
      const dl = new THREE.DirectionalLight(0xffffff, 1.9); dl.position.set(-12, 30, 14); scene.add(dl);
      const C = k => new THREE.Color(k);
      const cAcc = C(0), cWarn = C(0), cEdge = C(0), cEv = C(0), WHITE = C(0xffffff), BLACK = C(0x000000);
      const boxMat = new THREE.MeshLambertMaterial({ color: 0x1b201c });
      const ownMat = new THREE.MeshLambertMaterial({ color: 0x1b201c });
      const warnMat = new THREE.MeshLambertMaterial({ color: 0xff7a59 });
      const pingMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const linkMat = new THREE.LineBasicMaterial({ color: 0x4a564a });
      const zoneMat = new THREE.LineBasicMaterial({ color: 0x5d6a5b });
      const ringMat = new THREE.LineBasicMaterial({ color: 0xb9f24e, transparent: true });
      const aniso = renderer.capabilities.getMaxAnisotropy();
      let themeName = this.state.theme, alive = true, pal = PAL.dark;
      const mkDecal = (w, h, cw, ch) => {
        const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; return { m, tex, ctx: cv.getContext('2d') };
      };
      const inkOf = b => (themeName === 'light' && b.inkLight) ? b.inkLight : b.ink;
      const drawDecal = n => {
        const b = n.brand, d = n.decal, ink = inkOf(b); if (!d) return;
        const paint = img => {
          const c = d.ctx; c.clearRect(0, 0, 256, 256);
          if (b.text) {
            if (img) c.drawImage(img, 68, 30, 120, 120);
            c.fillStyle = ink; c.font = "600 46px 'Golos Text',system-ui,sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b.text, 128, 200);
          } else if (img) c.drawImage(img, 44, 44, 168, 168);
          d.tex.needsUpdate = true;
        };
        n.inkNow = ink; paint(null);
        if (!b.svg) return;
        const img = new Image();
        img.onload = () => { if (alive && n.inkNow === ink) paint(img); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(b.svg.replace('<svg ', '<svg width="256" height="256" fill="' + ink + '" '));
      };
      const nodes = {}, pick = [];
      const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
      NODES.forEach(n => {
        const g = new THREE.Group(); g.position.set(n.x, 0, n.z); root.add(g);
        const b = n.brand ? BRANDS[n.brand] : null;
        const own = n.id === 'enrich' || n.id === 'score';
        const mat = b ? new THREE.MeshLambertMaterial({ color: b.color }) : own ? ownMat : boxMat;
        const em = new THREE.LineBasicMaterial({ color: 0x5d6a5b });
        let top = 0, half = 0.5;
        const add = (geo, x, y, m) => {
          const mesh = new THREE.Mesh(geo, m || mat); mesh.position.set(x, y, 0); g.add(mesh);
          const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), em); e.position.set(x, y, 0); g.add(e);
          mesh.userData.id = n.id; pick.push(mesh);
          geo.computeBoundingBox(); const bb = geo.boundingBox;
          top = Math.max(top, y + bb.max.y); half = Math.max(half, Math.abs(x) + bb.max.x, bb.max.z);
        };
        const layers = (cnt, ph, gap, f) => { for (let i = 0; i < cnt; i++) add(f(ph), 0, ph / 2 + i * (ph + gap)); };
        switch (n.shape) {
          case 'screen': add(B(0.9, 0.12, 0.6), 0, 0.06); add(B(1.9, 1.2, 0.16), 0, 0.72); break;
          case 'phone': add(B(0.8, 1.5, 0.16), 0, 0.75); break;
          case 'rack': layers(4, n.h / 4, 0, ph => B(n.w, ph, n.d)); break;
          case 'slabs': layers(3, 0.36, 0.2, ph => B(n.w, ph, n.d)); break;
          case 'cyl': layers(3, n.h / 3 - 0.06, 0.09, ph => new THREE.CylinderGeometry(n.w / 2, n.w / 2, ph, 36)); break;
          case 'bars': for (let i = 0; i < 4; i++) add(B(0.3, n.h, n.d), -0.72 + i * 0.42, n.h / 2); add(B(0.3, n.h * 0.4, n.d), 0.96, n.h * 0.2); break;
          case 'stack': layers(4, 0.2, 0.05, ph => B(n.w, ph, n.d)); break;
          case 'beacon': add(B(n.w, n.h, n.d), 0, n.h / 2); add(B(0.7, 0.7, 0.7), 0, n.h + 0.35, warnMat); break;
          default: add(B(n.w, n.h, n.d), 0, n.h / 2);
        }
        let decal = null;
        if (b && n.shape !== 'bars') {
          const s = n.shape === 'cyl' ? n.w * 0.62 : Math.min(n.w, n.d) * 0.84;
          decal = mkDecal(s, s, 256, 256); decal.m.position.y = top + 0.015; g.add(decal.m);
        }
        const el = document.createElement('button');
        el.type = 'button';
        el.style.cssText = "position:absolute;left:0;top:0;pointer-events:auto;cursor:pointer;background:color-mix(in srgb,var(--bg) 72%,transparent);border:0;border-radius:4px;padding:3px 7px;margin:0;font:500 11px/1.25 'IBM Plex Mono',monospace;color:var(--ink);text-align:left;white-space:nowrap;will-change:transform;opacity:0";
        el.innerHTML = '<span style="display:inline-block;width:5px;height:5px;background:var(--acc);margin-right:6px;vertical-align:middle"></span>' + n.name + (n.id === 'score' ? '<span data-live="1" style="color:var(--dim)"></span>' : '');
        el.addEventListener('click', () => self.select(n.id));
        labelLayer.appendChild(el);
        nodes[n.id] = { def: n, g, em, eb: C(0), el, hl: 0, hop: 0, delay: (n.x + 12.5) / 25 * 1.1, top: top + 0.3, size: half * 2 + 0.6, brand: b, own, mat, decal, sx: 0, sy: 0 };
      });
      const scoreLive = nodes.score.el.querySelector('[data-live]');
      const lp = [];
      LINKS.forEach(([a, b]) => { const A = nodes[a].def, Bn = nodes[b].def; lp.push(A.x, 0.02, A.z, Bn.x, 0.02, Bn.z); });
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      root.add(new THREE.LineSegments(lg, linkMat));
      const zg = new THREE.BufferGeometry(); zg.setAttribute('position', new THREE.Float32BufferAttribute([-4.5, 0.02, -2.5, 4.5, 0.02, -2.5, 4.5, 0.02, 2.5, -4.5, 0.02, 2.5], 3));
      root.add(new THREE.LineLoop(zg, zoneMat));
      const zl = mkDecal(7, 0.7, 640, 64); zl.m.position.set(1.2, 0.02, 3.05); root.add(zl.m);
      const drawZone = () => {
        const c = zl.ctx; c.clearRect(0, 0, 640, 64); c.fillStyle = themeName === 'light' ? '#535d53' : '#a2aba1';
        c.font = "500 30px 'IBM Plex Mono',monospace"; c.textBaseline = 'middle'; c.fillText('ANTIFRAUD · rules · model v7', 4, 34); zl.tex.needsUpdate = true;
      };
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
      const ring = new THREE.LineLoop(rg, ringMat); ring.visible = false; root.add(ring);
      // ground
      const gMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, extensions: { derivatives: true },
        uniforms: { uLine: { value: C(0x39443a) }, uAcc: { value: C(0xb9f24e) }, uPtr: { value: new THREE.Vector2(99, 99) }, uTime: { value: 0 }, uOn: { value: 0 } },
        vertexShader: 'varying vec2 vW; void main(){ vW=vec2(position.x,-position.y); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying vec2 vW; uniform vec3 uLine,uAcc; uniform vec2 uPtr; uniform float uTime,uOn;\nfloat grid(vec2 p){ vec2 g=abs(fract(p-0.5)-0.5)/fwidth(p); return 1.0-min(min(g.x,g.y),1.0); }\nvoid main(){ float d=length(vW*vec2(0.6,1.0)); float fade=smoothstep(27.0,6.0,d); float g=grid(vW)*0.45+grid(vW*0.2)*0.55; float pd=length(vW-uPtr); float rip=uOn*(smoothstep(4.5,0.0,pd)*0.7+0.6*smoothstep(0.4,0.0,abs(pd-mod(uTime*3.2,10.0)))*smoothstep(10.0,1.5,pd)); float k=clamp(rip,0.0,1.0); gl_FragColor=vec4(mix(uLine,uAcc,k),g*fade*(0.5+k)); }'
      });
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), gMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; root.add(ground);
      // backdrop particles: screen-space layer at far depth, always behind the diagram
      const dp = new Float32Array(DUST * 3), ds = new Float32Array(DUST);
      for (let i = 0; i < DUST; i++) { dp[i * 3] = Math.random() * 2 - 1; dp[i * 3 + 1] = Math.random() * 2 - 1; dp[i * 3 + 2] = 0; ds[i] = Math.random(); }
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('aSeed', new THREE.BufferAttribute(ds, 1));
      const dMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: { value: 0 }, uShift: { value: 0 }, uSize: { value: 1.5 * dpr }, uColor: { value: C(0xa9b4a7) } },
        vertexShader: 'uniform float uTime,uShift,uSize; attribute float aSeed; varying float vA;\nvoid main(){ float d=0.35+aSeed*0.65; vec2 p=position.xy; p.x=mod(p.x+uTime*0.012*d+uShift*d+1.0,2.0)-1.0; p.y=mod(p.y-uTime*0.006*d+1.0,2.0)-1.0; float edge=smoothstep(1.0,0.82,abs(p.x))*smoothstep(1.0,0.82,abs(p.y)); vA=(0.18+0.42*aSeed)*(0.75+0.25*sin(uTime*0.8+aSeed*50.0))*edge; gl_Position=vec4(p,0.999,1.0); gl_PointSize=uSize*(0.7+aSeed*0.9); }',
        fragmentShader: 'uniform vec3 uColor; varying float vA;\nvoid main(){ gl_FragColor=vec4(uColor,vA); }'
      });
      const dust = new THREE.Points(dg, dMat); dust.frustumCulled = false; dust.renderOrder = -10; scene.add(dust);
      // request packets
      const ev = new THREE.InstancedMesh(streak ? B(0.7, 0.07, 0.07) : B(0.26, 0.26, 0.26), new THREE.MeshBasicMaterial({ color: 0xffffff }), EV);
      ev.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ev.frustumCulled = false; root.add(ev);
      const SRCS = ['web', 'mob', 'api'], SZ = { web: -5, mob: 0, api: 5 }, DZ = { ch: -5, queue: 0, alert: 5 }, DUR = streak ? 5 : 6.5;
      const spawn = e => {
        const r = Math.random(); e.score = r < 0.9 ? Math.random() * 0.7 : 0.8 + Math.random() * 0.2;
        e.flag = e.score > 0.8; e.high = e.score > 0.93; e.st = -1;
        e.dest = !e.flag ? 'ch' : e.high ? 'alert' : 'queue'; e.src = SRCS[(Math.random() * 3) | 0];
        const j = streak ? 0 : (Math.random() - 0.5) * 0.7, y = streak ? 0.1 : 0.55 + Math.random() * 0.4;
        e.p = [[-12.5, y, SZ[e.src] + j * 0.4], [-7.5, y, j], [-2.5, y, j], [2.5, y, j], [7.5, y, j], [12.5, y, DZ[e.dest] + j * 0.4]];
      };
      const evs = []; for (let i = 0; i < EV; i++) { const e = { ph: Math.random(), cyc: -1 }; spawn(e); evs.push(e); ev.setColorAt(i, C(0xffffff)); }
      const pings = [0, 1, 2, 3].map(i => { const m = new THREE.Mesh(streak ? B(0.07, 0.07, 0.5) : B(0.14, 0.14, 0.14), pingMat); m.userData.s = i < 2 ? -1 : 1; m.userData.ph = i * 1.7; root.add(m); return m; });
      const M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
      const st = { scene, renderer, raf: 0, cleanup: [() => { alive = false; }] };
      st.palette = th => {
        themeName = th; pal = PAL[th] || PAL.dark; const light = th === 'light';
        boxMat.color.set(pal.box); linkMat.color.set(pal.link); zoneMat.color.set(pal.edge); warnMat.color.set(pal.warn); pingMat.color.set(pal.ev); ringMat.color.set(pal.acc);
        gMat.uniforms.uLine.value.set(pal.grid); gMat.uniforms.uAcc.value.set(pal.acc); dMat.uniforms.uColor.value.set(pal.dust);
        cAcc.set(pal.acc); cWarn.set(pal.warn); cEdge.set(pal.edge); cEv.set(pal.ev);
        ownMat.color.set(pal.own);
        for (const id in nodes) {
          const n = nodes[id], b = n.brand;
          if (b) { n.mat.color.set(light && b.colorLight !== undefined ? b.colorLight : b.color); n.eb.copy(n.mat.color).lerp(inkOf(b) === '#ffffff' ? WHITE : BLACK, 0.45); drawDecal(n); }
          else if (n.own) n.eb.copy(ownMat.color).lerp(light ? BLACK : WHITE, 0.45);
          else n.eb.copy(cEdge);
        }
        drawZone(); evs.forEach(e => { e.st = -1; });
      };
      st.setLabels = on => { labelLayer.style.display = on ? '' : 'none'; };
      Object.keys(BRANDS).forEach(k => {
        const b = BRANDS[k]; if (b.svg || b.pending) return; b.pending = true;
        fetch('https://cdn.jsdelivr.net/npm/simple-icons@11/icons/' + b.slug + '.svg').then(r => r.ok ? r.text() : Promise.reject()).then(svg => {
          b.svg = svg; b.pending = false; const s = self.three; if (s && s.redraw) s.redraw();
        }).catch(() => { b.pending = false; });
      });
      st.redraw = () => { if (!alive) return; for (const id in nodes) if (nodes[id].brand) drawDecal(nodes[id]); drawZone(); };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => st.redraw());
      let W = 1, H = 1, zoomFit = 30, zoom = 30, zm = 1, zmT = 1, yaw = 0, yawT = 0, oxT = 0, oyT = 0, ox = 0, oy = 0, first = true;
      const clampZ = z => Math.max(0.75, Math.min(1.7, z));
      st.zoomBy = f => { zmT = clampZ(zmT * f); };
      st.reset = () => { zmT = 1; yaw = ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; yawT = 0; };
      st.fit = () => {
        const r = canvas.parentElement.getBoundingClientRect(), s = slot.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        renderer.setSize(W, H, false);
        cam.left = -W / 2; cam.right = W / 2; cam.top = H / 2; cam.bottom = -H / 2;
        zoomFit = Math.max(10, Math.min(s.width / 28, s.height / 17.5, 70));
        oxT = (s.left + s.width / 2) - (r.left + W / 2); oyT = (s.top + s.height / 2) - (r.top + H / 2) + zoomFit * 0.45;
        if (first && r.width > 1 && s.width > 1) { zoom = zoomFit * 0.86; ox = oxT; oy = oyT; first = false; }
      };
      const ro = new ResizeObserver(() => st.fit()); ro.observe(slot); ro.observe(hero); st.cleanup.push(() => ro.disconnect());
      let visible = true;
      const vio = new IntersectionObserver(es => { visible = es[0].isIntersecting; }); vio.observe(hero); st.cleanup.push(() => vio.disconnect());
      // pointer: hover, click, drag-rotate, pinch / ctrl-wheel zoom
      const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
      let px = 0, ptrOn = 0, hover = null, ptrDirty = false, cx = 0, cy = 0, drag = null, moved = false, pinch0 = 0, zm0 = 1;
      const ptrs = new Map();
      const pdist = () => { const a = Array.from(ptrs.values()); return Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); };
      const setCursor = () => { canvas.style.cursor = drag && moved ? 'grabbing' : hover ? 'pointer' : 'grab'; };
      const onMove = e => {
        if (e.pointerType === 'touch') return;
        const r = canvas.getBoundingClientRect(); cx = e.clientX - r.left; cy = e.clientY - r.top;
        px = cx / r.width * 2 - 1; ptrOn = 1; ptrDirty = true;
      };
      const onLeave = () => { ptrOn = 0; px = 0; hover = null; setCursor(); };
      const cast = () => {
        ndc.set(cx / W * 2 - 1, -(cy / H) * 2 + 1); ray.setFromCamera(ndc, cam);
        const h = ray.intersectObjects(pick, false)[0];
        hover = h ? h.object.userData.id : null; setCursor();
        if (ray.ray.intersectPlane(plane, hit)) { root.worldToLocal(hit); gMat.uniforms.uPtr.value.set(hit.x, hit.z); }
      };
      const onDown = e => {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = false;
        if (ptrs.size === 1) drag = { x: e.clientX, yaw: yawT };
        else if (ptrs.size === 2) { drag = null; pinch0 = pdist(); zm0 = zmT; moved = true; }
      };
      const onCMove = e => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (ptrs.size === 2 && pinch0 > 0) { zmT = clampZ(zm0 * pdist() / pinch0); return; }
        if (drag) { const dx = e.clientX - drag.x; if (Math.abs(dx) > 5) moved = true; if (moved) { yawT = drag.yaw + dx * 0.007; setCursor(); } }
      };
      const onUp = e => { ptrs.delete(e.pointerId); drag = null; pinch0 = 0; setCursor(); };
      const onClick = e => { if (moved) return; const r = canvas.getBoundingClientRect(); cx = e.clientX - r.left; cy = e.clientY - r.top; cast(); self.select(hover); };
      const onWheel = e => {
        const mod = e.ctrlKey || e.metaKey;
        const held = ptrs.size > 0;
        if (!held && !hero.contains(e.target)) return;
        if (!mod && !held && !self.state.explore) return;
        if (held) { e.preventDefault(); wheelAt = performance.now(); zmT = clampZ(zmT * Math.exp(-(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * (mod ? 0.01 : 0.0022))); return; }
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, next = clampZ(zmT * Math.exp(-dy * (mod ? 0.01 : 0.0022)));
        const now = performance.now(), inGesture = now - wheelAt < 450;
        if (!mod && next === zmT && !inGesture) return;
        wheelAt = now; e.preventDefault(); zmT = next;
      };
      let wheelAt = 0;
      hero.addEventListener('pointermove', onMove); hero.addEventListener('pointerleave', onLeave);
      canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onCMove); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
      canvas.addEventListener('click', onClick); window.addEventListener('wheel', onWheel, { passive: false });
      st.cleanup.push(() => {
        hero.removeEventListener('pointermove', onMove); hero.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onCMove); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('click', onClick); window.removeEventListener('wheel', onWheel);
      });
      const ease = x => { x = Math.max(0, Math.min(1, x)); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
      const sm = x => x * x * (3 - 2 * x);
      const hist = { rps: [], p99: [], err: [] };
      for (let i = 0; i < 40; i++) { hist.rps.push(0.9 + Math.sin(i * 0.35) * 0.06 + (Math.random() - 0.5) * 0.05); hist.p99.push(85 + Math.sin(i * 0.2) * 5 + (Math.random() - 0.5) * 6); hist.err.push(0.02 + (Math.random() < 0.12 ? 0.01 : 0)); }
      const spark = (ref, arr, lo, hi2) => {
        const el = ref.current; if (!el) return; let s = '';
        for (let i = 0; i < arr.length; i++) s += (i * 88 / (arr.length - 1)).toFixed(1) + ',' + (26 - Math.max(0, Math.min(1, (arr[i] - lo) / (hi2 - lo))) * 24).toFixed(1) + ' ';
        el.setAttribute('points', s);
      };
      const sparks = () => { spark(self.rpsSpark, hist.rps, 0.75, 1.05); spark(self.p99Spark, hist.p99, 68, 102); spark(self.errSpark, hist.err, 0, 0.05); };
      sparks();
      const order = ['gw', 'score', 'kafka', 'redis', 'pg', 'ch', 'enrich', 'queue', 'alert', 'web', 'mob', 'api'];
      let last = performance.now(), T = 0, RT = 0, lastLive = 0, lastHud = 0, pulse = 0, alarm = 0, frame = 0, beaconAt = 3.4, beaconI = 0, ringK = 1, ringS = 1;
      const counts = self.counts;
      const bump = id => { counts[id] = (counts[id] || 0) + 1; };
      const tick = now => {
        st.raf = requestAnimationFrame(tick);
        if (!visible || document.hidden) { last = now; return; }
        const rdt = Math.min(0.05, (now - last) / 1000); last = now;
        const calm = self.state.calm, dt = rdt * (calm ? 0.3 : 1);
        T += dt; RT += rdt; frame++;
        if (W <= 1 || (frame % 30 === 0 && Math.abs(canvas.clientWidth - W) > 1)) st.fit();
        zm += (zmT - zm) * Math.min(1, rdt * 9);
        zoom += (zoomFit * zm - zoom) * Math.min(1, rdt * 4); ox += (oxT - ox) * Math.min(1, rdt * 5); oy += (oyT - oy) * Math.min(1, rdt * 5);
        cam.zoom = zoom; cam.setViewOffset(W, H, -ox, -oy, W, H);
        const sc = Math.min(1, (self.scrollY || 0) / Math.max(1, H));
        yaw += (yawT + (calm || drag ? 0 : px * 0.04) - yaw) * Math.min(1, rdt * 7);
        root.rotation.y = yaw; root.position.y = -sc * 2; root.updateMatrixWorld();
        if (ptrDirty && frame % 2 === 0) { ptrDirty = false; cast(); }
        gMat.uniforms.uTime.value = T; dMat.uniforms.uTime.value = T; dMat.uniforms.uShift.value = yaw * 0.15;
        gMat.uniforms.uOn.value += ((calm ? 0 : ptrOn) - gMat.uniforms.uOn.value) * Math.min(1, rdt * 4);
        dg.setDrawRange(0, calm ? (DUST / 3) | 0 : DUST);
        pulse = Math.max(0, pulse - rdt * 1.6);
        alarm = Math.max(0, alarm - rdt * 1.1);
        warnMat.color.copy(cWarn).multiplyScalar(0.3 + 0.7 * alarm); warnMat.emissive.copy(cWarn).multiplyScalar(0.6 * alarm);
        const sel = self.state.sel;
        if (!self.touched && !calm && RT > beaconAt) {
          beaconAt = RT + 3.6; const bn = nodes[order[beaconI++ % order.length]];
          bn.hop = 1; ring.position.set(bn.def.x, 0.03, bn.def.z); ringS = bn.size; ringK = 0;
        }
        if (ringK < 1) { ringK = Math.min(1, ringK + rdt / 1.1); const q = 1 - Math.pow(1 - ringK, 3); ring.scale.setScalar(ringS * (1 + q * 0.9)); ringMat.opacity = 1 - ringK; ring.visible = true; }
        else ring.visible = false;
        for (const id in nodes) {
          const n = nodes[id], k = ease((RT - 0.15 - n.delay) / 0.8);
          n.g.scale.y = Math.max(0.001, k);
          n.hl += (((id === sel || id === hover) ? 1 : 0) - n.hl) * Math.min(1, rdt * 9);
          n.hop = Math.max(0, n.hop - rdt * 2.2);
          const lift = n.hl * 0.3;
          n.g.position.y = lift;
          n.em.color.copy(n.eb).lerp(cAcc, Math.max(n.hl, Math.sin(Math.PI * n.hop))); if (id === 'score') n.em.color.lerp(cWarn, pulse * (1 - n.hl));
          V.set(n.def.x, n.top * k + lift, n.def.z).applyMatrix4(root.matrixWorld).project(cam);
          n.sx = (V.x * 0.5 + 0.5) * W; n.sy = (-V.y * 0.5 + 0.5) * H;
          if (!n.lw || frame % 120 === 0) n.lw = n.el.offsetWidth || 90;
          const lx = Math.max(8, Math.min(W - n.lw - 8, n.sx - 6));
          n.el.style.transform = 'translate3d(' + lx.toFixed(1) + 'px,' + (n.sy - 22).toFixed(1) + 'px,0)';
          const lo = (n.sy < 150 ? 0 : 1) * ((zoomFit < 18 && !n.brand && id !== 'score' && n.hl < 0.5) ? 0 : 1) * Math.max(0, Math.min(1, (RT - 0.6 - n.delay) / 0.5));
          const los = lo.toFixed(2);
          if (n.el.style.opacity !== los) { n.el.style.opacity = los; n.el.style.pointerEvents = lo > 0.5 ? 'auto' : 'none'; }
          n.el.style.color = n.hl > 0.5 ? 'var(--acc)' : '';
        }
        const tn = sel && nodes[sel]; self.placeTip(tn ? [tn.sx, tn.sy] : null, W, H, frame);
        const intro = Math.max(0, Math.min(1, (RT - 1.5) / 1.2));
        let colDirty = false;
        for (let i = 0; i < EV; i++) {
          const e = evs[i], u = T / DUR + e.ph, cyc = Math.floor(u);
          if (cyc !== e.cyc) { if (e.cyc >= 0) { bump(e.dest); if (e.dest === 'alert' && intro > 0.5) alarm = 1; } e.cyc = cyc; spawn(e); bump(e.src); }
          const f = u - cyc, sf = f * 5, si = Math.min(4, sf | 0), kr = sf - si, k = streak ? sm(Math.max(0, Math.min(1, (kr - 0.2) / 0.6))) : sm(kr), a = e.p[si], b = e.p[si + 1];
          if (si !== e.st) {
            e.st = si; colDirty = true;
            if (streak) { V.set(b[0] - a[0], 0, b[2] - a[2]).normalize(); e.q = (e.q || new THREE.Quaternion()).setFromUnitVectors(XA, V); }
            ev.setColorAt(i, si < 3 ? cEv : e.flag ? cWarn : cAcc);
            if (si === 1) bump('gw'); else if (si === 2) { bump('enrich'); bump('redis'); bump('pg'); } else if (si === 4) bump('kafka');
            else if (si === 3) {
              bump('score'); if (e.flag) pulse = 1;
              if (scoreLive && intro > 0.5 && (e.flag || RT - lastLive > 0.7)) { lastLive = RT; scoreLive.textContent = ' · ' + e.score.toFixed(2) + (e.flag ? ' flag' : ''); scoreLive.style.color = e.flag ? 'var(--warn)' : 'var(--dim)'; }
            }
          }
          const s = Math.min(1, f * 18, (1 - f) * 18) * intro * (streak ? Math.min(1, k * 7, (1 - k) * 7) : 1);
          V.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
          if (streak) { const vis = s > 0.02 ? 1 : 0; S.set(Math.max(s, 0.001) * vis, vis, vis); M.compose(V, e.q || Q, S); } else { S.set(s, s, s); M.compose(V, Q, S); }
          ev.setMatrixAt(i, M);
        }
        ev.instanceMatrix.needsUpdate = true; if (colDirty && ev.instanceColor) ev.instanceColor.needsUpdate = true;
        pings.forEach(m => { const q = Math.abs(Math.sin(T * 1.8 + m.userData.ph)); m.position.set(-2.5 + (m.userData.ph > 2 ? 0.3 : -0.3), streak ? 0.1 : 0.5, m.userData.s * (1.5 + q * 3.2)); m.scale.set(intro, intro, intro * (streak ? Math.max(0.001, Math.min(1, q * 7, (1 - q) * 7)) : 1)); });
        if (RT - lastHud > 0.5) {
          lastHud = RT;
          const v1 = 0.9 + Math.sin(RT * 0.7) * 0.06 + (Math.random() - 0.5) * 0.05, v2 = 85 + Math.sin(RT * 0.4) * 5 + (Math.random() - 0.5) * 6, v3 = 0.02 + (Math.random() < 0.12 ? 0.01 : 0);
          hist.rps.push(v1); hist.rps.shift(); hist.p99.push(v2); hist.p99.shift(); hist.err.push(v3); hist.err.shift();
          const a = self.rpsRef.current, b = self.p99Ref.current, c = self.errRef.current, d = self.nodeCountRef.current;
          if (a) a.textContent = String(Math.round(v1 * 1000));
          if (b) b.textContent = Math.round(v2) + ' ms';
          if (c) c.textContent = v3.toFixed(2) + '%';
          if (d && sel) d.textContent = String(counts[sel] || 0);
          sparks();
        }
        renderer.render(scene, cam);
      };
      this.three = st; st.palette(this.state.theme); st.setLabels(this.props.showLabels ?? true); st.fit();
      st.raf = requestAnimationFrame(tick);
    }
    placeTip(pt, W, H, frame) {
      const tip = this.tipRef.current; if (!tip) return;
      const m = this._tip || (this._tip = { f: null, w: 300, h: 160 });
      if (!pt) { if (tip.style.visibility !== 'hidden') { tip.style.visibility = 'hidden'; m.f = null; } return; }
      const pos = this.tipPosRef.current, line = this.tipLineRef.current, sel = this.state.sel;
      if (m.f !== sel || frame % 20 === 0) { m.f = sel; m.w = pos.offsetWidth || 300; m.h = pos.offsetHeight || 160; }
      const ax = Math.round(pt[0]), ay = Math.round(pt[1]); let dx, dy;
      if (ay - m.h - 44 > 66) {
        dx = Math.max(12, Math.min(W - m.w - 12, ax - 28)) - ax; dy = -(m.h + 40);
        line.style.left = '0px'; line.style.top = '-40px'; line.style.width = '1px'; line.style.height = '40px';
      } else {
        const right = ax + 44 + m.w < W - 12;
        dx = right ? 44 : -(44 + m.w); dy = Math.max(66, Math.min(H - m.h - 12, ay - 24)) - ay;
        line.style.left = (right ? 0 : -44) + 'px'; line.style.top = '0px'; line.style.width = '44px'; line.style.height = '1px';
      }
      tip.style.transform = 'translate3d(' + ax + 'px,' + ay + 'px,0)';
      pos.style.transform = 'translate(' + Math.round(dx) + 'px,' + Math.round(dy) + 'px)';
      if (tip.style.visibility !== 'visible') tip.style.visibility = 'visible';
    }
    // second hero scene: a merge request travels CI -> RabbitMQ -> FastAPI -> ReAct loop -> GitLab
    initReview() {
      const THREE = window.THREE, self = this, canvas = this.canvasRef.current, slot = this.slotRef.current, hero = this.heroRef.current, labelLayer = this.labelsRef.current;
      const mobile = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
      let renderer;
      try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return; }
      renderer.setPixelRatio(dpr); renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -300, 300);
      cam.position.set(40, 33, 40); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
      const root = new THREE.Group(); scene.add(root);
      scene.add(new THREE.AmbientLight(0xffffff, 2.3));
      const dl = new THREE.DirectionalLight(0xffffff, 1.9); dl.position.set(-12, 30, 14); scene.add(dl);
      const C = k => new THREE.Color(k), B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
      const lam = k => new THREE.MeshLambertMaterial({ color: k }), flat = (k, o) => new THREE.MeshBasicMaterial(Object.assign({ color: k }, o || {}));
      const lineM = k => new THREE.LineBasicMaterial({ color: k });
      const cAcc = C(0), cWarn = C(0), cEdge = C(0), cEv = C(0), cDim = C(0), WHITE = C(0xffffff), BLACK = C(0);
      const aniso = renderer.capabilities.getMaxAnisotropy();
      let themeName = this.state.theme, pal = PAL.dark, alive = true;
      const st = { scene, renderer, raf: 0, cleanup: [() => { alive = false; }] };
      const sm = x => x * x * (3 - 2 * x), clamp01 = x => Math.max(0, Math.min(1, x));
      const ease = x => { x = clamp01(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
      const bounce = x => { const n1 = 7.5625, d1 = 2.75; if (x < 1 / d1) return n1 * x * x; if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75; if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375; return n1 * (x -= 2.625 / d1) * x + 0.984375; };
      const mkTex = (cw, ch) => { const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso; return { tex, ctx: cv.getContext('2d'), cw, ch }; };
      const mkDecal = (w, h, cw, ch) => { const t = mkTex(cw, ch); t.m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, depthWrite: false })); t.m.rotation.x = -Math.PI / 2; return t; };
      // floor captions: white glyphs in the texture, tinted through material.color
      const texts = [];
      const floorText = (txt, x, z, rot) => {
        const w = txt.length * 0.168 + 0.2, d = mkDecal(w, 0.5, Math.round(w * 90), 45); d.txt = txt;
        d.m.position.set(x + (rot ? 0 : w / 2), 0.025, z - (rot ? w / 2 : 0)); if (rot) d.m.rotation.z = Math.PI / 2; root.add(d.m); texts.push(d); return d;
      };
      const drawText = d => { const c = d.ctx; c.clearRect(0, 0, d.cw, d.ch); c.fillStyle = '#ffffff'; c.font = "500 25px 'IBM Plex Mono',monospace"; c.textBaseline = 'middle'; c.fillText(d.txt, 6, d.ch / 2 + 1); d.tex.needsUpdate = true; };
      const boxMat = lam(0), ownMat = lam(0), paperMat = flat(0xffffff), linkMat = lineM(0), zoneMat = lineM(0);
      const dashMat = new THREE.LineDashedMaterial({ color: 0, dashSize: 0.28, gapSize: 0.2 });
      const brandMat = { rq: lam(0xff6600), rapi: lam(0x009688), rgl: lam(0x3b2f7d), rA: lam(0xc8392b), rB: lam(0x3776ab), rC: lam(0xf7df1e), rllm: lam(0x0a5fb4) };
      // nodes
      const nodes = {}, pick = [], PLY = 0.3;
      RNODES.forEach(n => {
        const g = new THREE.Group(); g.position.set(n.x, 0, n.z); root.add(g);
        const em = lineM(0x5d6a5b); let top = 0, mat = boxMat, ds = 0, dx = 0;
        const add = (geo, y, m, z) => {
          const mesh = new THREE.Mesh(geo, m); mesh.position.set(0, y, z || 0); g.add(mesh);
          const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), em); e.position.copy(mesh.position); g.add(e);
          mesh.userData.id = n.id; pick.push(mesh); geo.computeBoundingBox(); top = Math.max(top, y + geo.boundingBox.max.y);
        };
        switch (n.id) {
          case 'rA': case 'rB': case 'rC': mat = brandMat[n.id]; add(B(1.4, 1.3, 1.4), 0.65, mat); ds = 1.1; break;
          case 'rq': mat = brandMat.rq; add(B(4.6, 0.3, 1.7), 0.15, mat); ds = 1.25; dx = -1.55; break;
          case 'rapi': mat = brandMat.rapi; for (let i = 0; i < 4; i++) add(B(2.2, 0.4, 2.4), 0.2 + i * 0.4, mat); ds = 1.85; break;
          case 'ragent': mat = ownMat; add(new THREE.CylinderGeometry(3.1, 3.1, 0.35, 64), 0.175, mat); break;
          case 'rllm': mat = brandMat.rllm; add(B(3, 0.25, 2.5), 0.125, mat); break;
          case 'rmG': case 'rmS': case 'rmC': case 'rmU': mat = ownMat; add(B(1.6, 1.2, 1.6), 0.6, mat); ds = 1.3; break;
          case 'rgl': mat = brandMat.rgl; add(B(2.8, PLY, 14.4), PLY / 2, mat, 5.9); ds = 1.5; break; // platform under the repositories
          default: for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.95, 0.95, 0.44, 32), 0.22 + i * 0.53, boxMat); ds = 1.35;
        }
        let decal = null, side = null;
        if (ds) { decal = mkDecal(ds, ds, 256, 256); decal.m.position.set(dx, top + 0.015, 0); g.add(decal.m); }
        // MCP servers carry their domain icon on the front face
        if (n.id[1] === 'm') { side = mkDecal(1.05, 1.05, 256, 256); side.m.rotation.x = 0; side.m.position.set(0, 0.6, 0.805); g.add(side.m); }
        if (n.id === 'ragent') top = 2; else if (n.id === 'rllm') top = 2.7; else if (n.id === 'rq') top = 1.1;
        const el = document.createElement('button');
        el.type = 'button';
        el.style.cssText = "position:absolute;left:0;top:0;pointer-events:auto;cursor:pointer;background:color-mix(in srgb,var(--bg) 72%,transparent);border:0;border-radius:4px;padding:3px 7px;margin:0;font:500 11px/1.25 'IBM Plex Mono',monospace;color:var(--ink);text-align:left;white-space:nowrap;will-change:transform;opacity:0";
        const dot = document.createElement('span'); dot.style.cssText = 'display:inline-block;width:5px;height:5px;background:var(--acc);margin-right:6px;vertical-align:middle';
        el.append(dot, n.short || n.name);
        let live = null;
        if (n.id === 'ragent') { live = document.createElement('span'); live.style.cssText = 'display:block;min-width:26ch;color:var(--dim)'; el.style.textAlign = 'right'; el.append(live); }
        el.addEventListener('click', () => self.select(n.id));
        labelLayer.append(el);
        nodes[n.id] = { def: n, g, em, eb: C(0), el, live, hl: 0, flash: 0, fl: 0, top: top + 0.3, mat, decal, side, sx: 0, sy: 0, delay: (n.x + 14) / 27.2 * 1.1, lift: n.id !== 'ragent' && n.id !== 'rq' && n.id !== 'rllm' && n.id !== 'rgl', by: n.id[1] <= 'C' ? PLY : 0 };
      });
      const drawDecal = n => {
        const id = n.def.id, light = themeName === 'light', ink = light ? '#16181a' : '#ffffff';
        const paint = (d, kind, col) => {
          const c = d.ctx; c.clearRect(0, 0, 256, 256); c.fillStyle = c.strokeStyle = col; c.lineCap = c.lineJoin = 'round';
          const icon = (key, s, y) => { c.save(); c.translate(128 - s / 2, (y || 128) - s / 2); c.scale(s / 24, s / 24); c.fill(new Path2D(RICON[key])); c.restore(); };
          const bar = (x, y, w, h) => { c.beginPath(); c.moveTo(x + 8, y); c.arcTo(x + w, y, x + w, y + h, 8); c.arcTo(x + w, y + h, x, y + h, 8); c.arcTo(x, y + h, x, y, 8); c.arcTo(x, y, x + w, y, 8); c.fill(); };
          if (kind === 'cup') { // steaming cup
            bar(66, 118, 112, 82); bar(48, 210, 150, 16); c.lineWidth = 16; c.beginPath(); c.arc(180, 152, 24, -Math.PI / 2, Math.PI / 2); c.stroke();
            c.lineWidth = 12; [100, 140].forEach(x => { c.beginPath(); c.moveTo(x, 98); c.bezierCurveTo(x - 16, 80, x + 16, 66, x, 46); c.stroke(); });
          } else if (kind === 'lock') { // padlock
            c.translate(128, 128); c.scale(1.22, 1.22); c.translate(-128, -134);
            c.lineWidth = 22; c.beginPath(); c.moveTo(90, 118); c.lineTo(90, 92); c.arc(128, 92, 38, Math.PI, 0); c.lineTo(166, 118); c.stroke();
            bar(62, 112, 132, 104); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(128, 154, 15, 0, Math.PI * 2); c.fill(); c.fillRect(121, 156, 14, 32); c.globalCompositeOperation = 'source-over'; c.setTransform(1, 0, 0, 1, 0, 0);
          } else if (kind === 'ui') { // interface components
            bar(48, 48, 72, 72); bar(136, 48, 72, 72); bar(48, 136, 72, 72); c.beginPath(); c.arc(172, 172, 37, 0, Math.PI * 2); c.fill();
          } else if (kind === 'style') { // indented code lines that pass a check
            bar(46, 58, 150, 22); bar(80, 104, 118, 22); bar(80, 150, 60, 22); bar(46, 196, 70, 22);
            c.lineWidth = 22; c.beginPath(); c.moveTo(150, 184); c.lineTo(174, 208); c.lineTo(214, 152); c.stroke();
          } else if (kind === 'api') { icon('rapi', 120, 90); c.font = "600 46px 'Golos Text',system-ui,sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FastAPI', 128, 200); }
          else icon(kind, kind === 'mcp' ? 170 : 176);
          d.tex.needsUpdate = true;
        };
        const dom = { rmG: 'rgl', rmS: 'lock', rmC: 'style', rmU: 'ui' }[id];
        if (n.side) paint(n.side, dom, ink);
        if (!n.decal) return;
        if (id === 'rq') paint(n.decal, 'rq', '#ffffff'); else if (id === 'rgl') paint(n.decal, 'rgl', '#fc6d26'); else if (id === 'rapi') paint(n.decal, 'api', '#ffffff');
        else if (id === 'rA') paint(n.decal, 'cup', '#ffffff'); else if (id === 'rB') paint(n.decal, 'py', '#ffd43b'); else if (id === 'rC') paint(n.decal, 'js', '#16181a');
        else if (dom) paint(n.decal, 'mcp', ink); else paint(n.decal, { rsec: 'lock', rsty: 'style', rui: 'ui' }[id], light ? '#16181a' : '#eef1ea');
      };
      // links, zones, island
      const D = id => nodes[id].def, RX = D('ragent').x, RR = 4, LZ = D('rllm').z, MCP = ['rmG', 'rmS', 'rmC', 'rmU'], BACK = ['rgl', 'rsec', 'rsty', 'rui'], NM = MCP.length;
      const ringPt = j => { const m = D(MCP[j]), a = Math.atan2(m.z, m.x - RX); return [RX + RR * Math.cos(a), 0.3, RR * Math.sin(a)]; };
      // only the conveyor from the queue to the agent runs on the floor; every other hop is an arc
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute([D('rq').x + 2.3, 0.02, 0, RX - RR, 0.02, 0], 3)); root.add(new THREE.LineSegments(lg, linkMat));
      const loop = (pts, m) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const l = new THREE.LineLoop(g, m); if (m.isLineDashedMaterial) l.computeLineDistances(); root.add(l); return l; };
      const rect = (x0, z0, x1, z1) => [x0, 0.02, z0, x1, 0.02, z0, x1, 0.02, z1, x0, 0.02, z1];
      loop(rect(RX - RR - 0.7, -7.9, 10.4, 7.4), zoneMat);
      loop(rect(RX - 2, LZ - 1.75, RX + 2, LZ + 1.75), dashMat);
      { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([RX, 0.02, -RR, RX, 0.02, LZ + 1.25], 3)); const l = new THREE.Line(g, dashMat); l.computeLineDistances(); root.add(l); }
      floorText('REVIEWER AGENT · LangGraph + FastMCP', RX - RR - 0.6, 7.85);
      // loop stations: crisp HTML chips on the ring, the active one lights up
      const stations = [['think', -Math.PI / 2], ['act', -0.63], ['observe', Math.PI / 2]].map(s => {
        const el = document.createElement('span'); el.textContent = s[0];
        el.style.cssText = "position:absolute;left:0;top:0;padding:2px 6px;border-radius:3px;font:500 10px/1.3 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;will-change:transform;opacity:0;transition:background .3s,color .3s";
        labelLayer.append(el); return { el, a: s[1], ta: s[1], o: 1, on: -1 };
      });
      // ground + dust (same look as the first scene)
      const gMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, extensions: { derivatives: true },
        uniforms: { uLine: { value: C(0x39443a) }, uAcc: { value: C(0xb9f24e) }, uPtr: { value: new THREE.Vector2(99, 99) }, uTime: { value: 0 }, uOn: { value: 0 } },
        vertexShader: 'varying vec2 vW; void main(){ vW=vec2(position.x,-position.y); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying vec2 vW; uniform vec3 uLine,uAcc; uniform vec2 uPtr; uniform float uTime,uOn;\nfloat grid(vec2 p){ vec2 g=abs(fract(p-0.5)-0.5)/fwidth(p); return 1.0-min(min(g.x,g.y),1.0); }\nvoid main(){ float d=length(vW*vec2(0.6,1.0)); float fade=smoothstep(27.0,6.0,d); float g=grid(vW)*0.45+grid(vW*0.2)*0.55; float pd=length(vW-uPtr); float rip=uOn*(smoothstep(4.5,0.0,pd)*0.7+0.6*smoothstep(0.4,0.0,abs(pd-mod(uTime*3.2,10.0)))*smoothstep(10.0,1.5,pd)); float k=clamp(rip,0.0,1.0); gl_FragColor=vec4(mix(uLine,uAcc,k),g*fade*(0.5+k)); }'
      });
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), gMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; root.add(ground);
      const DUST = mobile ? 180 : 520, dp = new Float32Array(DUST * 3), ds2 = new Float32Array(DUST);
      for (let i = 0; i < DUST; i++) { dp[i * 3] = Math.random() * 2 - 1; dp[i * 3 + 1] = Math.random() * 2 - 1; dp[i * 3 + 2] = 0; ds2[i] = Math.random(); }
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('aSeed', new THREE.BufferAttribute(ds2, 1));
      const dMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: { value: 0 }, uShift: { value: 0 }, uSize: { value: 1.5 * dpr }, uColor: { value: C(0xa9b4a7) } },
        vertexShader: 'uniform float uTime,uShift,uSize; attribute float aSeed; varying float vA;\nvoid main(){ float d=0.35+aSeed*0.65; vec2 p=position.xy; p.x=mod(p.x+uTime*0.012*d+uShift*d+1.0,2.0)-1.0; p.y=mod(p.y-uTime*0.006*d+1.0,2.0)-1.0; float edge=smoothstep(1.0,0.82,abs(p.x))*smoothstep(1.0,0.82,abs(p.y)); vA=(0.18+0.42*aSeed)*(0.75+0.25*sin(uTime*0.8+aSeed*50.0))*edge; gl_Position=vec4(p,0.999,1.0); gl_PointSize=uSize*(0.7+aSeed*0.9); }',
        fragmentShader: 'uniform vec3 uColor; varying float vA;\nvoid main(){ gl_FragColor=vec4(uColor,vA); }'
      });
      const dust = new THREE.Points(dg, dMat); dust.frustumCulled = false; dust.renderOrder = -10; scene.add(dust);
      // the loop: ring, comet trail, bead
      const ringBase = new THREE.Mesh(new THREE.RingGeometry(RR - 0.04, RR + 0.04, 96), flat(0, { transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
      ringBase.rotation.x = -Math.PI / 2; ringBase.position.set(RX, 0.03, 0); root.add(ringBase);
      const trailMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uHead: { value: 0 }, uOn: { value: 0 }, uColor: { value: C(0) } },
        vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying vec2 vP; uniform float uHead,uOn; uniform vec3 uColor;\nvoid main(){ float a=atan(-vP.y,vP.x); float d=mod(uHead-a,6.2831853); float k=pow(max(0.0,1.0-d/2.8),2.0); gl_FragColor=vec4(uColor,k*uOn); }'
      });
      const trail = new THREE.Mesh(new THREE.RingGeometry(RR - 0.13, RR + 0.13, 128), trailMat); trail.rotation.x = -Math.PI / 2; trail.position.set(RX, 0.04, 0); root.add(trail);
      const glowT = mkTex(64, 64);
      { const g = glowT.ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); glowT.ctx.fillStyle = g; glowT.ctx.fillRect(0, 0, 64, 64); glowT.tex.needsUpdate = true; }
      const glows = [];
      const mkSpark = r => {
        const g = new THREE.Group(), core = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), flat(0xffffff));
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT.tex, transparent: true, depthWrite: false })); sp.scale.setScalar(r * 9);
        g.add(core); g.add(sp); g.visible = false; root.add(g); glows.push(sp); return { g, core, sp };
      };
      const bead = mkSpark(0.17), sLlm = mkSpark(0.13), sTool = mkSpark(0.13);
      // soft burst of the bead when the last lap of a review is done
      const burstG = new THREE.Group(); burstG.visible = false; root.add(burstG);
      const bFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT.tex, transparent: true, depthWrite: false })); burstG.add(bFlash); glows.push(bFlash);
      const bRing = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48), flat(0, { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); bRing.rotation.x = -Math.PI / 2; burstG.add(bRing);
      const bParts = [];
      for (let i = 0; i < 10; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT.tex, transparent: true, depthWrite: false })), a = i / 10 * Math.PI * 2 + Math.random() * 0.4;
        s.userData = { x: Math.cos(a), z: Math.sin(a), up: 0.3 + Math.random() * 0.9, r: 0.9 + Math.random() * 0.7 }; burstG.add(s); glows.push(s); bParts.push(s);
      }
      let burstT = 1, beadK = 1;
      // tool-call arcs (0..2 = MCP servers) and the LLM call path (3)
      const QX = D('rq').x + 2, QS = 0.44, QY = 0.675, slotX = i => QX - i * QS;
      const bez = (a, b, h, t, o) => { const u = 1 - t; return o.set(a[0] + (b[0] - a[0]) * t, u * u * a[1] + 2 * u * t * h + t * t * b[1], a[2] + (b[2] - a[2]) * t); };
      const topOf = id => [D(id).x, nodes[id].top - 0.25, D(id).z];
      // arcs: 0..NM-1 agent -> MCP server, NM agent -> LLM, NM+1..2NM MCP server -> its backend, then repository -> queue
      const arcPt = (j, t, o) => {
        if (j < NM) return bez(ringPt(j), topOf(MCP[j]), 3.8, t, o);
        if (j === NM) return o.set(RX, 0.3 + 1.4 * t + Math.sin(Math.PI * t) * 1.3, -RR + (LZ + RR) * t);
        if (j <= 2 * NM) return bez(topOf(MCP[j - NM - 1]), topOf(BACK[j - NM - 1]), j === NM + 1 ? 5.4 : 3.6, t, o);
        const r = D(['rA', 'rB', 'rC'][j - 2 * NM - 1]); o.set(r.x + (slotX(4) - r.x) * t, 1.7 + PLY + (QY - 1.7 - PLY) * t + Math.sin(Math.PI * t) * 1.5, r.z * (1 - t)); return o;
      };
      const V = new THREE.Vector3();
      const arcs = Array.from({ length: 2 * NM + 4 }, (x, j) => j).map(j => {
        const p = []; for (let i = 0; i <= 28; i++) { arcPt(j, i / 28, V); p.push(V.x, V.y, V.z); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0, transparent: true, opacity: 0.5 })); root.add(l); return { l, k: 0, s: 0 };
      });
      // corporate LLM: a core floating over its own island
      const llm = new THREE.Group(); llm.position.set(RX, 1.7, LZ); root.add(llm);
      const llmWire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.95, 1), 1), lineM(0)); llm.add(llmWire);
      const llmCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), flat(0)); llmCore.userData.id = 'rllm'; pick.push(llmCore); llm.add(llmCore);
      const llmGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT.tex, transparent: true, depthWrite: false })); llmGlow.scale.setScalar(4.2); llm.add(llmGlow); glows.push(llmGlow);
      const llmRing = new THREE.Mesh(new THREE.RingGeometry(0.86, 0.96, 48), flat(0, { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); llmRing.rotation.x = -Math.PI / 2; llmRing.position.set(RX, 0.27, LZ); root.add(llmRing);
      // review card on the turntable
      const CW = 4, CD = 2.8, ROW = 44, HEAD = 52;
      const cardG = new THREE.Group(); cardG.position.set(RX, 0.35, 0); cardG.visible = false; root.add(cardG);
      const cardGeo = B(CW, 0.08, CD), cardBody = new THREE.Mesh(cardGeo, paperMat); cardBody.position.y = 0.04; cardBody.userData.id = 'ragent'; pick.push(cardBody); cardG.add(cardBody);
      const cardEdge = new THREE.LineSegments(new THREE.EdgesGeometry(cardGeo), lineM(0)); cardEdge.position.y = 0.04; cardG.add(cardEdge);
      const cardT = mkTex(640, 448), cardTop = new THREE.Mesh(new THREE.PlaneGeometry(CW, CD), new THREE.MeshBasicMaterial({ map: cardT.tex })); cardTop.rotation.x = -Math.PI / 2; cardTop.position.y = 0.085; cardG.add(cardTop);
      const scan = new THREE.Mesh(B(CW, 0.014, 0.07), flat(0, { transparent: true, opacity: 0.9 })); scan.position.y = 0.1; scan.visible = false; cardG.add(scan);
      const pins = [0, 1, 2].map(() => {
        const g = new THREE.Group(), m = flat(0xffffff);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.58, 6), m); stem.position.y = 0.29; g.add(stem);
        const head = new THREE.Mesh(B(0.52, 0.38, 0.12), m); head.position.y = 0.76; g.add(head);
        g.visible = false; cardG.add(g); return { g, m, t: 1, y: 0 };
      });
      let cur = null, shown = -1;
      const drawCard = () => {
        if (!cur) return; const c = cardT.ctx, light = themeName === 'light', d = cur.diff;
        const ink = light ? '#e8ece6' : '#1a1e1b', dim = light ? '#8d978c' : '#7b847a';
        c.fillStyle = light ? '#1b211b' : '#f4f5f0'; c.fillRect(0, 0, 640, 448);
        c.fillStyle = light ? '#262d26' : '#e3e6de'; c.fillRect(0, 0, 640, HEAD);
        c.font = "500 22px 'IBM Plex Mono',monospace"; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = dim; c.fillText(d.file, 18, HEAD / 2 + 1);
        c.textAlign = 'right'; c.fillText('!' + cur.mr, 622, HEAD / 2 + 1); c.textAlign = 'left';
        shown = Math.ceil(cur.reveal * d.lines.length);
        for (let i = 0; i < shown; i++) {
          const y = HEAD + i * ROW, m = d.lines[i][0], note = cur.marks[i];
          if (m !== ' ') { c.fillStyle = m === '+' ? 'rgba(46,160,67,.22)' : 'rgba(248,81,73,.2)'; c.fillRect(0, y, 640, ROW); }
          if (note) { c.strokeStyle = c.fillStyle = '#' + (note === 'sec' ? cWarn : cAcc).getHexString(); c.lineWidth = 3; c.strokeRect(1.5, y + 1.5, 637, ROW - 3); c.fillRect(0, y, 9, ROW); }
          c.fillStyle = m === '+' ? (light ? '#6fd08c' : '#1f8a3b') : m === '-' ? (light ? '#ff8f85' : '#cf3b33') : dim; c.fillText(m, 20, y + ROW / 2 + 1);
          c.fillStyle = ink; c.fillText(d.lines[i][1], 44, y + ROW / 2 + 1);
        }
        cardT.tex.needsUpdate = true;
      };
      // queued merge requests: upright mini cards on the RabbitMQ tray
      const chipT = mkTex(64, 64), chipMat = new THREE.MeshBasicMaterial({ map: chipT.tex }), chipGeo = B(1, 1, 1), chipEdgeGeo = new THREE.EdgesGeometry(chipGeo), chipEdgeMat = lineM(0);
      const drawChip = () => {
        const c = chipT.ctx, light = themeName === 'light'; c.fillStyle = light ? '#1b211b' : '#f4f5f0'; c.fillRect(0, 0, 64, 64);
        [['#7b847a', 30], ['#cf3b33', 40], ['#1f8a3b', 46], ['#1f8a3b', 34], ['#7b847a', 24]].forEach((r, i) => { c.fillStyle = r[0]; c.fillRect(9, 10 + i * 10, r[1], 4); });
        chipT.tex.needsUpdate = true;
      };
      const free = [], q = [];
      const mkChip = () => { let m = free.pop(); if (!m) { m = new THREE.Mesh(chipGeo, chipMat); m.add(new THREE.LineSegments(chipEdgeGeo, chipEdgeMat)); root.add(m); } m.visible = true; m.scale.set(0.1, 0.75, 1.1); return m; };
      const counts = self.counts, bump = id => { counts[id] = (counts[id] || 0) + 1; };
      let mrNo = 481, toolCalls = 0;
      const spawnMR = (src, at) => {
        if (q.length >= 8) return;
        const n = nodes[src].def, c = { m: mkChip(), t: 0, st: 'fly', from: [n.x, 1.7 + PLY, n.z], x: 0, mr: mrNo++, src };
        if (at !== undefined) { c.st = 'wait'; c.x = slotX(at); c.m.position.set(c.x, QY, 0); } else { nodes[src].flash = 1; bump(src); }
        q.push(c);
      };
      // agent state machine: idle -> load -> run (N laps) -> ship
      const AX = D('rapi').x, A_T = Math.PI * 1.5, A_O = Math.PI * 2.5, BV = 1.81, WAIT = 0.09, LW = 0.22;
      // flight time of every arc at one constant speed (world units per second), within sane bounds
      const DUR = arcs.map((a, j) => { const p = new THREE.Vector3(), q = new THREE.Vector3(); let len = 0; arcPt(j, 0, p); for (let i = 1; i <= 16; i++) { arcPt(j, i / 16, q); len += p.distanceTo(q); p.copy(q); } return Math.max(0.26, Math.min(0.62, len / 14)); });
      // unwrapped angle of each server's ring point, between π and 3π
      const DOCK = MCP.map(id => Math.atan2(D(id).z, D(id).x - RX) + Math.PI * 2);
      let ph = 'idle', pt = 0, stepI = 0, sp = 0, runTh = Math.PI, moving = 0, fired = 0, trailOn = 0, llmK = 0, llmS = 0, beadS = 0.7, liveTxt = '';
      const mkRun = (mr, src) => {
        const list = RDIFFS[src], d = list[(Math.random() * list.length) | 0], steps = [], seen = {};
        d.notes.slice(0, 2).forEach(nt => { if (!seen[nt.k]) { seen[nt.k] = 1; steps.push(nt.k === 'sec' ? { tool: 'security.search', j: 1 } : nt.k === 'ui' ? { tool: 'uikit.search', j: 3 } : { tool: 'style.search', j: 2 }); } steps.push({ tool: 'gitlab.comment :' + (nt.l + 1), j: 0, note: nt }); });
        if (!steps.length) steps.push({ tool: 'style.search', j: 2 });
        return { diff: d, mr, src, reveal: 0, marks: {}, steps, noteN: 0, calls: 0, first: 0 };
      };
      const startLoad = () => {
        const c = q.shift(); c.t = 0; c.from = [c.x, QY, 0]; cur = mkRun(c.mr, c.src); cur.chip = c;
        ph = 'load'; pt = 0; nodes.rapi.flash = 1; bump('rq'); bump('rapi');
      };
      const once = bit => { if (fired & bit) return false; fired |= bit; return true; };
      st.palette = th => {
        themeName = th; pal = PAL[th] || PAL.dark; const light = th === 'light';
        boxMat.color.set(pal.box); ownMat.color.set(pal.own); linkMat.color.set(pal.link); zoneMat.color.set(pal.edge); dashMat.color.set(pal.edge); paperMat.color.set(light ? 0x1b211b : 0xf4f5f0);
        gMat.uniforms.uLine.value.set(pal.grid); gMat.uniforms.uAcc.value.set(pal.acc); dMat.uniforms.uColor.value.set(pal.dust);
        cAcc.set(pal.acc); cWarn.set(pal.warn); cEdge.set(pal.edge); cEv.set(pal.ev); cDim.set(light ? 0x535d53 : 0xa2aba1);
        ringBase.material.color.set(pal.edge); trailMat.uniforms.uColor.value.set(pal.acc); scan.material.color.set(pal.acc);
        cardEdge.material.color.set(pal.edge); chipEdgeMat.color.set(pal.edge); llmWire.material.color.set(light ? 0x0a5fb4 : 0xe6f0ff);
        [bead, sTool].forEach(s => { s.core.material.color.set(pal.acc); s.sp.material.color.set(pal.acc); });
        [bFlash, bRing].concat(bParts).forEach(o => o.material.color.set(pal.acc));
        [sLlm.core, sLlm.sp, llmGlow, llmRing].forEach(o => o.material.color.set(light ? 0x0a5fb4 : 0x9cc8ff));
        glows.forEach(s => { s.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending; s.material.needsUpdate = true; });
        for (const id in nodes) {
          const n = nodes[id];
          if (n.mat === boxMat) n.eb.copy(cEdge); else n.eb.copy(n.mat.color).lerp(n.mat === ownMat && light ? BLACK : WHITE, id === 'rllm' ? 0.85 : 0.45);
          drawDecal(n);
        }
        texts.forEach(d => { d.m.material.color.copy(cDim); drawText(d); }); drawChip(); drawCard();
      };
      st.redraw = () => { if (!alive) return; for (const id in nodes) drawDecal(nodes[id]); texts.forEach(drawText); drawCard(); };
      st.setLabels = on => { labelLayer.style.display = on ? '' : 'none'; };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => st.redraw());
      // camera fit and pointer handling (mirrors the first scene)
      let W = 1, H = 1, zoomFit = 30, zoom = 30, zm = 1, zmT = 1, yaw = 0, yawT = 0, oxT = 0, oyT = 0, ox = 0, oy = 0, first = true;
      const clampZ = z => Math.max(0.75, Math.min(1.7, z));
      st.zoomBy = f => { zmT = clampZ(zmT * f); };
      st.reset = () => { zmT = 1; yaw = ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; yawT = 0; };
      st.fit = () => {
        const r = canvas.parentElement.getBoundingClientRect(), s = slot.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        renderer.setSize(W, H, false);
        cam.left = -W / 2; cam.right = W / 2; cam.top = H / 2; cam.bottom = -H / 2;
        zoomFit = Math.max(10, Math.min(s.width / 28, s.height / 17.5, 70));
        oxT = (s.left + s.width / 2) - (r.left + W / 2); oyT = (s.top + s.height / 2) - (r.top + H / 2) + zoomFit * 0.45;
        if (first && r.width > 1 && s.width > 1) { zoom = zoomFit * 0.86; ox = oxT; oy = oyT; first = false; }
      };
      const ro = new ResizeObserver(() => st.fit()); ro.observe(slot); ro.observe(hero); st.cleanup.push(() => ro.disconnect());
      let visible = true;
      const vio = new IntersectionObserver(es => { visible = es[0].isIntersecting; }); vio.observe(hero); st.cleanup.push(() => vio.disconnect());
      const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
      let px = 0, ptrOn = 0, hover = null, ptrDirty = false, cx = 0, cy = 0, drag = null, moved = false, pinch0 = 0, zm0 = 1, wheelAt = 0;
      const ptrs = new Map();
      const pdist = () => { const a = Array.from(ptrs.values()); return Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); };
      const setCursor = () => { canvas.style.cursor = drag && moved ? 'grabbing' : hover ? 'pointer' : 'grab'; };
      const onMove = e => { if (e.pointerType === 'touch') return; const r = canvas.getBoundingClientRect(); cx = e.clientX - r.left; cy = e.clientY - r.top; px = cx / r.width * 2 - 1; ptrOn = 1; ptrDirty = true; };
      const onLeave = () => { ptrOn = 0; px = 0; hover = null; setCursor(); };
      const cast = () => {
        ndc.set(cx / W * 2 - 1, -(cy / H) * 2 + 1); ray.setFromCamera(ndc, cam);
        const h = ray.intersectObjects(pick, false)[0]; hover = h ? h.object.userData.id : null; setCursor();
        if (ray.ray.intersectPlane(plane, hit)) { root.worldToLocal(hit); gMat.uniforms.uPtr.value.set(hit.x, hit.z); }
      };
      const onDown = e => {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = false;
        if (ptrs.size === 1) drag = { x: e.clientX, yaw: yawT }; else if (ptrs.size === 2) { drag = null; pinch0 = pdist(); zm0 = zmT; moved = true; }
      };
      const onCMove = e => {
        if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (ptrs.size === 2 && pinch0 > 0) { zmT = clampZ(zm0 * pdist() / pinch0); return; }
        if (drag) { const dx = e.clientX - drag.x; if (Math.abs(dx) > 5) moved = true; if (moved) { yawT = drag.yaw + dx * 0.007; setCursor(); } }
      };
      const onUp = e => { ptrs.delete(e.pointerId); drag = null; pinch0 = 0; setCursor(); };
      const onClick = e => {
        if (moved) return; const r = canvas.getBoundingClientRect(); cx = e.clientX - r.left; cy = e.clientY - r.top; cast();
        if (hover === 'rA' || hover === 'rB' || hover === 'rC') spawnMR(hover);
        self.select(hover);
      };
      const onWheel = e => {
        const mod = e.ctrlKey || e.metaKey, held = ptrs.size > 0;
        if (!held && !hero.contains(e.target)) return;
        if (!mod && !held && !self.state.explore) return;
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, next = clampZ(zmT * Math.exp(-dy * (mod ? 0.01 : 0.0022))), now = performance.now();
        if (held) { e.preventDefault(); wheelAt = now; zmT = next; return; }
        if (!mod && next === zmT && now - wheelAt >= 450) return;
        wheelAt = now; e.preventDefault(); zmT = next;
      };
      hero.addEventListener('pointermove', onMove); hero.addEventListener('pointerleave', onLeave);
      canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onCMove); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
      canvas.addEventListener('click', onClick); window.addEventListener('wheel', onWheel, { passive: false });
      st.cleanup.push(() => {
        hero.removeEventListener('pointermove', onMove); hero.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onCMove); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('click', onClick); window.removeEventListener('wheel', onWheel);
      });
      // HUD: queue depth, loop step, notes on the current merge request
      const hist = [[], [], []]; for (let i = 0; i < 40; i++) { hist[0].push(3); hist[1].push(0); hist[2].push(0); }
      const spark = (ref, arr, hi2) => { const el = ref.current; if (!el) return; let s = ''; for (let i = 0; i < arr.length; i++) s += (i * 88 / (arr.length - 1)).toFixed(1) + ',' + (26 - clamp01(arr[i] / hi2) * 24).toFixed(1) + ' '; el.setAttribute('points', s); };
      for (let i = 0; i < 3; i++) spawnMR(['rB', 'rA', 'rC'][i], i);
      cur = mkRun(mrNo++, 'rB'); cur.reveal = 1; ph = 'run'; stepI = cur.first = Math.min(1, cur.steps.length - 1); sp = 2.6; cardG.visible = true; cardG.scale.setScalar(0.001); drawCard();
      let last = performance.now(), T = 0, RT = 0, frame = 0, lastHud = -1, nextSpawn = 9;
      const tick = now => {
        st.raf = requestAnimationFrame(tick);
        if (!visible || document.hidden) { last = now; return; }
        const rdt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
        const calm = self.state.calm, dt = rdt * (calm ? 0.3 : 1);
        T += dt; RT += rdt; frame++;
        if (W <= 1 || (frame % 30 === 0 && Math.abs(canvas.clientWidth - W) > 1)) st.fit();
        zm += (zmT - zm) * Math.min(1, rdt * 9);
        zoom += (zoomFit * zm - zoom) * Math.min(1, rdt * 4); ox += (oxT - ox) * Math.min(1, rdt * 5); oy += (oyT - oy) * Math.min(1, rdt * 5);
        cam.zoom = zoom; cam.setViewOffset(W, H, -ox, -oy, W, H);
        const sc = Math.min(1, (self.scrollY || 0) / Math.max(1, H));
        yaw += (yawT + (calm || drag ? 0 : px * 0.04) - yaw) * Math.min(1, rdt * 7);
        root.rotation.y = yaw; root.position.y = -sc * 2; root.updateMatrixWorld();
        if (ptrDirty && frame % 2 === 0) { ptrDirty = false; cast(); }
        gMat.uniforms.uTime.value = T; dMat.uniforms.uTime.value = T; dMat.uniforms.uShift.value = yaw * 0.15;
        gMat.uniforms.uOn.value += ((calm ? 0 : ptrOn) - gMat.uniforms.uOn.value) * Math.min(1, rdt * 4);
        const intro = clamp01((RT - 1.5) / 1.2), sel = self.state.sel;
        // merge requests arrive and wait in the queue
        if (intro >= 1 && RT > nextSpawn) {
          const burst = Math.random() < 0.25 ? 3 : 1; for (let i = 0; i < burst; i++) spawnMR(['rA', 'rB', 'rC'][(Math.random() * 3) | 0]);
          nextSpawn = RT + 12 + Math.random() * 14;
        }
        q.forEach((c, i) => {
          if (c.st === 'fly') {
            c.t += dt / 1.1; const k = sm(Math.min(1, c.t)), tx = slotX(i);
            c.m.position.set(c.from[0] + (tx - c.from[0]) * k, c.from[1] + (QY - c.from[1]) * k + Math.sin(Math.PI * k) * 1.5, c.from[2] * (1 - k));
            if (c.t >= 1) { c.st = 'wait'; c.x = tx; }
          } else { c.x += (slotX(i) - c.x) * Math.min(1, dt * 8); c.m.position.set(c.x, QY, 0); }
          const gk = intro * (c.st === 'fly' ? sm(Math.min(1, c.t / 0.25)) : 1); c.m.scale.set(Math.max(0.001, 0.1 * gk), Math.max(0.001, 0.75 * gk), Math.max(0.001, 1.1 * gk));
        });
        // the agent
        let think = 0, act = 0, obs = 0;
        sLlm.g.visible = sTool.g.visible = scan.visible = false;
        if (ph === 'idle') { liveTxt = 'idle'; if (intro >= 1 && q[0] && q[0].st === 'wait') startLoad(); }
        else if (ph === 'load') {
          pt += dt / 1.5; const c = cur.chip, k = Math.min(1, pt), m = c.m; liveTxt = 'new MR !' + cur.mr;
          if (k < 0.45) { const u = sm(k / 0.45); m.position.set(c.from[0] + (AX - c.from[0]) * u, QY + (2.45 - QY) * u + Math.sin(Math.PI * u) * 0.6, 0); }
          else {
            if (!cur.card) { cur.card = 1; m.visible = false; free.push(m); pins.forEach(p => { p.g.visible = false; }); shown = -1; drawCard(); cardG.visible = true; }
            const u = sm((k - 0.45) / 0.55), sy = (0.75 + (0.08 - 0.75) * u) / 0.08;
            cardG.scale.set((0.1 + (CW - 0.1) * u) / CW, sy, (1.1 + (CD - 1.1) * u) / CD);
            cardG.position.set(AX + (RX - AX) * u, 2.45 + (0.39 - 2.45) * u + Math.sin(Math.PI * u) * 1.2 - 0.04 * sy, 0);
          }
          if (pt >= 1) { cardG.position.set(RX, 0.35, 0); cardG.scale.setScalar(1); ph = 'run'; stepI = 0; sp = 0; fired = 0; bump('ragent'); }
        } else if (ph === 'run') {
          const s = cur.steps[stepI], j = s.j, hold = RT < 1.7;
          if (hold) cardG.scale.setScalar(ease((RT - 0.9) / 0.8)); else { cardG.scale.setScalar(1); sp += dt; } // sp = seconds into this lap
          if (cur.reveal < 1) { cur.reveal = Math.min(1, cur.reveal + dt / 0.7); if (Math.ceil(cur.reveal * cur.diff.lines.length) !== shown) drawCard(); }
          // one lap: ride to THINK and wait for the model, ride to ACT and wait for the tool, ride to OBSERVE and read the result
          const a0 = stepI === cur.first ? Math.PI : Math.PI / 2, A_A = DOCK[j], dL = DUR[NM], d1 = DUR[j], d2 = DUR[NM + 1 + j], t1 = (A_T - a0) / BV, t2 = t1 + dL * 2 + LW, t3 = t2 + Math.abs(A_A - A_T) / BV, t4 = t3 + (d1 + d2) * 2 + WAIT * 3, t5 = t4 + (A_O - A_A) / BV, t6 = t5 + 0.6;
          stations[1].ta = A_A; // the ACT chip belongs exactly opposite the server being called; it cross-fades there
          moving = 0;
          if (sp < t1) { runTh = a0 + (A_T - a0) * sm(sp / t1); moving = 1; }
          else if (sp < t2) { // think: the request goes to the LLM and the agent waits for the answer
            runTh = A_T; think = 1; const u = sp - t1, t = u < dL ? sm(u / dL) : u < dL + LW ? 1 : 1 - sm(Math.min(1, (u - dL - LW) / dL));
            sLlm.g.visible = true; arcPt(NM, t, sLlm.g.position); arcs[NM].k = 1;
            if (u >= dL && once(1)) { llmK = 1; bump('rllm'); }
          } else if (sp < t3) { runTh = A_T + (A_A - A_T) * sm((sp - t2) / (t3 - t2)); moving = A_A > A_T ? 1 : 0; }
          else if (sp < t4) { // act: agent -> MCP server -> its backend and all the way back; the agent waits
            runTh = A_A; act = 1; arcs[j].k = 1; sTool.g.visible = true;
            // out to the server, a short stop, on to its backend, a short stop, and the same way back
            let v = sp - t3, leg = j, t = 1;
            if (v < d1) t = sm(v / d1);
            else if ((v -= d1) < WAIT) t = 1;
            else if ((v -= WAIT) < d2) { leg = NM + 1 + j; t = sm(v / d2); }
            else if ((v -= d2) < WAIT) { leg = NM + 1 + j; t = 1; }
            else if ((v -= WAIT) < d2) { leg = NM + 1 + j; t = 1 - sm(v / d2); }
            else if ((v -= d2) < WAIT) t = 1;
            else t = 1 - sm(Math.min(1, (v - WAIT) / d1));
            if (leg !== j) arcs[leg].k = 1;
            arcPt(leg, t, sTool.g.position);
            if (sp - t3 >= d1 && once(2)) { nodes[MCP[j]].flash = 1; bump(MCP[j]); toolCalls++; cur.calls++; }
            if (sp - t3 >= d1 + WAIT + d2 && once(4)) { nodes[BACK[j]].flash = 1; bump(BACK[j]); }
          } else if (sp < t5) { runTh = A_A + (A_O - A_A) * sm((sp - t4) / (t5 - t4)); moving = 1; }
          else { // observe: read the result; a comment lands on its line
            runTh = A_O; obs = 1; const u = sp - t5;
            if (u < 0.5) { scan.visible = true; scan.position.z = -CD / 2 + CD * sm(u / 0.5); scan.material.opacity = 0.9 * Math.min(1, u * 10, (0.5 - u) * 10); }
            if (u >= 0.35 && s.note && once(8)) {
              const p = pins[cur.noteN % pins.length]; cur.marks[s.note.l] = s.note.k; cur.noteN++;
              p.m.color.copy(s.note.k === 'sec' ? cWarn : cAcc); p.t = 0; p.g.visible = true;
              p.g.position.set(CW / 2 - 0.38, 0.09, -CD / 2 + (HEAD + (s.note.l + 0.5) * ROW) / 448 * CD); drawCard();
            }
          }
          liveTxt = 'step ' + (stepI + 1) + ' · ' + (sp < t2 ? 'think' : sp < t4 ? s.tool : 'observe');
          if (sp >= t6) { // the summary goes out with the finished review
            sp = 0; fired = 0; stepI++;
            if (stepI >= cur.steps.length) {
              ph = 'ship'; pt = 0; toolCalls++; arcs[0].k = arcs[NM + 1].k = 1; nodes.rmG.flash = 1; bump('rmG');
              if (!calm) { beadK = 0; burstT = 0; burstG.position.copy(bead.g.position); burstG.visible = true; }
            }
          }
        } else if (ph === 'ship') { // the reviewed merge request returns to its repository in GitLab
          pt += dt / 1.7; const k = sm(Math.min(1, pt)), u = 1 - k, r = D(cur.src), m = D('rmG'); liveTxt = 'gitlab.summary';
          cardG.position.set(u * u * RX + 2 * u * k * m.x + k * k * r.x, u * u * 0.35 + 2 * u * k * 7 + k * k * 1.5, 2 * u * k * m.z + k * k * r.z); cardG.scale.setScalar(Math.max(0.001, (1 - 0.72 * k) * (k > 0.85 ? (1 - k) / 0.15 : 1)));
          if (pt >= 1) { nodes[cur.src].flash = 1; nodes.rgl.flash = 1; bump(cur.src); cardG.visible = false; cardG.position.set(RX, 0.35, 0); cardG.scale.setScalar(1); cur = null; ph = 'idle'; }
        }
        pins.forEach(p => { if (p.t < 1) { p.t = Math.min(1, p.t + dt / 0.55); p.g.position.y = 0.09 + (1 - bounce(p.t)) * 2.6; p.g.scale.setScalar(Math.min(1, p.t / 0.2)); } });
        const run = ph === 'run' ? 1 : 0; trailOn += ((run ? 0.3 + 0.7 * moving : 0) - trailOn) * Math.min(1, rdt * 5);
        const th = run ? runTh : Math.PI + Math.sin(RT * 1.2) * 0.06;
        bead.g.visible = intro > 0; bead.g.position.set(RX + RR * Math.cos(th), 0.2, RR * Math.sin(th)); beadK += ((ph === 'ship' ? 0 : 1) - beadK) * Math.min(1, rdt * 3);
        beadS += ((run ? 1 : 0.7) - beadS) * Math.min(1, rdt * 5);
        bead.g.scale.setScalar(Math.max(0.001, intro * beadS * beadK));
        if (burstT < 1) {
          burstT = Math.min(1, burstT + rdt / 0.8); const e = 1 - Math.pow(1 - burstT, 3), o = Math.pow(1 - burstT, 1.5);
          bFlash.scale.setScalar(1 + 2.6 * e); bFlash.material.opacity = 0.9 * o;
          bRing.scale.setScalar(0.25 + 1.5 * e); bRing.material.opacity = 0.6 * o;
          bParts.forEach(s => { const u = s.userData; s.position.set(u.x * u.r * e, 0.1 + u.up * e - 0.5 * burstT * burstT, u.z * u.r * e); s.scale.setScalar(0.5 * (1 - 0.6 * burstT)); s.material.opacity = o; });
          if (burstT >= 1) burstG.visible = false;
        }
        trailMat.uniforms.uHead.value = th; trailMat.uniforms.uOn.value = trailOn * intro;
        [think, act, obs].forEach((on, i) => {
          const s = stations[i];
          if (s.ta !== s.a) { s.o = Math.max(0, s.o - rdt / 0.3); if (s.o === 0) s.a = s.ta; } else if (s.o < 1) s.o = Math.min(1, s.o + rdt / 0.3);
          V.set(RX + (RR + 0.75) * Math.cos(s.a), 0.05, (RR + 0.75) * Math.sin(s.a)).applyMatrix4(root.matrixWorld).project(cam);
          s.el.style.transform = 'translate3d(' + ((V.x * 0.5 + 0.5) * W).toFixed(1) + 'px,' + ((-V.y * 0.5 + 0.5) * H).toFixed(1) + 'px,0) translate(-50%,-50%)';
          if (s.on !== on) { s.on = on; s.el.style.background = on ? 'var(--acc)' : 'color-mix(in srgb,var(--bg) 72%,transparent)'; s.el.style.color = on ? 'var(--acc-ink)' : 'var(--dim)'; }
          const o = (intro * (zoomFit < 18 ? 0 : 1) * s.o).toFixed(2); if (s.el.style.opacity !== o) s.el.style.opacity = o;
        });
        arcs.forEach(a => { a.k = Math.max(0, a.k - rdt * 3); a.s += (a.k - a.s) * Math.min(1, rdt * 10); a.l.material.color.copy(cEdge).lerp(cAcc, a.s); a.l.material.opacity = 0.45 + 0.55 * a.s; });
        llmK = Math.max(0, llmK - rdt * 1.4); llmS += (llmK - llmS) * Math.min(1, rdt * 10);
        llmWire.rotation.y += dt * 0.5; llmWire.rotation.x += dt * 0.21; llmCore.rotation.y -= dt * 0.8;
        llm.scale.setScalar((1 + 0.22 * llmS) * ease((RT - 0.9) / 0.8)); llm.position.y = 1.7 + Math.sin(T * 1.1) * 0.08;
        llmCore.material.color.set(0x0a5fb4).lerp(WHITE, 0.1 + 0.9 * llmS); llmGlow.material.opacity = 0.18 + 0.6 * llmS;
        llmRing.scale.setScalar(1 + (1 - llmK) * 0.3); llmRing.material.opacity = Math.min(llmK, llmS) * 0.8;
        const agentEl = nodes.ragent.live; if (agentEl && agentEl.textContent !== liveTxt) agentEl.textContent = liveTxt;
        for (const id in nodes) {
          const n = nodes[id], k = ease((RT - 0.15 - n.delay) / 0.8);
          n.g.scale.y = Math.max(0.001, k);
          n.hl += (((id === sel || id === hover) ? 1 : 0) - n.hl) * Math.min(1, rdt * 9);
          n.flash = Math.max(0, n.flash - rdt * 1.8); n.fl += (n.flash - n.fl) * Math.min(1, rdt * 12);
          const lift = n.lift ? n.hl * 0.3 : 0; n.g.position.y = n.by + lift;
          n.em.color.copy(n.eb).lerp(cAcc, Math.max(n.hl, n.fl));
          const df = n.def, ag = id === 'ragent', small = ag && zoomFit < 18;
          if (small) V.set(RX - RR - 1, 0, RR + 5); else if (ag) V.set(RX - RR * 0.7071, 0.3, RR * 0.7071); else if (df.lr) V.set(df.x + df.lr[0], PLY, df.z + df.lr[1]); else V.set(df.x, df.lb ? 0 : df.ll ? n.by + 0.65 : n.by + n.top * k + lift, df.z);
          V.applyMatrix4(root.matrixWorld).project(cam);
          n.sx = (V.x * 0.5 + 0.5) * W; n.sy = (-V.y * 0.5 + 0.5) * H;
          if (!n.lw || frame % 120 === 0) n.lw = n.el.offsetWidth || 90;
          const lx = Math.max(8, Math.min(W - n.lw - 8, small ? n.sx - n.lw / 2 : ag ? n.sx - n.lw - 12 : df.lr ? n.sx + 8 : df.ll ? n.sx - n.lw - zoom * 1.25 : df.lb ? n.sx - n.lw / 2 : n.sx - 6));
          n.el.style.transform = 'translate3d(' + lx.toFixed(1) + 'px,' + (n.sy + (ag ? -17 : df.lr || df.ll ? -9 : df.lb ? zoom * 0.75 : -22)).toFixed(1) + 'px,0)';
          const lo = (n.sy < 150 ? 0 : 1) * ((zoomFit < 18 && !n.def.main && n.hl < 0.5) ? 0 : 1) * clamp01((RT - 0.6 - n.delay) / 0.5), los = lo.toFixed(2);
          if (n.el.style.opacity !== los) { n.el.style.opacity = los; n.el.style.pointerEvents = lo > 0.5 ? 'auto' : 'none'; }
          n.el.style.color = n.hl > 0.5 ? 'var(--acc)' : '';
        }
        const tn = sel && nodes[sel]; self.placeTip(tn ? [tn.sx, tn.sy] : null, W, H, frame);
        if (RT - lastHud > 0.5) {
          lastHud = RT;
          hist[0].push(q.length); hist[0].shift(); hist[1].push(ph === 'run' ? stepI + Math.min(1, sp / 7) : 0); hist[1].shift(); hist[2].push(cur ? cur.calls : 0); hist[2].shift();
          const a = self.rpsRef.current, b = self.p99Ref.current, c = self.errRef.current, d = self.nodeCountRef.current;
          if (a) a.textContent = String(q.length);
          if (b) b.textContent = ph === 'run' ? String(stepI + 1) : '—';
          if (c) c.textContent = String(toolCalls);
          if (d && sel) d.textContent = String(counts[sel] || 0);
          spark(self.rpsSpark, hist[0], 8); spark(self.p99Spark, hist[1], 8); spark(self.errSpark, hist[2], 8);
        }
        renderer.render(scene, cam);
      };
      this.three = st; st.palette(this.state.theme); st.setLabels(this.props.showLabels ?? true); st.fit();
      st.raf = requestAnimationFrame(tick);
    }
    // a project card opens its architecture: pick the diagram and scroll back to the hero
    openArch(scene, e) {
      if (e && e.target && e.target.closest && e.target.closest('a')) return;
      this.setState({ scene, sel: null, tip: null });
      const hero = this.heroRef.current; if (hero) hero.scrollIntoView({ behavior: this.state.calm ? 'instant' : 'smooth', block: 'start' });
    }
    select(id) {
      if (id) this.touched = true;
      this.setState(s => { const next = id && s.sel !== id ? id : null; return { sel: next, tip: next || s.tip }; });
    }
    tilt = e => {
      if (this.state.calm || e.pointerType === 'touch' || (this.props.tiltCards ?? true) === false) return;
      const el = e.currentTarget, c = el.firstElementChild, r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.transform = 'rotateX(' + ((0.5 - y) * 3).toFixed(2) + 'deg) rotateY(' + ((x - 0.5) * 4).toFixed(2) + 'deg)';
      c.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--my', (y * 100).toFixed(1) + '%'); c.style.setProperty('--glow', '1');
    };
    untilt = e => { const c = e.currentTarget.firstElementChild; c.style.transform = ''; c.style.setProperty('--glow', '0'); };
  }

  // ---- Yandex Metrica goals: same names as before the redesign
  const YM_SECTIONS = ['work', 'stack', 'path', 'contact'];
  let goalDepth = -1;
  const goal = name => { if (typeof window.ym === 'function') window.ym(YM_ID, 'reachGoal', name); };
  const reachSection = id => {
    const idx = YM_SECTIONS.indexOf(id);
    if (idx < 0 || idx <= goalDepth) return;
    for (let i = goalDepth + 1; i <= idx; i++) goal('section_' + YM_SECTIONS[i]);
    goalDepth = idx;
  };
  const goalFor = el => {
    if (el.dataset.goal) return el.dataset.goal;
    const href = el.getAttribute('href') || '';
    if (href.indexOf('mailto:') === 0) return 'contact_email';
    if (href.indexOf('t.me/') > -1) return 'contact_telegram';
    if (href.indexOf('cv.ferokuk.dev') > -1) return 'cv_open';
    if (href.indexOf('github.com') > -1) return 'contact_github';
    if (el.id === 'lang-en') return 'lang_en';
    if (el.id === 'lang-ru') return 'lang_ru';
    return null;
  };
  const initGoals = () => {
    if (typeof window.ym !== 'function') return;
    window.ym(YM_ID, 'params', { page_type: 'landing', lang: LANG });
    document.addEventListener('click', e => {
      const el = e.target && e.target.closest ? e.target.closest('a, button') : null;
      const name = el ? goalFor(el) : null;
      if (name) goal(name);
    }, true);
    document.addEventListener('copy', () => {
      if (String(window.getSelection() || '').indexOf('@ferokuk.dev') > -1) goal('email_copied');
    });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => entries.forEach(en => {
        if (!en.isIntersecting) return;
        reachSection(en.target.id); io.unobserve(en.target);
      }), { threshold: 0, rootMargin: '0px 0px -25% 0px' });
      YM_SECTIONS.forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
    }
    setTimeout(() => goal('engaged_60s'), 60000);
  };

  const boot = () => { new App().mount(); initGoals(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
