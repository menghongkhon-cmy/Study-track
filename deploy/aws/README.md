# Deploy StudyTrack on AWS EC2 (Ubuntu)

This is a small single-instance deployment recipe for testing with real accounts. It uses Nginx for public HTTP/HTTPS and proxies privately to the StudyTrack Python service. The app binds only to `127.0.0.1:8000`; do not open port 8000 to the internet.

## 1. Create the EC2 instance

1. Launch a current Ubuntu Server LTS EC2 instance in a region close to your users. Select an instance size based on the number of students and uploaded submissions you expect.
2. Create or select a security group with inbound TCP 22 limited to your own public IP, plus TCP 80 and 443 for web traffic. Do not add a rule for 8000. See [AWS security group guidance](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html).
3. Point your domain's DNS `A` record to the instance's stable public IP (an Elastic IP avoids changing the address when the instance is stopped and started).
4. Keep the SQLite database on persistent EBS storage. A separate EBS data volume mounted at `/var/lib/studytrack` is recommended. Verify its delete-on-termination setting and take backups: AWS notes that EBS persistence after instance termination depends on that setting. See [AWS EBS persistence guidance](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/preserving-volumes-on-termination.html).

## 2. Install the app and Python environment

Upload or clone the project into `/opt/studytrack` (do not upload `.env` files, database files, or backups into a public Git repository). On the instance:

```bash
sudo apt update
sudo apt install -y python3-venv nginx
sudo adduser --system --group --home /opt/studytrack --no-create-home studytrack
sudo mkdir -p /opt/studytrack /etc/studytrack /var/lib/studytrack
sudo chown -R root:studytrack /opt/studytrack
sudo chmod -R g+rX,o-rwx /opt/studytrack
sudo install -d -o studytrack -g studytrack -m 750 /var/lib/studytrack
sudo python3 -m venv /opt/studytrack/.venv
sudo /opt/studytrack/.venv/bin/pip install -r /opt/studytrack/requirements.txt
sudo chown -R root:studytrack /opt/studytrack/.venv
sudo chmod -R g+rX,o-rwx /opt/studytrack/.venv
```

If using a separate EBS data volume, mount it at `/var/lib/studytrack` before starting the service, and ensure the `studytrack` user can write there. Follow AWS's volume mounting instructions for the selected Ubuntu image; identify the device carefully and never format a volume that contains data.

## 3. Add private server settings

Copy `deploy/aws/studytrack.env.example` to `/etc/studytrack/studytrack.env`. Edit it and replace the domain, teacher/admin codes, and any optional OAuth credentials. Keep this file off GitHub. Then restrict it to root and the app group:

```bash
sudo chown root:studytrack /etc/studytrack/studytrack.env
sudo chmod 640 /etc/studytrack/studytrack.env
```

Use separate, random teacher and admin codes. The app uses the provider callbacks below when you later enable Google/GitHub sign-in:

```text
https://study.example.com/auth/google/callback
https://study.example.com/auth/github/callback
```

Set those exact HTTPS callback URLs with the OAuth providers, add the client ID and secret to the environment file, then restart the service.

## 4. Start the private app service

```bash
sudo install -m 644 deploy/aws/studytrack.service /etc/systemd/system/studytrack.service
sudo systemctl daemon-reload
sudo systemctl enable --now studytrack
sudo systemctl status studytrack --no-pager
curl http://127.0.0.1:8000/api/health
```

The health check should return `{"ok":true,"service":"StudyTrack API"}`. Check service logs with `sudo journalctl -u studytrack -n 100 --no-pager`.

## 5. Put Nginx in front and enable HTTPS

Replace `study.example.com` in `deploy/aws/nginx.conf` with your real domain, then install and enable the server block:

```bash
sudo cp deploy/aws/nginx.conf /etc/nginx/sites-available/studytrack
sudo ln -s /etc/nginx/sites-available/studytrack /etc/nginx/sites-enabled/studytrack
sudo nginx -t
sudo systemctl reload nginx
```

After DNS points to the instance and port 80 is reachable, install Certbot using the current instructions for Ubuntu, then run `sudo certbot --nginx -d study.example.com`. Confirm the site opens over HTTPS and `/api/health` responds. The environment already sets secure session cookies; the backend trusts the client-IP header only because Nginx overwrites it with the connecting address.

## 6. Check backups before inviting students

Create encrypted, access-restricted EBS snapshots or database backups on a schedule. Test restoring a backup before relying on the service for grades or submissions. Keep the database and secrets private, and do not expose the Python port directly. This single-instance recipe does not provide automatic failover or independent database encryption; get a security review before using sensitive student records at scale.
