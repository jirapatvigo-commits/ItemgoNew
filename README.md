# Itemgo

Itemgo is a React application with its own Node.js REST API and MySQL database. Authentication, inventory, loans, and image uploads are served by this project.

## Requirements

- Node.js 20 or newer
- MySQL 8 or newer (XAMPP MySQL works)
- Docker Desktop is optional if you prefer the included Compose setup

## Configure MySQL

Create a database named `itemgo` and a MySQL user that can create tables and read/write data. Copy `.env.example` to `.env`, then configure `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE`.

Alternatively, run `docker compose up -d mysql`. The container defaults are database `itemgo`, user `itemgo`, and password `itemgo-local`; set those values in `.env`.

The API creates its tables when it starts. Public registration requires a full name, department, and building, and always creates an ordinary user. These profile fields are copied onto each loan record. Admin accounts must be explicitly promoted by a trusted database administrator; for example, after registering the account, run `UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';` in the `itemgo` database. Use `/admin/login` for admins and `/user/login` for ordinary users. Passwords are stored as bcrypt hashes and sessions are stored in MySQL.

Borrow requests reserve the requested quantity and stay pending until an admin approves or rejects them. Return requests also stay pending; the item is returned to available stock only after an admin approves the return. Rejecting a borrow releases its reservation, while rejecting a return leaves the loan active.

## Run Locally

```bash
npm install
npm run dev
```

This starts the API at `http://localhost:4000` and the frontend at `http://localhost:8080/Itemgo/`. Vite proxies `/api` requests to the Node API. With the XAMPP Apache proxy configuration below, use `http://localhost/Itemgo/` instead.

The API can be run by itself with `npm run server`; run only the frontend with `npm run client`. Check `http://localhost:4000/api/health` to confirm the API can reach MySQL.

### XAMPP portless URL

To serve the development app at `http://localhost/Itemgo/` without a port, enable `mod_proxy_http` in `C:\xampp\apache\conf\httpd.conf` and add these directives after `ServerName localhost:80`:

```apache
ProxyRequests Off
ProxyPreserveHost On
ProxyPass /api/ http://127.0.0.1:4000/api/
ProxyPassReverse /api/ http://127.0.0.1:4000/api/
ProxyPass /Itemgo/ http://127.0.0.1:8080/Itemgo/
ProxyPassReverse /Itemgo/ http://127.0.0.1:8080/Itemgo/
```

Restart Apache after changing its configuration. The Node API must allow `http://localhost` in `CORS_ORIGIN` if that variable is set in `.env`.

On Windows with XAMPP installed at `C:\xampp`, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-startup-task.ps1` once to add an Itemgo shortcut to the current user's Startup folder. It retries MySQL startup and restarts the frontend/API if they exit. To uninstall, remove `Itemgo Dev Server.lnk` from the folder opened by `shell:startup`.

## Password Reset Email

To send password-reset emails with Gmail, enable 2-Step Verification and create a Google App Password. Put the Gmail address and App Password in the ignored local `.env` file using the `SMTP_*` keys from `.env.example`, then restart the API. Do not use your regular Gmail password or share the App Password. The API sends reset links that expire after 30 minutes. When SMTP credentials are incomplete, development mode returns a reset link in the browser; production mode requires SMTP and does not expose reset links.

## Production

Build the frontend with `npm run build` and run the API with `npm run server:start`. Configure a web server or reverse proxy to serve the frontend and forward `/api` requests to the API. Set `PUBLIC_APP_URL`, `CORS_ORIGIN`, and MySQL credentials for the deployed environment, use HTTPS, and use a dedicated least-privilege MySQL account.
