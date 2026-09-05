# Follope — Hostinger VPS Setup Guide

This guide walks you through deploying **Follope** onto your Hostinger VPS with **`follope.com`**, **`api.follope.com`**, and **`follope.in`**.

---

## 1. Configure DNS Records in Hostinger

In your **Hostinger Control Panel** (hPanel -> Domains -> DNS Zone):

### For `follope.com`:
| Type | Name | Points to | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `YOUR_VPS_IP` | 3600 |
| **A** | `www` | `YOUR_VPS_IP` | 3600 |
| **A** | `api` | `YOUR_VPS_IP` | 3600 |

### For `follope.in`:
| Type | Name | Points to | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `YOUR_VPS_IP` | 3600 |
| **A** | `www` | `YOUR_VPS_IP` | 3600 |

*(Wait ~5–15 minutes for DNS to propagate).*

---

## 2. Connect to Your Hostinger VPS

Open your terminal or PowerShell and SSH into your VPS:

```bash
ssh root@YOUR_VPS_IP
```

---

## 3. Install Prerequisites (One-Time)

Run this on your VPS to install Docker, Nginx, Certbot, and Node.js:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Git, Curl, Nginx, Certbot
sudo apt install -y git curl ufw nginx certbot python3-certbot-nginx

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo systemctl enable --now docker

# Install Node.js 20 (for web build)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Configure Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

---

## 4. Obtain Free SSL Certificates (Certbot)

Run Certbot to generate SSL certificates for all your domains:

```bash
sudo certbot certonly --nginx \
  -d follope.com \
  -d www.follope.com \
  -d api.follope.com \
  -d follope.in \
  -d www.follope.in \
  --email support@follope.com \
  --agree-tos \
  --no-eff-email
```

Certbot will automatically set up auto-renewal.

---

## 5. Clone and Configure Follope

```bash
# Create web directory
sudo mkdir -p /var/www/follope
sudo chown -R $USER:$USER /var/www/follope

# Clone your repository
git clone <YOUR_GIT_REPO_URL> /var/www/follope
cd /var/www/follope

# Create production .env file
cp backend/.env.example .env
nano .env
```

Set the following variables in `.env`:

```ini
NODE_ENV=production
PORT=3000

# Generated secure secrets
POSTGRES_USER=postgres
POSTGRES_PASSWORD=generate_a_strong_password_here
POSTGRES_DB=follope

AUTH_SECRET=generate_with_openssl_rand_base64_48
ALLOWED_ORIGINS=https://follope.com,https://api.follope.com
PUBLIC_APP_URL=https://follope.com

# Optional Transactional Email (Resend)
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=Follope <support@follope.com>
```

---

## 6. Link Nginx and Deploy

```bash
# Link Nginx configuration
sudo cp /var/www/follope/deploy/nginx.conf /etc/nginx/sites-available/follope
sudo ln -sf /etc/nginx/sites-available/follope /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Make deploy script executable and run it
chmod +x /var/www/follope/deploy/deploy.sh
/var/www/follope/deploy/deploy.sh
```

---

## 7. Verify Your Deployment

* **Health Check:** `curl https://api.follope.com/health` (should return `{"data":{"status":"ok"}}`)
* **Web App & Recipient Page:** Visit `https://follope.com` in your browser.
* **Test WhatsApp Recipient View:** Create an invoice and open `https://follope.com/invoice/<publicToken>`.

---

## 8. Ongoing Updates (1-Command Deploy)

Whenever you make updates to the app in the future, simply SSH in and run:

```bash
cd /var/www/follope
git pull
./deploy/deploy.sh
```
