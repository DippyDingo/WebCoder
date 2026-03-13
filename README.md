# AiCoder

Локальный инструмент для работы с проектами через внешний LLM-сценарий:

1. выбрать файлы контекста;
2. описать задачу;
3. сгенерировать `source.txt`;
4. отправить его в модель;
5. вставить XML-ответ обратно в приложение;
6. применить изменения и сохранить их в Git.

## Структура проекта

- [source](C:\Users\acer\Desktop\aicoder\source) — рабочая директория AiCoder
- [source\backend_py](C:\Users\acer\Desktop\aicoder\source\backend_py) — Django backend
- [source\frontend](C:\Users\acer\Desktop\aicoder\source\frontend) — React/Vite frontend
- [source\projects](C:\Users\acer\Desktop\aicoder\source\projects) — создаваемые проекты
- [source\.aicoder](C:\Users\acer\Desktop\aicoder\source\.aicoder) — служебные файлы текущего workspace

## Требования

- Python 3.11+
- Node.js 20+ и npm
- Git

## Установка

### 1. Backend

Откройте PowerShell в корне проекта [aicoder](C:\Users\acer\Desktop\aicoder):

```powershell
cd C:\Users\acer\Desktop\aicoder\source\backend_py
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Если виртуальное окружение не нужно, можно установить зависимости и без него:

```powershell
cd C:\Users\acer\Desktop\aicoder\source\backend_py
pip install -r requirements.txt
```

### 2. Frontend

```powershell
cd C:\Users\acer\Desktop\aicoder\source\frontend
npm install
```

## Сборка фронтенда

Для локального production-запуска backend ожидает собранный фронтенд в `source/frontend/dist`.

```powershell
cd C:\Users\acer\Desktop\aicoder\source\frontend
npm run build
```

## Запуск

### Вариант 1. Обычный локальный запуск

Этот способ поднимает Django backend, выбирает порт `9080` или ближайший свободный и открывает приложение в браузере.

```powershell
cd C:\Users\acer\Desktop\aicoder
python source\backend_py\run_local.py
```

Если не хотите автозапуск браузера:

```powershell
cd C:\Users\acer\Desktop\aicoder
python source\backend_py\run_local.py --no-browser
```

Если хотите жёстко указать порт:

```powershell
cd C:\Users\acer\Desktop\aicoder
python source\backend_py\run_local.py --port 9080 --no-browser
```

### Вариант 2. Frontend в dev-режиме

В одном окне:

```powershell
cd C:\Users\acer\Desktop\aicoder\source\frontend
npm run dev
```

Во втором окне:

```powershell
cd C:\Users\acer\Desktop\aicoder
python source\backend_py\run_local.py --no-browser
```

## Проверка backend

```powershell
cd C:\Users\acer\Desktop\aicoder\source\backend_py
python manage.py check
python manage.py test api
```

## Как пользоваться

1. Откройте AiCoder.
2. Создайте новый проект или откройте существующий.
3. В левом проводнике отметьте файлы, которые нужно включить в контекст.
4. В центральной панели опишите задачу.
5. Откройте `source.txt` и отправьте его во внешнюю LLM.
6. Скопируйте XML-ответ модели.
7. Вставьте XML в поле ввода AiCoder и нажмите отправку.
8. Проверьте изменённые файлы и историю коммитов.

## Полезные файлы

- [source.txt](C:\Users\acer\Desktop\aicoder\source\.aicoder\source.txt) — сгенерированный prompt
- [prompt.md](C:\Users\acer\Desktop\aicoder\source\prompt.md) — базовый шаблон prompt
- [settings.json](C:\Users\acer\Desktop\aicoder\source\settings.json) — базовые настройки workspace

## Примечания

- `source.txt` открывается внутри редактора приложения.
- Клик по коммиту в правой панели открывает diff этого коммита в режиме только для чтения.
- Сообщение текущего коммита можно редактировать через кнопку `Изменить`.
- Кнопка `Откатить` делает `git reset --hard` к выбранному коммиту, поэтому используйте её осторожно.
