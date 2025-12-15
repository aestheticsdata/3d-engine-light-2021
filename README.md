# 3d-engine-light-2021

- 100% TypeScript
- Vite bundler

http://1991computer.com/3dengine/

---

## Deployment

This project is deployed using an **atomic release strategy** based on
timestamped releases and a `current` symlink.

The deployment flow is:
- local build with Vite
- upload of the `dist/` folder via `rsync`
- atomic switch of the active release using a symlink
- optional rollback to a previous release

This setup avoids downtime and makes rollbacks trivial.

---

## One-time server setup (ks-b)

⚠️ **The following steps must be done once on the server before the first deploy.**

### 1. Create deployment directories

```bash
sudo mkdir -p /var/www/1991computer/3dengine/releases
sudo ln -s /var/www/1991computer/3dengine/releases \
          /var/www/1991computer/3dengine/current
sudo chown -R debian:debian /var/www/1991computer/3dengine
```

### 2. Configure nginx

```nginx
location /3dengine/ {
    alias /var/www/1991computer/3dengine/current/;
    index index.html;
    try_files $uri $uri/ /3dengine/index.html;
}
```

and reload nginx after deploy:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

