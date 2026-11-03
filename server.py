#!/usr/bin/env python3
"""StudyTrack's same-origin API, local SQLite account store, and OAuth sign-in."""
from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import math
import mimetypes
import binascii
from base64 import b64decode
from base64 import urlsafe_b64encode
import os
import re
import secrets
import sqlite3
import threading
import time
import traceback
from datetime import date, datetime, timedelta, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlencode, urlsplit
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import jwt
from jwt import PyJWKClient

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("STUDYTRACK_DB", str(ROOT / "studytrack.sqlite3"))).expanduser()
SESSION_SECONDS = 14 * 24 * 60 * 60
COOKIE_NAME = "studytrack_session"
PBKDF2_ROUNDS = 310_000
MAX_BODY = 20 * 1024 * 1024
MAX_SUBMISSION_FILE = 8 * 1024 * 1024
MAX_SUBMISSION_TOTAL = 12 * 1024 * 1024
MAX_SUBMISSION_FILES = 20
MAX_QUIZ_QUESTIONS = 100
CLASS_JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
DATA_KEYS = {"profile", "subjects", "scores", "tasks", "sessions", "notes", "goals", "achievements", "settings"}
AUTH_ATTEMPTS: dict[str, list[float]] = {}
AUTH_LOCK = threading.Lock()
AUTH_ATTEMPT_WINDOW = 300
AUTH_ATTEMPT_LIMIT = 12
AUTH_ATTEMPT_KEYS_LIMIT = 4096
PUBLIC_STATIC_FILES = {"index.html", "manifest.json", "sw.js"}
PUBLIC_STATIC_DIRS = {"assets", "css", "js"}
OAUTH_PROVIDERS = {
    "google": {
        "client_id_env": "STUDYTRACK_GOOGLE_CLIENT_ID",
        "client_secret_env": "STUDYTRACK_GOOGLE_CLIENT_SECRET",
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
    },
    "github": {
        "client_id_env": "STUDYTRACK_GITHUB_CLIENT_ID",
        "client_secret_env": "STUDYTRACK_GITHUB_CLIENT_SECRET",
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
    },
    "telegram": {
        "client_id_env": "STUDYTRACK_TELEGRAM_CLIENT_ID",
        "client_secret_env": "STUDYTRACK_TELEGRAM_CLIENT_SECRET",
        "authorize_url": "https://oauth.telegram.org/auth",
        "token_url": "https://oauth.telegram.org/token",
    },
}


def connect_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=30)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.execute("PRAGMA journal_mode = WAL")
    return db


def init_db() -> None:
    with connect_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('student','teacher')),
          password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0,
          is_disabled INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS oauth_accounts (
          provider TEXT NOT NULL CHECK(provider IN ('google','github','telegram')),
          subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL, PRIMARY KEY(provider,subject), UNIQUE(provider,user_id)
        );
        CREATE TABLE IF NOT EXISTS oauth_states (
          state_hash TEXT PRIMARY KEY, provider TEXT NOT NULL CHECK(provider IN ('google','github','telegram')),
          code_verifier TEXT NOT NULL, nonce TEXT NOT NULL,
          link_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_data (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          data_key TEXT NOT NULL, data_json TEXT NOT NULL,
          PRIMARY KEY(user_id, data_key)
        );
        CREATE TABLE IF NOT EXISTS classrooms (
          id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL, join_code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS class_memberships (
          class_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          joined_at TEXT NOT NULL, PRIMARY KEY(class_id,user_id)
        );
        CREATE TABLE IF NOT EXISTS assignments (
          id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
          title TEXT NOT NULL, instructions TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '',
          due_date TEXT NOT NULL, maximum REAL NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS quizzes (
          id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
          title TEXT NOT NULL, instructions TEXT NOT NULL DEFAULT '', due_date TEXT NOT NULL DEFAULT '', questions_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS quiz_attempts (
          id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
          student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          correct_count INTEGER NOT NULL, question_count INTEGER NOT NULL, submitted_at TEXT NOT NULL,
          answers_json TEXT NOT NULL DEFAULT '[]',
          UNIQUE(quiz_id,student_id)
        );
        CREATE TABLE IF NOT EXISTS submissions (
          id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
          student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          score REAL, notes TEXT NOT NULL DEFAULT '', feedback TEXT NOT NULL DEFAULT '', submitted_at TEXT NOT NULL,
          UNIQUE(assignment_id,student_id)
        );
        CREATE TABLE IF NOT EXISTS submission_files (
          id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
          name TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL
        );
        CREATE TABLE IF NOT EXISTS class_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT, class_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
          sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          body TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS direct_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          body TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS admin_activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          target_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          action TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS app_settings (
          setting_key TEXT PRIMARY KEY, setting_json TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id,expires_at);
        CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at);
        CREATE INDEX IF NOT EXISTS idx_memberships_user ON class_memberships(user_id);
        CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id,due_date);
        CREATE INDEX IF NOT EXISTS idx_quizzes_class ON quizzes(class_id,created_at);
        CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id,submitted_at);
        CREATE INDEX IF NOT EXISTS idx_submission_files_submission ON submission_files(submission_id);
        CREATE INDEX IF NOT EXISTS idx_class_messages_thread ON class_messages(class_id,sender_id,recipient_id,id);
        CREATE INDEX IF NOT EXISTS idx_direct_messages_thread ON direct_messages(sender_id,recipient_id,id);
        CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity(id DESC);
        """)
        user_columns={row[1] for row in db.execute("PRAGMA table_info(users)").fetchall()}
        if "is_admin" not in user_columns:
            db.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
        if "is_disabled" not in user_columns:
            db.execute("ALTER TABLE users ADD COLUMN is_disabled INTEGER NOT NULL DEFAULT 0")
        submission_columns={row[1] for row in db.execute("PRAGMA table_info(submissions)").fetchall()}
        if "feedback" not in submission_columns:
            db.execute("ALTER TABLE submissions ADD COLUMN feedback TEXT NOT NULL DEFAULT ''")
        quiz_columns={row[1] for row in db.execute("PRAGMA table_info(quizzes)").fetchall()}
        if "due_date" not in quiz_columns:
            db.execute("ALTER TABLE quizzes ADD COLUMN due_date TEXT NOT NULL DEFAULT ''")
        attempt_columns={row[1] for row in db.execute("PRAGMA table_info(quiz_attempts)").fetchall()}
        if "answers_json" not in attempt_columns:
            db.execute("ALTER TABLE quiz_attempts ADD COLUMN answers_json TEXT NOT NULL DEFAULT '[]'")
        db.execute("DELETE FROM sessions WHERE expires_at < ?", (int(time.time()),))
        db.execute("DELETE FROM oauth_states WHERE expires_at < ?", (int(time.time()),))
        db.execute("INSERT OR IGNORE INTO app_settings(setting_key,setting_json,updated_at) VALUES('appearance',?,?)",
                   (json.dumps({"background": "angkor"}), utc_now()))


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def password_digest(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS, dklen=32)


def secure_cookies_enabled() -> bool:
    configured = os.environ.get("STUDYTRACK_SECURE_COOKIE")
    if configured is not None:
        return configured == "1"
    # Render and similar hosting platforms provide PORT for the HTTPS service.
    # Keep local http://127.0.0.1 development working when PORT is absent.
    return bool(os.environ.get("PORT"))


def rate_limited(ip: str, limit: int = AUTH_ATTEMPT_LIMIT, window: int = AUTH_ATTEMPT_WINDOW) -> bool:
    now = time.monotonic()
    with AUTH_LOCK:
        attempts = [stamp for stamp in AUTH_ATTEMPTS.get(ip, []) if stamp > now - window]
        if attempts:
            AUTH_ATTEMPTS[ip] = attempts
        else:
            AUTH_ATTEMPTS.pop(ip, None)
        return len(attempts) >= limit


def record_failed_auth(ip: str, window: int = AUTH_ATTEMPT_WINDOW) -> None:
    now = time.monotonic()
    with AUTH_LOCK:
        if ip not in AUTH_ATTEMPTS and len(AUTH_ATTEMPTS) >= AUTH_ATTEMPT_KEYS_LIMIT:
            oldest_key = next(iter(AUTH_ATTEMPTS))
            AUTH_ATTEMPTS.pop(oldest_key, None)
        attempts = [stamp for stamp in AUTH_ATTEMPTS.get(ip, []) if stamp > now - window]
        attempts.append(now)
        AUTH_ATTEMPTS[ip] = attempts


def log_activity(db: sqlite3.Connection, actor_id: str | None, action: str, target_id: str | None = None) -> None:
    """Store a short event label for admins; never store message or study-record contents."""
    db.execute("INSERT INTO admin_activity(actor_id,target_id,action,created_at) VALUES(?,?,?,?)",
               (actor_id, target_id, action[:180], utc_now()))
    db.execute("DELETE FROM admin_activity WHERE id NOT IN (SELECT id FROM admin_activity ORDER BY id DESC LIMIT 5000)")


class StudyTrackHandler(BaseHTTPRequestHandler):
    server_version = "StudyTrack"
    sys_version = ""

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        if secure_cookies_enabled():
            self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        super().end_headers()

    def log_message(self, fmt: str, *args: object) -> None:
        if os.environ.get("STUDYTRACK_ACCESS_LOG", "0") == "1":
            super().log_message(fmt, *args)

    def client_ip(self) -> str:
        # Render's edge overwrites CF-Connecting-IP with the public client IP.
        # Do not trust generic X-Forwarded-For values supplied by callers.
        if os.environ.get("PORT"):
            forwarded_ip = self.headers.get("CF-Connecting-IP", "").strip()
            try:
                return ipaddress.ip_address(forwarded_ip).compressed
            except ValueError:
                pass
        return self.client_address[0]

    def send_json(self, payload: object, status: int = 200, cookie: str | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status: int, message: str) -> None:
        self.send_json({"error": message}, status)

    def read_json(self) -> dict:
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            raise ValueError("Send the request as application/json.")
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Invalid request size.")
        if length < 0 or length > MAX_BODY:
            raise OverflowError("Request is too large.")
        raw = self.rfile.read(length)
        try:
            value = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValueError("Send valid JSON data.")
        if not isinstance(value, dict):
            raise ValueError("The request body must be a JSON object.")
        return value

    def check_origin(self) -> bool:
        origin = self.headers.get("Origin")
        if not origin:
            return False
        try:
            parsed = urlsplit(origin)
            request_host = self.headers.get("Host", "").lower()
            if (parsed.scheme not in {"http", "https"} or not parsed.netloc
                    or parsed.path or parsed.query or parsed.fragment
                    or parsed.netloc.lower() != request_host):
                return False
            return not secure_cookies_enabled() or parsed.scheme == "https"
        except ValueError:
            return False

    def session(self):
        jar = SimpleCookie()
        try:
            jar.load(self.headers.get("Cookie", ""))
            token = jar[COOKIE_NAME].value
        except (KeyError, Exception):
            return None
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        with connect_db() as db:
            row = db.execute("""SELECT s.csrf_token,s.expires_at,u.id,u.email,u.name,u.role,u.is_admin,u.is_disabled
                                FROM sessions s JOIN users u ON u.id=s.user_id
                                WHERE s.token_hash=?""", (token_hash,)).fetchone()
            if not row or row["is_disabled"] or row["expires_at"] < int(time.time()):
                return None
            return {"token_hash": token_hash, "csrf": row["csrf_token"], "id": row["id"],
                    "email": row["email"], "name": row["name"],
                    "role": "admin" if row["is_admin"] else row["role"], "is_admin": bool(row["is_admin"])}

    def require_session(self, csrf: bool = False):
        user = self.session()
        if not user:
            self.send_error_json(HTTPStatus.UNAUTHORIZED, "Please sign in to continue.")
            return None
        if csrf:
            if not self.check_origin():
                self.send_error_json(HTTPStatus.FORBIDDEN, "Request origin was not accepted.")
                return None
            given = self.headers.get("X-CSRF-Token", "")
            if not given or not hmac.compare_digest(given, user["csrf"]):
                self.send_error_json(HTTPStatus.FORBIDDEN, "Your session needs refreshing. Sign in again.")
                return None
        return user

    def set_session_cookie(self, token: str) -> str:
        secure = secure_cookies_enabled()
        parts = [f"{COOKIE_NAME}={token}", "Path=/", "HttpOnly", "SameSite=Lax", f"Max-Age={SESSION_SECONDS}"]
        if secure:
            parts.append("Secure")
        return "; ".join(parts)

    def make_session(self, user_id: str) -> tuple[str, str]:
        token = secrets.token_urlsafe(36)
        csrf = secrets.token_urlsafe(32)
        with connect_db() as db:
            db.execute("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES(?,?,?,?)",
                       (hashlib.sha256(token.encode()).hexdigest(), user_id, csrf, int(time.time()) + SESSION_SECONDS))
        return token, csrf

    def user_payload(self, row) -> dict:
        is_admin = bool(row["is_admin"]) if "is_admin" in row.keys() else False
        return {"id": row["id"], "email": row["email"], "name": row["name"],
                "role": "admin" if is_admin else row["role"], "is_admin": is_admin}

    def request_cookie(self, name: str) -> str:
        jar = SimpleCookie()
        try:
            jar.load(self.headers.get("Cookie", ""))
            return jar[name].value
        except Exception:
            return ""

    def oauth_redirect(self, location: str, cookies: list[str] | None = None) -> None:
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", location)
        self.send_header("Cache-Control", "no-store")
        for cookie in cookies or []:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()

    def oauth_error(self, code: str, provider: str = "") -> None:
        safe_code = code if code in {"not_configured", "cancelled", "failed", "telegram_unlinked", "login_required", "link_conflict", "email_unavailable"} else "failed"
        suffix = f"&provider={provider}" if provider in OAUTH_PROVIDERS else ""
        self.oauth_redirect(f"/?auth_error={safe_code}{suffix}")

    def oauth_cookie(self, provider: str, state: str, clear: bool = False) -> str:
        value = "" if clear else state
        max_age = 0 if clear else 600
        parts = [f"studytrack_oauth_{provider}={value}", "Path=/", "HttpOnly", "SameSite=Lax", f"Max-Age={max_age}"]
        if secure_cookies_enabled():
            parts.append("Secure")
        return "; ".join(parts)

    def oauth_public_base(self) -> str:
        configured = os.environ.get("STUDYTRACK_PUBLIC_URL", "").strip().rstrip("/")
        request_host = self.headers.get("Host", "").strip()
        if configured:
            parsed = urlsplit(configured)
            if (parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path or parsed.query or parsed.fragment
                    or parsed.username or parsed.password or parsed.netloc.lower() != request_host.lower()):
                raise ValueError("STUDYTRACK_PUBLIC_URL must be this site's exact HTTPS origin.")
            if secure_cookies_enabled() and parsed.scheme != "https":
                raise ValueError("Social sign-in requires an HTTPS public URL when hosted online.")
            return configured
        if not re.fullmatch(r"[A-Za-z0-9.-]+(?::[0-9]{1,5})?", request_host):
            raise ValueError("Set STUDYTRACK_PUBLIC_URL to your site's HTTPS origin before enabling social sign-in.")
        scheme = "https" if secure_cookies_enabled() else "http"
        return f"{scheme}://{request_host}"

    def oauth_json_request(self, url: str, data: dict | None = None, headers: dict | None = None):
        request_headers = {"Accept": "application/json", "User-Agent": "StudyTrack sign-in"}
        request_headers.update(headers or {})
        body = None
        if data is not None:
            body = urlencode(data).encode("utf-8")
            request_headers.setdefault("Content-Type", "application/x-www-form-urlencoded")
        request = Request(url, data=body, headers=request_headers, method="POST" if body is not None else "GET")
        try:
            with urlopen(request, timeout=15) as response:
                raw = response.read(1_048_577)
            if len(raw) > 1_048_576:
                raise ValueError("The identity provider returned an oversized response.")
            result = json.loads(raw.decode("utf-8"))
            if not isinstance(result, (dict, list)):
                raise ValueError("The identity provider returned an unexpected response.")
            return result
        except (HTTPError, URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("The identity provider could not complete sign-in. Please try again.") from exc

    def verify_oidc_token(self, token: str, provider: str, client_id: str, nonce: str) -> dict:
        if provider == "google":
            jwks_url, issuer = "https://www.googleapis.com/oauth2/v3/certs", "https://accounts.google.com"
        elif provider == "telegram":
            jwks_url, issuer = "https://oauth.telegram.org/.well-known/jwks.json", "https://oauth.telegram.org"
        else:
            raise ValueError("This provider does not use OpenID Connect.")
        signing_key = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600, timeout=10).get_signing_key_from_jwt(token)
        claims = jwt.decode(token, signing_key.key, algorithms=["RS256"], audience=client_id,
                            issuer=issuer, leeway=60, options={"require": ["exp", "iat", "sub"]})
        received_nonce = str(claims.get("nonce", ""))
        if not received_nonce or not hmac.compare_digest(received_nonce, nonce):
            raise ValueError("The identity provider response did not pass sign-in verification.")
        return claims

    def fetch_oauth_identity(self, provider: str, code: str, verifier: str, nonce: str, redirect_uri: str, client_id: str, client_secret: str) -> tuple[str, str, str]:
        config = OAUTH_PROVIDERS[provider]
        token_headers = {"Accept": "application/json"}
        token_data = {"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri,
                      "client_id": client_id, "code_verifier": verifier}
        if provider == "telegram":
            import base64
            basic = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("ascii")
            token_headers["Authorization"] = f"Basic {basic}"
        else:
            token_data["client_secret"] = client_secret
        token = self.oauth_json_request(config["token_url"], token_data, token_headers)
        if not isinstance(token, dict) or not token.get("access_token"):
            raise ValueError("The identity provider did not issue a sign-in token.")

        if provider == "google":
            claims = self.verify_oidc_token(str(token.get("id_token", "")), provider, client_id, nonce)
            if claims.get("email_verified") is not True:
                raise ValueError("Use a verified Google email address to continue.")
            email = str(claims.get("email", "")).strip().lower()
            if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
                raise ValueError("Google did not provide a valid email address.")
            return str(claims["sub"]), email, str(claims.get("name") or email.split("@", 1)[0])

        if provider == "github":
            bearer_headers = {"Authorization": f"Bearer {token['access_token']}",
                              "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
            person = self.oauth_json_request("https://api.github.com/user", headers=bearer_headers)
            emails = self.oauth_json_request("https://api.github.com/user/emails?per_page=100", headers=bearer_headers)
            if not isinstance(person, dict) or not isinstance(emails, list):
                raise ValueError("GitHub did not return a usable account profile.")
            primary = next((item for item in emails if isinstance(item, dict) and item.get("primary") is True and item.get("verified") is True), None)
            email = str(primary.get("email", "")).strip().lower() if primary else ""
            if not email or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
                raise ValueError("GitHub needs a verified primary email address for StudyTrack sign-in.")
            subject = str(person.get("id", ""))
            name = str(person.get("name") or person.get("login") or email.split("@", 1)[0])
            if not subject:
                raise ValueError("GitHub did not return a stable account ID.")
            return subject, email, name

        claims = self.verify_oidc_token(str(token.get("id_token", "")), provider, client_id, nonce)
        subject = str(claims.get("sub", ""))
        if not subject:
            raise ValueError("Telegram did not return a stable account ID.")
        # Telegram does not provide an email claim. A login must first be linked to a StudyTrack account.
        return subject, "", str(claims.get("name") or claims.get("preferred_username") or "Telegram user")

    def oauth_start(self, provider: str, link: bool = False, return_json: bool = False) -> None:
        config = OAUTH_PROVIDERS.get(provider)
        if not config:
            if return_json:
                self.send_error_json(HTTPStatus.NOT_FOUND, "That sign-in provider is not available.")
            else:
                self.oauth_error("failed")
            return
        client_id = os.environ.get(config["client_id_env"], "").strip()
        client_secret = os.environ.get(config["client_secret_env"], "").strip()
        if not client_id or not client_secret:
            if return_json:
                self.send_error_json(HTTPStatus.SERVICE_UNAVAILABLE, f"{provider.title()} sign-in is not configured by the app owner yet.")
            else:
                self.oauth_error("not_configured", provider)
            return
        user = self.session() if link else None
        if link and not user:
            if return_json:
                self.send_error_json(HTTPStatus.UNAUTHORIZED, "Sign in before connecting a social login method.")
            else:
                self.oauth_error("login_required", provider)
            return
        try:
            redirect_uri = self.oauth_public_base() + f"/auth/{provider}/callback"
        except ValueError:
            if return_json:
                self.send_error_json(HTTPStatus.SERVICE_UNAVAILABLE, "Set STUDYTRACK_PUBLIC_URL to this site's HTTPS origin before connecting social sign-in.")
            else:
                self.oauth_error("not_configured", provider)
            return

        state = secrets.token_urlsafe(32)
        verifier = secrets.token_urlsafe(48)
        nonce = secrets.token_urlsafe(32)
        challenge = urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode("ascii")
        with connect_db() as db:
            db.execute("DELETE FROM oauth_states WHERE expires_at < ?", (int(time.time()),))
            db.execute("INSERT INTO oauth_states(state_hash,provider,code_verifier,nonce,link_user_id,expires_at,created_at) VALUES(?,?,?,?,?,?,?)",
                       (hashlib.sha256(state.encode()).hexdigest(), provider, verifier, nonce, user["id"] if user else None,
                        int(time.time()) + 600, utc_now()))
        scope = {"google": "openid email profile", "github": "read:user user:email", "telegram": "openid profile"}[provider]
        params = {"client_id": client_id, "redirect_uri": redirect_uri, "response_type": "code",
                  "scope": scope, "state": state, "code_challenge": challenge, "code_challenge_method": "S256"}
        if provider in {"google", "telegram"}:
            params["nonce"] = nonce
        if provider == "google":
            params.update({"prompt": "select_account", "access_type": "online"})
        location = config["authorize_url"] + "?" + urlencode(params)
        state_cookie = self.oauth_cookie(provider, state)
        if return_json:
            self.send_json({"url": location}, cookie=state_cookie)
        else:
            self.oauth_redirect(location, [state_cookie])

    def oauth_callback(self, provider: str) -> None:
        config = OAUTH_PROVIDERS.get(provider)
        if not config:
            self.oauth_error("failed")
            return
        query = parse_qs(urlsplit(self.path).query)
        state = str(query.get("state", [""])[0])
        cookie_state = self.request_cookie(f"studytrack_oauth_{provider}")
        clear_cookie = self.oauth_cookie(provider, "", clear=True)
        if not state or not cookie_state or not hmac.compare_digest(state, cookie_state):
            self.oauth_redirect("/?auth_error=failed", [clear_cookie])
            return
        state_hash = hashlib.sha256(state.encode()).hexdigest()
        with connect_db() as db:
            state_row = db.execute("SELECT * FROM oauth_states WHERE state_hash=? AND provider=? AND expires_at>=?",
                                   (state_hash, provider, int(time.time()))).fetchone()
            if state_row:
                db.execute("DELETE FROM oauth_states WHERE state_hash=?", (state_hash,))
        if not state_row:
            self.oauth_redirect("/?auth_error=failed", [clear_cookie])
            return
        if query.get("error"):
            self.oauth_redirect("/?auth_error=cancelled", [clear_cookie])
            return
        code = str(query.get("code", [""])[0])
        client_id = os.environ.get(config["client_id_env"], "").strip()
        client_secret = os.environ.get(config["client_secret_env"], "").strip()
        try:
            if not code or not client_id or not client_secret:
                raise ValueError("The identity provider did not complete sign-in.")
            redirect_uri = self.oauth_public_base() + f"/auth/{provider}/callback"
            subject, email, name = self.fetch_oauth_identity(provider, code, state_row["code_verifier"],
                                                              state_row["nonce"], redirect_uri, client_id, client_secret)
            link_user_id = state_row["link_user_id"]
            if link_user_id:
                current = self.session()
                if not current or current["id"] != link_user_id:
                    raise ValueError("Sign in again before connecting a social login method.")
                self.link_oauth_identity(provider, subject, link_user_id)
                self.oauth_redirect("/?auth_status=linked", [clear_cookie])
                return
            if provider == "telegram":
                linked = self.find_oauth_user(provider, subject)
                if not linked:
                    raise LookupError("Telegram must be connected from StudyTrack Settings before it can be used to sign in.")
                user = linked
            else:
                user = self.create_or_link_oauth_user(provider, subject, email, name)
            if user["is_disabled"]:
                raise ValueError("This StudyTrack account is paused. Contact the app owner.")
            with connect_db() as db:
                log_activity(db, user["id"], f"Signed in with {provider.title()}")
            token, _csrf = self.make_session(user["id"])
            self.oauth_redirect("/", [clear_cookie, self.set_session_cookie(token)])
        except LookupError:
            self.oauth_redirect("/?auth_error=telegram_unlinked", [clear_cookie])
        except Exception:
            self.oauth_redirect(f"/?auth_error=failed&provider={provider}", [clear_cookie])

    def find_oauth_user(self, provider: str, subject: str):
        with connect_db() as db:
            return db.execute("""SELECT u.* FROM oauth_accounts a JOIN users u ON u.id=a.user_id
                                WHERE a.provider=? AND a.subject=?""", (provider, subject)).fetchone()

    def link_oauth_identity(self, provider: str, subject: str, user_id: str) -> None:
        with connect_db() as db:
            existing = db.execute("SELECT user_id FROM oauth_accounts WHERE provider=? AND subject=?", (provider, subject)).fetchone()
            if existing and existing["user_id"] != user_id:
                raise ValueError("This social account is already connected to another StudyTrack account.")
            already_linked = db.execute("SELECT subject FROM oauth_accounts WHERE provider=? AND user_id=?", (provider, user_id)).fetchone()
            if already_linked and already_linked["subject"] != subject:
                raise ValueError(f"A different {provider.title()} account is already connected to this StudyTrack account.")
            try:
                db.execute("INSERT OR IGNORE INTO oauth_accounts(provider,subject,user_id,created_at) VALUES(?,?,?,?)",
                           (provider, subject, user_id, utc_now()))
                log_activity(db, user_id, f"Connected {provider.title()} sign-in")
            except sqlite3.IntegrityError as exc:
                raise ValueError("A different account from this provider is already connected.") from exc

    def create_or_link_oauth_user(self, provider: str, subject: str, email: str, name: str):
        linked = self.find_oauth_user(provider, subject)
        if linked:
            return linked
        clean_name = " ".join(str(name).split())[:60] or email.split("@", 1)[0]
        with connect_db() as db:
            row = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
            if row:
                if row["is_disabled"]:
                    raise ValueError("This StudyTrack account is paused. Contact the app owner.")
                user_id = row["id"]
            else:
                user_id = secrets.token_urlsafe(18)
                salt = secrets.token_bytes(16)
                random_password = secrets.token_urlsafe(48)
                db.execute("INSERT INTO users(id,email,name,role,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?,?)",
                           (user_id, email, clean_name, "student", salt.hex(), password_digest(random_password, salt).hex(), utc_now()))
                log_activity(db, user_id, f"Created a student account with {provider.title()}")
            try:
                db.execute("INSERT INTO oauth_accounts(provider,subject,user_id,created_at) VALUES(?,?,?,?)",
                           (provider, subject, user_id, utc_now()))
            except sqlite3.IntegrityError as exc:
                raise ValueError("This social account is already connected to a different StudyTrack account.") from exc
            return db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()

    def get_oauth_providers(self, user: dict) -> None:
        with connect_db() as db:
            rows = db.execute("SELECT provider FROM oauth_accounts WHERE user_id=? ORDER BY provider", (user["id"],)).fetchall()
        self.send_json({"providers": [row["provider"] for row in rows]})

    def do_GET(self) -> None:
        path = unquote(urlsplit(self.path).path)
        try:
            match = re.fullmatch(r"/auth/(google|github|telegram)(?:/callback)?", path)
            if match:
                provider = match.group(1)
                if path.endswith("/callback"):
                    self.oauth_callback(provider)
                else:
                    self.oauth_start(provider)
                return
            if path == "/api/health":
                # Render should verify that the Python API and its database are
                # reachable, rather than treating a static homepage as healthy.
                with connect_db() as db:
                    db.execute("SELECT 1").fetchone()
                self.send_json({"ok": True, "service": "StudyTrack API"})
                return
            if path == "/api/app/settings":
                with connect_db() as db:
                    row = db.execute("SELECT setting_json FROM app_settings WHERE setting_key='appearance'").fetchone()
                try:
                    appearance = json.loads(row["setting_json"]) if row else {"background": "angkor"}
                except (TypeError, json.JSONDecodeError):
                    appearance = {"background": "angkor"}
                background = appearance.get("background", "angkor") if isinstance(appearance, dict) else "angkor"
                if background not in ("angkor", "aurora") and not (isinstance(background, str) and len(background) <= 2_850_000 and re.fullmatch(r"data:image/(?:gif|png|jpeg|webp);base64,[A-Za-z0-9+/=]+", background)):
                    background = "angkor"
                self.send_json({"background": background})
                return
            if path == "/api/session":
                user = self.session()
                self.send_json({"user": {k: user[k] for k in ("id","email","name","role")} if user else None,
                                "csrf": user["csrf"] if user else None})
                return
            if path == "/api/auth/providers":
                user = self.require_session()
                if user:
                    self.get_oauth_providers(user)
                return
            if path == "/api/data":
                user = self.require_session()
                if user:
                    self.get_user_data(user)
                return
            if path == "/api/admin/overview":
                user = self.require_session()
                if user:
                    self.get_admin_overview(user)
                return
            if path == "/api/messages":
                user = self.require_session()
                if user:
                    peer_id=parse_qs(urlsplit(self.path).query).get("with", [""])[0]
                    self.get_direct_messages(user, peer_id)
                return
            if path == "/api/people/lookup":
                user = self.require_session()
                if user:
                    email=parse_qs(urlsplit(self.path).query).get("email", [""])[0]
                    self.lookup_person(user, email)
                return
            if path == "/api/classes":
                user = self.require_session()
                if user:
                    self.get_classes(user)
                return
            match = re.fullmatch(r"/api/classes/([A-Za-z0-9_-]+)/quizzes", path)
            if match:
                user = self.require_session()
                if user:
                    self.get_class_quizzes(user, match.group(1))
                return
            match = re.fullmatch(r"/api/quizzes/([A-Za-z0-9_-]+)/attempts", path)
            if match:
                user = self.require_session()
                if user:
                    self.get_quiz_attempts(user, match.group(1))
                return
            match = re.fullmatch(r"/api/quizzes/([A-Za-z0-9_-]+)", path)
            if match:
                user = self.require_session()
                if user:
                    self.get_quiz(user, match.group(1))
                return
            match = re.fullmatch(r"/api/profiles/([A-Za-z0-9_-]+)", path)
            if match:
                user = self.require_session()
                if user:
                    self.get_shared_profile(user, match.group(1))
                return
            match = re.fullmatch(r"/api/classes/([A-Za-z0-9_-]+)/messages", path)
            if match:
                user = self.require_session()
                if user:
                    recipient_id=parse_qs(urlsplit(self.path).query).get("with", [""])[0]
                    self.get_class_messages(user, match.group(1), recipient_id)
                return
            match = re.fullmatch(r"/api/submissions/([A-Za-z0-9_-]+)/files/([A-Za-z0-9_-]+)", path)
            if match:
                user = self.require_session()
                if user:
                    self.download_submission_file(user, match.group(1), match.group(2))
                return
            match = re.fullmatch(r"/api/classes/([A-Za-z0-9_-]+)", path)
            if match:
                user = self.require_session()
                if user:
                    self.get_class_detail(user, match.group(1))
                return
            if path.startswith("/api/"):
                self.send_error_json(HTTPStatus.NOT_FOUND, "That API route was not found.")
                return
            self.serve_static(path)
        except Exception:
            traceback.print_exc()
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, "StudyTrack could not complete that request.")

    def do_POST(self) -> None:
        path = unquote(urlsplit(self.path).path)
        try:
            match = re.fullmatch(r"/api/auth/(google|github|telegram)/link", path)
            if match:
                user = self.require_session(csrf=True)
                if user:
                    self.oauth_start(match.group(1), link=True, return_json=True)
                return
            if path == "/api/register":
                self.register()
                return
            if path == "/api/login":
                self.login()
                return
            if path == "/api/logout":
                user = self.require_session(csrf=True)
                if user:
                    with connect_db() as db:
                        db.execute("DELETE FROM sessions WHERE token_hash=?", (user["token_hash"],))
                    cookie = f"{COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" + ("; Secure" if secure_cookies_enabled() else "")
                    self.send_json({"ok": True}, cookie=cookie)
                return
            if path == "/api/classes":
                user = self.require_session(csrf=True)
                if user:
                    self.create_class(user)
                return
            if path == "/api/classes/join":
                user = self.require_session(csrf=True)
                if user:
                    self.join_class(user)
                return
            if path == "/api/messages":
                user = self.require_session(csrf=True)
                if user:
                    self.create_direct_message(user)
                return
            match = re.fullmatch(r"/api/classes/([A-Za-z0-9_-]+)/quizzes", path)
            if match:
                user = self.require_session(csrf=True)
                if user:
                    self.create_quiz(user, match.group(1))
                return
            match = re.fullmatch(r"/api/quizzes/([A-Za-z0-9_-]+)/attempts", path)
            if match:
                user = self.require_session(csrf=True)
                if user:
                    self.submit_quiz(user, match.group(1))
                return
            match = re.fullmatch(r"/api/classes/([A-Za-z0-9_-]+)/assignments", path)
            if match:
                user = self.require_session(csrf=True)
                if user:
                    self.create_assignment(user, match.group(1))
                return
            match = re.fullmatch(r"/api/classes/([A-Za-z0-9_-]+)/submissions", path)
            if match:
                user = self.require_session(csrf=True)
                if user:
                    self.submit_assignment(user, match.group(1))
                return
            match = re.fullmatch(r"/api/classes/([A-Za-z0-9_-]+)/messages", path)
            if match:
                user = self.require_session(csrf=True)
                if user:
                    self.create_class_message(user, match.group(1))
                return
            if path.startswith("/api/"):
                self.send_error_json(HTTPStatus.NOT_FOUND, "That API route was not found.")
                return
            self.send_error_json(HTTPStatus.NOT_FOUND, "That route was not found.")
        except OverflowError as exc:
            self.send_error_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, str(exc))
        except (ValueError, TypeError) as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
        except Exception:
            traceback.print_exc()
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, "StudyTrack could not complete that request.")

    def do_PUT(self) -> None:
        path = unquote(urlsplit(self.path).path)
        try:
            if path == "/api/admin/settings":
                user = self.require_session(csrf=True)
                if not user:
                    return
                if user.get("role") != "admin":
                    self.send_error_json(HTTPStatus.FORBIDDEN, "Admin access is required.")
                    return
                body = self.read_json()
                background = body.get("background")
                if background in ("angkor", "aurora"):
                    safe_background = background
                elif isinstance(background, str):
                    match = re.fullmatch(r"data:image/(gif|png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})", background)
                    if not match:
                        raise ValueError("Choose a valid GIF, PNG, JPG, or WebP background.")
                    try:
                        image = b64decode(match.group(2), validate=True)
                    except (ValueError, binascii.Error):
                        raise ValueError("The uploaded background image is not valid.")
                    if not image or len(image) > 2 * 1024 * 1024:
                        raise ValueError("Choose a background image under 2 MB.")
                    mime = match.group(1)
                    valid_image = {
                        "gif": image[:6] in (b"GIF87a", b"GIF89a"),
                        "png": image.startswith(b"\x89PNG\r\n\x1a\n"),
                        "jpeg": image.startswith(b"\xff\xd8\xff"),
                        "webp": image.startswith(b"RIFF") and image[8:12] == b"WEBP",
                    }[mime]
                    if not valid_image:
                        raise ValueError("The uploaded file does not match its image type.")
                    safe_background = background
                else:
                    raise ValueError("Choose Angkor Wat, animated aurora, or upload an image.")
                with connect_db() as db:
                    db.execute("INSERT INTO app_settings(setting_key,setting_json,updated_at) VALUES('appearance',?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_json=excluded.setting_json,updated_at=excluded.updated_at",
                               (json.dumps({"background": safe_background}), utc_now()))
                self.send_json({"background": safe_background})
                return
            if path == "/api/data":
                user = self.require_session(csrf=True)
                if user:
                    self.save_user_data(user)
                return
            self.send_error_json(HTTPStatus.NOT_FOUND, "That route was not found.")
        except OverflowError as exc:
            self.send_error_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, str(exc))
        except (ValueError, TypeError) as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
        except Exception:
            traceback.print_exc()
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, "StudyTrack could not save that data.")

    def do_PATCH(self) -> None:
        path = unquote(urlsplit(self.path).path)
        try:
            if path == "/api/account":
                user = self.require_session(csrf=True)
                if user:
                    body = self.read_json()
                    name = str(body.get("name", "")).strip()
                    if not name or len(name) > 60:
                        raise ValueError("Name must be between 1 and 60 characters.")
                    with connect_db() as db:
                        db.execute("UPDATE users SET name=? WHERE id=?", (name, user["id"]))
                        log_activity(db, user["id"], "Updated their display name")
                    updated = {**user, "name": name}
                    self.send_json({"user": self.user_payload(updated)})
                return
            match = re.fullmatch(r"/api/classes/([A-Za-z0-9_-]+)/submissions/([A-Za-z0-9_-]+)", path)
            if match:
                user = self.require_session(csrf=True)
                if user:
                    self.grade_submission(user, match.group(1), match.group(2))
                return
            match = re.fullmatch(r"/api/admin/users/([A-Za-z0-9_-]+)", path)
            if match:
                user = self.require_session(csrf=True)
                if user:
                    self.manage_user(user, match.group(1))
                return
            self.send_error_json(HTTPStatus.NOT_FOUND, "That route was not found.")
        except OverflowError as exc:
            self.send_error_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, str(exc))
        except (ValueError, TypeError) as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
        except Exception:
            traceback.print_exc()
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, "StudyTrack could not update that account.")

    def do_DELETE(self) -> None:
        path = unquote(urlsplit(self.path).path)
        if path == "/api/data":
            user = self.require_session(csrf=True)
            if user:
                with connect_db() as db:
                    log_activity(db, user["id"], "Cleared personal study data")
                    db.execute("DELETE FROM user_data WHERE user_id=?", (user["id"],))
                self.send_json({"ok": True})
            return
        self.send_error_json(HTTPStatus.NOT_FOUND, "That route was not found.")

    def register(self) -> None:
        if not self.check_origin():
            self.send_error_json(HTTPStatus.FORBIDDEN, "Request origin was not accepted.")
            return
        ip = self.client_ip()
        if rate_limited(ip):
            self.send_error_json(HTTPStatus.TOO_MANY_REQUESTS, "Too many sign-in attempts. Wait a few minutes and try again.")
            return
        body = self.read_json()
        name = str(body.get("name", "")).strip()
        email = str(body.get("email", "")).strip().lower()
        password = str(body.get("password", ""))
        role = str(body.get("role", "student"))
        if not 1 <= len(name) <= 60:
            raise ValueError("Name must be between 1 and 60 characters.")
        if len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            raise ValueError("Enter a valid email address.")
        if len(password) < 10 or len(password) > 128:
            raise ValueError("Choose a password with at least 10 characters.")
        if role not in ("student", "teacher", "admin"):
            raise ValueError("Choose Student, Teacher, or Admin.")
        is_admin = 0
        if role == "admin":
            admin_code = os.environ.get("STUDYTRACK_ADMIN_CODE", "")
            supplied = str(body.get("admin_code", ""))
            if not admin_code or not hmac.compare_digest(admin_code, supplied):
                record_failed_auth(ip)
                self.send_error_json(HTTPStatus.FORBIDDEN, "Admin registration needs the private admin code from the app owner.")
                return
            is_admin = 1
        if role == "teacher":
            teacher_code = os.environ.get("STUDYTRACK_TEACHER_CODE", "")
            supplied = str(body.get("teacher_code", ""))
            if not teacher_code or not hmac.compare_digest(teacher_code, supplied):
                record_failed_auth(ip)
                self.send_error_json(HTTPStatus.FORBIDDEN, "Teacher registration needs the teacher access code from the app owner.")
                return
        salt = secrets.token_bytes(16)
        user_id = secrets.token_urlsafe(18)
        try:
            with connect_db() as db:
                stored_role = "teacher" if is_admin else role
                db.execute("INSERT INTO users(id,email,name,role,password_salt,password_hash,created_at,is_admin) VALUES(?,?,?,?,?,?,?,?)",
                           (user_id,email,name,stored_role,salt.hex(),password_digest(password,salt).hex(),utc_now(),is_admin))
                log_activity(db, user_id, "Created an admin account" if is_admin else f"Created a {role} account")
        except sqlite3.IntegrityError:
            record_failed_auth(ip)
            self.send_error_json(HTTPStatus.CONFLICT, "An account with this email already exists.")
            return
        token, csrf = self.make_session(user_id)
        self.send_json({"user":{"id":user_id,"email":email,"name":name,"role":"admin" if is_admin else role,"is_admin":bool(is_admin)},"csrf":csrf},HTTPStatus.CREATED,self.set_session_cookie(token))

    def login(self) -> None:
        if not self.check_origin():
            self.send_error_json(HTTPStatus.FORBIDDEN, "Request origin was not accepted.")
            return
        ip = self.client_ip()
        if rate_limited(ip):
            self.send_error_json(HTTPStatus.TOO_MANY_REQUESTS, "Too many sign-in attempts. Wait a few minutes and try again.")
            return
        body = self.read_json()
        email = str(body.get("email", "")).strip().lower()
        password = str(body.get("password", ""))
        role = str(body.get("role", ""))
        with connect_db() as db:
            row = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        if not row or row["is_disabled"]:
            record_failed_auth(ip)
            self.send_error_json(HTTPStatus.UNAUTHORIZED, "Email or password was not correct.")
            return
        actual = password_digest(password, bytes.fromhex(row["password_salt"]))
        actual_role = "admin" if row["is_admin"] else row["role"]
        if not hmac.compare_digest(actual, bytes.fromhex(row["password_hash"])) or role != actual_role:
            record_failed_auth(ip)
            self.send_error_json(HTTPStatus.UNAUTHORIZED, "Email, password, or selected account type was not correct.")
            return
        with connect_db() as db:
            log_activity(db, row["id"], "Signed in")
        token, csrf = self.make_session(row["id"])
        self.send_json({"user":self.user_payload(row),"csrf":csrf},cookie=self.set_session_cookie(token))

    def get_user_data(self, user: dict) -> None:
        with connect_db() as db:
            rows = db.execute("SELECT data_key,data_json FROM user_data WHERE user_id=?", (user["id"],)).fetchall()
        data = {row["data_key"]: json.loads(row["data_json"]) for row in rows}
        data.setdefault("profile", {"name":user["name"],"avatar":user["name"][:1].upper(),"photo":"","coverPhoto":"","bio":"","visibility":"classmates","role":user["role"]})
        data.setdefault("subjects",[]);data.setdefault("scores",[]);data.setdefault("tasks",[]);data.setdefault("sessions",[])
        data.setdefault("notes",[]);data.setdefault("goals",[]);data.setdefault("achievements",[])
        data.setdefault("settings", {"theme":"light","focusMinutes":25,"shortBreakMinutes":5,"longBreakMinutes":15,"pinEnabled":False,"pinHash":"","timer":{"mode":"focus","remaining":1500,"running":False,"endsAt":None}})
        if isinstance(data["profile"],dict):
            data["profile"]={**data["profile"],"name":user["name"],"role":user["role"]}
        self.send_json({"data":data})

    def get_admin_overview(self, user: dict) -> None:
        if user.get("role") != "admin":
            self.send_error_json(HTTPStatus.FORBIDDEN, "Admin access is required."); return
        with connect_db() as db:
            counts = {
                "users": db.execute("SELECT COUNT(*) AS n FROM users WHERE is_admin=0").fetchone()["n"],
                "students": db.execute("SELECT COUNT(*) AS n FROM users WHERE role='student' AND is_disabled=0").fetchone()["n"],
                "teachers": db.execute("SELECT COUNT(*) AS n FROM users WHERE role='teacher' AND is_disabled=0 AND is_admin=0").fetchone()["n"],
                "classes": db.execute("SELECT COUNT(*) AS n FROM classrooms").fetchone()["n"],
                "assignments": db.execute("SELECT COUNT(*) AS n FROM assignments").fetchone()["n"],
                "submissions": db.execute("SELECT COUNT(*) AS n FROM submissions").fetchone()["n"],
                "quizzes": db.execute("SELECT COUNT(*) AS n FROM quizzes").fetchone()["n"],
                "quiz_attempts": db.execute("SELECT COUNT(*) AS n FROM quiz_attempts").fetchone()["n"],
                "messages": db.execute("SELECT COUNT(*) AS n FROM direct_messages").fetchone()["n"] + db.execute("SELECT COUNT(*) AS n FROM class_messages").fetchone()["n"],
            }
            users = db.execute("""SELECT u.id,u.email,u.name,u.role,u.is_disabled,u.created_at,
                                  CASE WHEN EXISTS(SELECT 1 FROM class_memberships m WHERE m.user_id=u.id)
                                    OR EXISTS(SELECT 1 FROM classrooms c WHERE c.teacher_id=u.id) THEN 1 ELSE 0 END AS role_locked
                                  FROM users u WHERE u.is_admin=0 ORDER BY u.created_at DESC LIMIT 500""").fetchall()
            activity = db.execute("""SELECT a.id,a.action,a.created_at,
                                   actor.name AS actor_name,actor.role AS actor_role,actor.is_admin AS actor_admin,
                                   target.name AS target_name
                                   FROM admin_activity a
                                   LEFT JOIN users actor ON actor.id=a.actor_id
                                   LEFT JOIN users target ON target.id=a.target_id
                                   ORDER BY a.id DESC LIMIT 120""").fetchall()
        user_payloads = [{**dict(row), "active": not bool(row["is_disabled"])} for row in users]
        activity_payloads = [{**dict(row), "actor_role": "admin" if row["actor_admin"] else row["actor_role"]}
                             for row in activity]
        self.send_json({"stats": counts, "users": user_payloads, "activity": activity_payloads})

    def manage_user(self, user: dict, target_id: str) -> None:
        if user.get("role") != "admin":
            self.send_error_json(HTTPStatus.FORBIDDEN, "Admin access is required."); return
        if target_id == user["id"]:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "You cannot change your own admin account here."); return
        body = self.read_json()
        next_role = body.get("role")
        active = body.get("active")
        if next_role is not None and next_role not in ("student", "teacher"):
            raise ValueError("Choose Student or Teacher for this account.")
        if active is not None and not isinstance(active, bool):
            raise ValueError("Account status must be active or paused.")
        if next_role is None and active is None:
            raise ValueError("Choose a role or account status to update.")
        with connect_db() as db:
            target = db.execute("SELECT id,name,role,is_admin,is_disabled FROM users WHERE id=?", (target_id,)).fetchone()
            if not target:
                self.send_error_json(HTTPStatus.NOT_FOUND, "Account not found."); return
            if target["is_admin"]:
                self.send_error_json(HTTPStatus.FORBIDDEN, "Admin accounts cannot be managed from this screen."); return
            if next_role and next_role != target["role"]:
                memberships = db.execute("SELECT COUNT(*) AS n FROM class_memberships WHERE user_id=?", (target_id,)).fetchone()["n"]
                owned_classes = db.execute("SELECT COUNT(*) AS n FROM classrooms WHERE teacher_id=?", (target_id,)).fetchone()["n"]
                if memberships or owned_classes:
                    raise ValueError("This account belongs to a class. Keep its current role to protect classroom records.")
                db.execute("UPDATE users SET role=? WHERE id=?", (next_role, target_id))
                log_activity(db, user["id"], f"Changed {target['name']}'s role to {next_role}", target_id)
            if active is not None and bool(active) == bool(target["is_disabled"]):
                db.execute("UPDATE users SET is_disabled=? WHERE id=?", (0 if active else 1, target_id))
                if not active:
                    db.execute("DELETE FROM sessions WHERE user_id=?", (target_id,))
                log_activity(db, user["id"], f"{'Restored' if active else 'Paused'} {target['name']}'s account", target_id)
        self.send_json({"ok": True})

    def save_user_data(self, user: dict) -> None:
        body = self.read_json()
        entries = body.get("data")
        if not isinstance(entries, dict) or not entries:
            raise ValueError("Provide one or more StudyTrack data sections.")
        for key,value in entries.items():
            if key not in DATA_KEYS:
                raise ValueError("That data section is not supported.")
            if key in {"subjects","scores","tasks","sessions","notes","goals","achievements"} and not isinstance(value,list):
                raise ValueError(f"The {key} section must be a list.")
            serialized=json.dumps(value,ensure_ascii=False,separators=(",",":"))
            if len(serialized.encode("utf-8"))>900_000:
                raise ValueError("A StudyTrack data section is too large to save.")
            with connect_db() as db:
                db.execute("INSERT INTO user_data(user_id,data_key,data_json) VALUES(?,?,?) ON CONFLICT(user_id,data_key) DO UPDATE SET data_json=excluded.data_json",
                           (user["id"],key,serialized))
        self.send_json({"ok":True})

    def get_classes(self, user: dict) -> None:
        with connect_db() as db:
            if user["role"] == "teacher":
                rows=db.execute("""SELECT c.id,c.name,c.join_code,c.created_at,COUNT(m.user_id) AS member_count
                                   FROM classrooms c LEFT JOIN class_memberships m ON m.class_id=c.id
                                   WHERE c.teacher_id=? GROUP BY c.id ORDER BY c.created_at DESC""",(user["id"],)).fetchall()
            else:
                rows=db.execute("""SELECT c.id,c.name,c.created_at,u.name AS teacher_name,COUNT(a.id) AS assignment_count
                                   FROM classrooms c JOIN class_memberships m ON m.class_id=c.id
                                   JOIN users u ON u.id=c.teacher_id LEFT JOIN assignments a ON a.class_id=c.id
                                   WHERE m.user_id=? GROUP BY c.id ORDER BY c.created_at DESC""",(user["id"],)).fetchall()
        self.send_json({"classes":[dict(row) for row in rows]})

    def get_shared_profile(self, viewer: dict, profile_id: str) -> None:
        """Return only profile fields the account owner chose to share."""
        with connect_db() as db:
            shared = db.execute("""SELECT c.id FROM classrooms c
                                  LEFT JOIN class_memberships vm ON vm.class_id=c.id AND vm.user_id=?
                                  LEFT JOIN class_memberships tm ON tm.class_id=c.id AND tm.user_id=?
                                  WHERE (vm.user_id IS NOT NULL AND tm.user_id IS NOT NULL)
                                     OR (c.teacher_id=? AND tm.user_id IS NOT NULL)
                                     OR (c.teacher_id=? AND vm.user_id IS NOT NULL)
                                  ORDER BY c.created_at LIMIT 1""",
                               (viewer["id"], profile_id, viewer["id"], profile_id)).fetchone()
            row = db.execute("""SELECT u.id,u.name,u.role,u.is_admin,d.data_json
                                FROM users u LEFT JOIN user_data d
                                  ON d.user_id=u.id AND d.data_key='profile'
                                WHERE u.id=? AND u.is_disabled=0""", (profile_id,)).fetchone()
        if not row:
            self.send_error_json(HTTPStatus.NOT_FOUND, "Profile not found.")
            return
        try:
            profile = json.loads(row["data_json"] or "{}")
        except (TypeError, json.JSONDecodeError):
            profile = {}
        if not isinstance(profile, dict):
            profile = {}
        visibility = profile.get("visibility", "classmates")
        is_private = visibility == "private" or (not shared and visibility != "everyone")

        def public_image(value: object) -> str:
            if not isinstance(value, str) or len(value) > 850_000:
                return ""
            if re.fullmatch(r"data:image/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+", value):
                return value
            return ""

        public_profile = {
            "id": row["id"],
            "name": row["name"],
            "role": "admin" if row["is_admin"] else row["role"],
            "visibility": visibility if visibility in ("private", "classmates", "everyone") else "classmates",
            "avatar": str(profile.get("avatar", row["name"][:1])).strip()[:2].upper(),
            "photo": "" if is_private else public_image(profile.get("photo")),
            "coverPhoto": "" if is_private else public_image(profile.get("coverPhoto")),
            "bio": "" if is_private else str(profile.get("bio", "")).strip()[:280],
            "private": is_private,
        }
        self.send_json({"profile": public_profile, "shared_class_id": shared["id"] if shared else None})

    def create_class(self, user: dict) -> None:
        if user["role"] != "teacher":
            self.send_error_json(HTTPStatus.FORBIDDEN,"Only teacher accounts can create classes.");return
        body=self.read_json();name=str(body.get("name","")).strip()
        if not 2<=len(name)<=80: raise ValueError("Class name must be between 2 and 80 characters.")
        class_id=secrets.token_urlsafe(12)
        with connect_db() as db:
            while True:
                code="".join(secrets.choice(CLASS_JOIN_ALPHABET) for _ in range(12))
                if not db.execute("SELECT 1 FROM classrooms WHERE join_code=?",(code,)).fetchone(): break
            db.execute("INSERT INTO classrooms(id,teacher_id,name,join_code,created_at) VALUES(?,?,?,?,?)",(class_id,user["id"],name,code,utc_now()))
            log_activity(db, user["id"], f"Created class: {name}")
        self.send_json({"class":{"id":class_id,"name":name,"join_code":code,"member_count":0}},HTTPStatus.CREATED)

    def join_class(self, user: dict) -> None:
        if user["role"] != "student":
            self.send_error_json(HTTPStatus.FORBIDDEN,"Only student accounts can join a class.");return
        attempt_key=f"join:{user['id']}"
        if rate_limited(attempt_key,limit=8,window=600):
            self.send_error_json(HTTPStatus.TOO_MANY_REQUESTS,"Too many incorrect class codes. Wait a few minutes and try again.");return
        body=self.read_json();code=str(body.get("code","")).strip().upper()
        if not re.fullmatch(rf"(?:[{CLASS_JOIN_ALPHABET}]{{6}}|[{CLASS_JOIN_ALPHABET}]{{12}})",code):
            record_failed_auth(attempt_key,window=600)
            self.send_error_json(HTTPStatus.NOT_FOUND,"That class code was not found.");return
        with connect_db() as db:
            classroom=db.execute("SELECT id,name FROM classrooms WHERE join_code=?",(code,)).fetchone()
            if not classroom:
                record_failed_auth(attempt_key,window=600)
                self.send_error_json(HTTPStatus.NOT_FOUND,"That class code was not found.");return
            db.execute("INSERT OR IGNORE INTO class_memberships(class_id,user_id,joined_at) VALUES(?,?,?)",(classroom["id"],user["id"],utc_now()))
            log_activity(db, user["id"], f"Joined class: {classroom['name']}")
        with AUTH_LOCK:
            AUTH_ATTEMPTS.pop(attempt_key,None)
        self.send_json({"class":{"id":classroom["id"],"name":classroom["name"]}},HTTPStatus.CREATED)

    def get_class_detail(self,user:dict,class_id:str)->None:
        with connect_db() as db:
            classroom=db.execute("SELECT c.*,u.name AS teacher_name FROM classrooms c JOIN users u ON u.id=c.teacher_id WHERE c.id=?",(class_id,)).fetchone()
            if not classroom:
                self.send_error_json(HTTPStatus.NOT_FOUND,"Class not found.");return
            teacher=user["id"]==classroom["teacher_id"] and user["role"]=="teacher"
            member=db.execute("SELECT 1 FROM class_memberships WHERE class_id=? AND user_id=?",(class_id,user["id"])).fetchone()
            if not teacher and not member:
                self.send_error_json(HTTPStatus.FORBIDDEN,"Join this class to view its work.");return
            if teacher:
                members=[dict(row) for row in db.execute("SELECT u.id,u.name,u.email,m.joined_at FROM class_memberships m JOIN users u ON u.id=m.user_id WHERE m.class_id=? ORDER BY u.name",(class_id,)).fetchall()]
            else:
                members=[dict(row) for row in db.execute("SELECT u.id,u.name,m.joined_at FROM class_memberships m JOIN users u ON u.id=m.user_id WHERE m.class_id=? ORDER BY u.name",(class_id,)).fetchall()]
            assignment_rows=db.execute("SELECT * FROM assignments WHERE class_id=? ORDER BY due_date,created_at",(class_id,)).fetchall()
            assignments=[]
            for assignment in assignment_rows:
                item=dict(assignment)
                if teacher:
                    item["submissions"]=[dict(row) for row in db.execute("SELECT s.id,s.score,s.notes,s.feedback,s.submitted_at,u.id AS student_id,u.name AS student_name,u.email FROM submissions s JOIN users u ON u.id=s.student_id WHERE s.assignment_id=? ORDER BY u.name",(item["id"],)).fetchall()]
                    for submission in item["submissions"]:
                        submission["files"]=[dict(file) for file in db.execute("SELECT id,name,size FROM submission_files WHERE submission_id=? ORDER BY name",(submission["id"],)).fetchall()]
                else:
                    my_submission=db.execute("SELECT id,score,notes,feedback,submitted_at FROM submissions WHERE assignment_id=? AND student_id=?",(item["id"],user["id"])).fetchone()
                    item["my_submission"]=dict(my_submission) if my_submission else {}
                    if my_submission:
                        item["my_submission"]["files"]=[dict(file) for file in db.execute("SELECT id,name,size FROM submission_files WHERE submission_id=? ORDER BY name",(my_submission["id"],)).fetchall()]
                assignments.append(item)
        classroom_data={"id":classroom["id"],"name":classroom["name"],"join_code":classroom["join_code"] if teacher else None,"teacher_id":classroom["teacher_id"],"teacher_name":classroom["teacher_name"],"members":members,"assignments":assignments}
        self.send_json({"class":classroom_data,"role":"teacher" if teacher else "student"})

    def create_assignment(self,user:dict,class_id:str)->None:
        if user["role"]!="teacher":
            self.send_error_json(HTTPStatus.FORBIDDEN,"Only teachers can create assignments.");return
        body=self.read_json();title=str(body.get("title","")).strip();instructions=str(body.get("instructions","")).strip();subject=str(body.get("subject","")).strip();due=str(body.get("due_date","")).strip()
        try: maximum=float(body.get("maximum",100))
        except (TypeError,ValueError): raise ValueError("Maximum score must be a number.")
        if not 2<=len(title)<=100: raise ValueError("Assignment title must be between 2 and 100 characters.")
        if len(instructions)>3000 or len(subject)>60: raise ValueError("Assignment details are too long.")
        try: date.fromisoformat(due)
        except ValueError: raise ValueError("Choose a valid due date.")
        if not math.isfinite(maximum) or not 0<maximum<=10000: raise ValueError("Maximum score must be between 1 and 10,000.")
        with connect_db() as db:
            if not db.execute("SELECT 1 FROM classrooms WHERE id=? AND teacher_id=?",(class_id,user["id"])).fetchone():
                self.send_error_json(HTTPStatus.FORBIDDEN,"You can only assign work in your own class.");return
            assignment_id=secrets.token_urlsafe(12)
            db.execute("INSERT INTO assignments(id,class_id,title,instructions,subject,due_date,maximum,created_at) VALUES(?,?,?,?,?,?,?,?)",(assignment_id,class_id,title,instructions,subject,due,maximum,utc_now()))
            log_activity(db, user["id"], f"Posted assignment: {title}")
        self.send_json({"ok":True,"id":assignment_id},HTTPStatus.CREATED)

    def submit_assignment(self,user:dict,class_id:str)->None:
        if user["role"]!="student":
            self.send_error_json(HTTPStatus.FORBIDDEN,"Only students can submit class work.");return
        body=self.read_json();assignment_id=str(body.get("assignment_id",""));notes=str(body.get("notes","")).strip()
        if len(notes)>2000: raise ValueError("Submission notes are too long.")
        files=body.get("files",[])
        if not isinstance(files,list) or len(files)>MAX_SUBMISSION_FILES:
            raise ValueError(f"Attach no more than {MAX_SUBMISSION_FILES} files or folder items.")
        prepared=[];total_size=0;names=set()
        for item in files:
            if not isinstance(item,dict): raise ValueError("A submitted file could not be read.")
            raw_name=str(item.get("name","")).replace("\\","/")
            parts=[re.sub(r"[\x00-\x1f\x7f]","",part) for part in raw_name.split("/") if part not in ("",".","..")]
            filename="/".join(parts)[-220:]
            if not filename: raise ValueError("Each file needs a valid name.")
            if filename in names: raise ValueError("A folder contains duplicate file paths.")
            names.add(filename)
            encoded=item.get("data")
            if not isinstance(encoded,str): raise ValueError("A submitted file could not be read.")
            try: raw=b64decode(encoded,validate=True)
            except (binascii.Error,ValueError): raise ValueError("A submitted file is not valid base64 data.")
            if len(raw)>MAX_SUBMISSION_FILE: raise ValueError(f"Each file must be smaller than {MAX_SUBMISSION_FILE//(1024*1024)} MB.")
            total_size+=len(raw)
            if total_size>MAX_SUBMISSION_TOTAL: raise ValueError(f"Files must total no more than {MAX_SUBMISSION_TOTAL//(1024*1024)} MB.")
            prepared.append((filename,raw))
        if not notes and not prepared: raise ValueError("Add a comment or attach at least one file before submitting.")
        with connect_db() as db:
            if not db.execute("SELECT 1 FROM class_memberships WHERE class_id=? AND user_id=?",(class_id,user["id"])).fetchone():
                self.send_error_json(HTTPStatus.FORBIDDEN,"Join this class before submitting work.");return
            assignment=db.execute("SELECT maximum,title FROM assignments WHERE id=? AND class_id=?",(assignment_id,class_id)).fetchone()
            if not assignment:
                self.send_error_json(HTTPStatus.NOT_FOUND,"Assignment not found.");return
            existing=db.execute("SELECT id FROM submissions WHERE assignment_id=? AND student_id=?",(assignment_id,user["id"])).fetchone()
            submission_id=existing["id"] if existing else secrets.token_urlsafe(12)
            if existing:
                db.execute("UPDATE submissions SET score=NULL,notes=?,feedback='',submitted_at=? WHERE id=?",(notes,utc_now(),submission_id))
                db.execute("DELETE FROM submission_files WHERE submission_id=?",(submission_id,))
            else:
                db.execute("INSERT INTO submissions(id,assignment_id,student_id,score,notes,feedback,submitted_at) VALUES(?,?,?,?,?,?,?)",
                           (submission_id,assignment_id,user["id"],None,notes,"",utc_now()))
            for filename,raw in prepared:
                db.execute("INSERT INTO submission_files(id,submission_id,name,size,data) VALUES(?,?,?,?,?)",
                           (secrets.token_urlsafe(12),submission_id,filename,len(raw),sqlite3.Binary(raw)))
            log_activity(db, user["id"], f"Submitted work for: {assignment['title']}")
        self.send_json({"ok":True,"submission_id":submission_id})

    def grade_submission(self,user:dict,class_id:str,submission_id:str)->None:
        if user["role"]!="teacher":
            self.send_error_json(HTTPStatus.FORBIDDEN,"Only teachers can grade student work.");return
        body=self.read_json();score_value=body.get("score");feedback=str(body.get("feedback","")).strip()
        if len(feedback)>2000: raise ValueError("Teacher feedback is too long.")
        score=None
        if score_value not in (None,""):
            try: score=float(score_value)
            except (TypeError,ValueError): raise ValueError("Enter a valid score.")
            if not math.isfinite(score): raise ValueError("Enter a valid score.")
        if score is None and not feedback: raise ValueError("Add a grade or feedback before saving.")
        with connect_db() as db:
            row=db.execute("""SELECT a.maximum,a.title,s.student_id FROM submissions s JOIN assignments a ON a.id=s.assignment_id
                              JOIN classrooms c ON c.id=a.class_id
                              WHERE s.id=? AND a.class_id=? AND c.teacher_id=?""",
                           (submission_id,class_id,user["id"])).fetchone()
            if not row:
                self.send_error_json(HTTPStatus.NOT_FOUND,"Student submission not found in your class.");return
            if score is not None and (score<0 or score>float(row["maximum"])):
                raise ValueError(f"Score must be between 0 and {row['maximum']}.")
            db.execute("UPDATE submissions SET score=COALESCE(?,score),feedback=? WHERE id=?",(score,feedback,submission_id))
            log_activity(db, user["id"], f"Reviewed work for: {row['title']}", row["student_id"])
        self.send_json({"ok":True})

    def _quiz_context(self, db: sqlite3.Connection, user: dict, quiz_id: str):
        quiz = db.execute("""SELECT q.*,c.teacher_id FROM quizzes q
                             JOIN classrooms c ON c.id=q.class_id WHERE q.id=?""", (quiz_id,)).fetchone()
        if not quiz:
            return None, False, False
        teacher = user["role"] == "teacher" and quiz["teacher_id"] == user["id"]
        member = bool(db.execute("SELECT 1 FROM class_memberships WHERE class_id=? AND user_id=?",
                                 (quiz["class_id"], user["id"])).fetchone())
        return quiz, teacher, member

    @staticmethod
    def _quiz_questions(row) -> list:
        try:
            questions = json.loads(row["questions_json"])
        except (TypeError, json.JSONDecodeError):
            questions = []
        return questions if isinstance(questions, list) else []

    @staticmethod
    def _public_quiz_questions(questions: list, teacher: bool) -> list:
        if teacher:
            return questions
        return [{"prompt": question["prompt"], "options": question["options"]}
                for question in questions if isinstance(question, dict)
                and isinstance(question.get("options"), list)]

    @staticmethod
    def _quiz_review(questions: list, answers: list) -> list:
        review = []
        for index, question in enumerate(questions):
            if not isinstance(question, dict) or not isinstance(question.get("options"), list):
                continue
            correct_index = question.get("correctIndex")
            selected_index = answers[index] if index < len(answers) else None
            if isinstance(correct_index, bool) or not isinstance(correct_index, int):
                continue
            review.append({
                "prompt": str(question.get("prompt", "")),
                "options": question["options"],
                "selected_index": selected_index,
                "correct_index": correct_index,
                "correct": selected_index == correct_index,
            })
        return review

    def get_class_quizzes(self, user: dict, class_id: str) -> None:
        with connect_db() as db:
            classroom = db.execute("SELECT teacher_id FROM classrooms WHERE id=?", (class_id,)).fetchone()
            if not classroom:
                self.send_error_json(HTTPStatus.NOT_FOUND, "Class not found."); return
            teacher = user["role"] == "teacher" and classroom["teacher_id"] == user["id"]
            member = bool(db.execute("SELECT 1 FROM class_memberships WHERE class_id=? AND user_id=?",
                                     (class_id, user["id"])).fetchone())
            if not teacher and not member:
                self.send_error_json(HTTPStatus.FORBIDDEN, "Join this class to view its quizzes."); return
            rows = db.execute("SELECT * FROM quizzes WHERE class_id=? ORDER BY created_at DESC", (class_id,)).fetchall()
            quizzes = []
            for row in rows:
                questions = self._quiz_questions(row)
                item = {"id": row["id"], "title": row["title"], "instructions": row["instructions"],
                        "due_date": row["due_date"],
                        "created_at": row["created_at"], "question_count": len(questions),
                        "questions": self._public_quiz_questions(questions, teacher)}
                if teacher:
                    item["attempt_count"] = db.execute("SELECT COUNT(*) AS n FROM quiz_attempts WHERE quiz_id=?",
                                                       (row["id"],)).fetchone()["n"]
                else:
                    attempt = db.execute("""SELECT correct_count,question_count,submitted_at
                                             FROM quiz_attempts WHERE quiz_id=? AND student_id=?""",
                                         (row["id"], user["id"])).fetchone()
                    item["attempt"] = dict(attempt) if attempt else None
                quizzes.append(item)
        self.send_json({"quizzes": quizzes})

    def get_quiz(self, user: dict, quiz_id: str) -> None:
        with connect_db() as db:
            quiz, teacher, member = self._quiz_context(db, user, quiz_id)
            if not quiz:
                self.send_error_json(HTTPStatus.NOT_FOUND, "Quiz not found."); return
            if not teacher and not member:
                self.send_error_json(HTTPStatus.FORBIDDEN, "Join this class to open its quizzes."); return
            questions = self._quiz_questions(quiz)
            result = {"id": quiz["id"], "class_id": quiz["class_id"], "title": quiz["title"],
                      "due_date": quiz["due_date"],
                      "instructions": quiz["instructions"], "question_count": len(questions),
                      "questions": self._public_quiz_questions(questions, teacher)}
            if not teacher:
                attempt = db.execute("""SELECT correct_count,question_count,submitted_at,answers_json FROM quiz_attempts
                                         WHERE quiz_id=? AND student_id=?""", (quiz_id, user["id"])).fetchone()
                if attempt:
                    attempt_data = dict(attempt)
                    try:
                        submitted_answers = json.loads(attempt_data.pop("answers_json", "[]"))
                    except (TypeError, json.JSONDecodeError):
                        submitted_answers = []
                    if not isinstance(submitted_answers, list):
                        submitted_answers = []
                    attempt_data["review"] = self._quiz_review(questions, submitted_answers) \
                        if len(submitted_answers) == len(questions) else []
                    result["attempt"] = attempt_data
                else:
                    result["attempt"] = None
        self.send_json({"quiz": result})

    def get_quiz_attempts(self, user: dict, quiz_id: str) -> None:
        with connect_db() as db:
            quiz, teacher, _ = self._quiz_context(db, user, quiz_id)
            if not quiz:
                self.send_error_json(HTTPStatus.NOT_FOUND, "Quiz not found."); return
            if not teacher:
                self.send_error_json(HTTPStatus.FORBIDDEN, "Only this class's teacher can view quiz results."); return
            rows = db.execute("""SELECT a.correct_count,a.question_count,a.submitted_at,u.name AS student_name
                                FROM quiz_attempts a JOIN users u ON u.id=a.student_id
                                WHERE a.quiz_id=? ORDER BY u.name""", (quiz_id,)).fetchall()
        attempts = [{**dict(row), "percentage": round(100 * row["correct_count"] / row["question_count"], 1)
                     if row["question_count"] else 0} for row in rows]
        self.send_json({"attempts": attempts})

    def create_quiz(self, user: dict, class_id: str) -> None:
        if user["role"] != "teacher":
            self.send_error_json(HTTPStatus.FORBIDDEN, "Only teachers can create class quizzes."); return
        body = self.read_json()
        title = str(body.get("title", "")).strip()
        instructions = str(body.get("instructions", "")).strip()
        due_date = str(body.get("due_date", "")).strip()
        raw_questions = body.get("questions")
        if not 2 <= len(title) <= 100:
            raise ValueError("Quiz title must be between 2 and 100 characters.")
        if len(instructions) > 2000:
            raise ValueError("Quiz instructions are too long.")
        try:
            date.fromisoformat(due_date)
        except (TypeError, ValueError):
            raise ValueError("Choose a valid quiz due date.")
        if not isinstance(raw_questions, list) or not 1 <= len(raw_questions) <= MAX_QUIZ_QUESTIONS:
            raise ValueError(f"Add between 1 and {MAX_QUIZ_QUESTIONS} questions.")
        questions = []
        for index, raw in enumerate(raw_questions, 1):
            if not isinstance(raw, dict):
                raise ValueError(f"Question {index} is not valid.")
            prompt = str(raw.get("prompt", "")).strip()
            options_raw = raw.get("options")
            if not 2 <= len(prompt) <= 500:
                raise ValueError(f"Question {index} must have a prompt between 2 and 500 characters.")
            if not isinstance(options_raw, list) or not 2 <= len(options_raw) <= 6:
                raise ValueError(f"Question {index} needs between 2 and 6 answer choices.")
            options = [str(option).strip() for option in options_raw]
            if any(not option or len(option) > 160 for option in options):
                raise ValueError(f"Question {index} has an empty or overly long answer choice.")
            correct = raw.get("correctIndex")
            if isinstance(correct, bool) or not isinstance(correct, int) or not 0 <= correct < len(options):
                raise ValueError(f"Choose the correct answer for question {index}.")
            questions.append({"prompt": prompt, "options": options, "correctIndex": correct})
        quiz_id = secrets.token_urlsafe(12)
        with connect_db() as db:
            if not db.execute("SELECT 1 FROM classrooms WHERE id=? AND teacher_id=?", (class_id, user["id"])).fetchone():
                self.send_error_json(HTTPStatus.FORBIDDEN, "You can only create quizzes in your own class."); return
            db.execute("INSERT INTO quizzes(id,class_id,title,instructions,due_date,questions_json,created_at) VALUES(?,?,?,?,?,?,?)",
                       (quiz_id, class_id, title, instructions, due_date,
                        json.dumps(questions, ensure_ascii=False, separators=(",", ":")), utc_now()))
            log_activity(db, user["id"], f"Published quiz: {title}")
        self.send_json({"ok": True, "quiz_id": quiz_id}, HTTPStatus.CREATED)

    def submit_quiz(self, user: dict, quiz_id: str) -> None:
        if user["role"] != "student":
            self.send_error_json(HTTPStatus.FORBIDDEN, "Only students can submit quiz answers."); return
        body = self.read_json()
        answers = body.get("answers")
        with connect_db() as db:
            quiz, _, member = self._quiz_context(db, user, quiz_id)
            if not quiz:
                self.send_error_json(HTTPStatus.NOT_FOUND, "Quiz not found."); return
            if not member:
                self.send_error_json(HTTPStatus.FORBIDDEN, "Join this class before taking its quiz."); return
            questions = self._quiz_questions(quiz)
            if not isinstance(answers, list) or len(answers) != len(questions):
                raise ValueError("Answer every question before submitting.")
            correct_count = 0
            review = []
            for index, (answer, question) in enumerate(zip(answers, questions), 1):
                if isinstance(answer, bool) or not isinstance(answer, int) or not 0 <= answer < len(question["options"]):
                    raise ValueError(f"Choose an answer for question {index}.")
                correct = answer == question["correctIndex"]
                if correct:
                    correct_count += 1
                review.append({"prompt": question["prompt"], "options": question["options"],
                               "selected_index": answer, "correct_index": question["correctIndex"],
                               "correct": correct})
            existing = db.execute("SELECT 1 FROM quiz_attempts WHERE quiz_id=? AND student_id=?",
                                  (quiz_id, user["id"])).fetchone()
            if existing:
                self.send_error_json(HTTPStatus.CONFLICT, "You have already submitted this quiz."); return
            try:
                db.execute("""INSERT INTO quiz_attempts(id,quiz_id,student_id,correct_count,question_count,submitted_at,answers_json)
                              VALUES(?,?,?,?,?,?,?)""",
                           (secrets.token_urlsafe(12), quiz_id, user["id"], correct_count, len(questions), utc_now(),
                            json.dumps(answers, separators=(",", ":"))))
                log_activity(db, user["id"], f"Submitted quiz: {quiz['title']}")
            except sqlite3.IntegrityError:
                self.send_error_json(HTTPStatus.CONFLICT, "You have already submitted this quiz."); return
        self.send_json({"ok": True, "correct_count": correct_count, "question_count": len(questions),
                        "percentage": round(100 * correct_count / len(questions), 1) if questions else 0,
                        "review": review},
                       HTTPStatus.CREATED)

    def lookup_person(self, user: dict, email: str) -> None:
        email = str(email).strip().lower()
        if len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            raise ValueError("Enter the person's full email address.")
        with connect_db() as db:
            row = db.execute("SELECT id,name,role,is_admin FROM users WHERE email=? AND is_disabled=0", (email,)).fetchone()
        if not row or row["id"] == user["id"]:
            self.send_json({"person": None}); return
        self.send_json({"person": {"id": row["id"], "name": row["name"],
                                    "role": "admin" if row["is_admin"] else row["role"]}})

    def get_direct_messages(self, user: dict, peer_id: str) -> None:
        with connect_db() as db:
            if peer_id:
                peer = db.execute("SELECT id,name,role,is_admin FROM users WHERE id=? AND is_disabled=0", (peer_id,)).fetchone()
                if not peer or peer["id"] == user["id"]:
                    self.send_error_json(HTTPStatus.NOT_FOUND, "That account could not be found."); return
                rows = db.execute("""SELECT m.id,m.sender_id,m.recipient_id,m.body,m.created_at,
                                    s.name AS sender_name,s.role AS sender_role,s.is_admin AS sender_admin
                                    FROM direct_messages m JOIN users s ON s.id=m.sender_id
                                    WHERE (m.sender_id=? AND m.recipient_id=?) OR (m.sender_id=? AND m.recipient_id=?)
                                    ORDER BY m.id DESC LIMIT 100""",
                                  (user["id"], peer_id, peer_id, user["id"])).fetchall()
                peer_payload = {"id": peer["id"], "name": peer["name"],
                                "role": "admin" if peer["is_admin"] else peer["role"]}
                messages = [{**dict(row), "sender_role": "admin" if row["sender_admin"] else row["sender_role"]}
                            for row in reversed(rows)]
                self.send_json({"peer": peer_payload, "messages": messages}); return
            rows = db.execute("""SELECT m.id,m.sender_id,m.recipient_id,m.body,m.created_at,
                                s.name AS sender_name,s.role AS sender_role,s.is_admin AS sender_admin,
                                r.name AS recipient_name,r.role AS recipient_role,r.is_admin AS recipient_admin
                                FROM direct_messages m JOIN users s ON s.id=m.sender_id
                                JOIN users r ON r.id=m.recipient_id
                                WHERE m.sender_id=? OR m.recipient_id=?
                                ORDER BY m.id DESC LIMIT 500""", (user["id"], user["id"])).fetchall()
        threads = []
        seen = set()
        for row in rows:
            peer_is_sender = row["sender_id"] != user["id"]
            peer_id_value = row["sender_id"] if peer_is_sender else row["recipient_id"]
            if peer_id_value in seen:
                continue
            seen.add(peer_id_value)
            peer_name = row["sender_name"] if peer_is_sender else row["recipient_name"]
            peer_role = row["sender_role"] if peer_is_sender else row["recipient_role"]
            peer_admin = row["sender_admin"] if peer_is_sender else row["recipient_admin"]
            threads.append({"peer_id": peer_id_value, "peer_name": peer_name,
                            "peer_role": "admin" if peer_admin else peer_role,
                            "last_message": row["body"], "created_at": row["created_at"]})
        self.send_json({"threads": threads})

    def create_direct_message(self, user: dict) -> None:
        body = self.read_json()
        recipient_email = str(body.get("recipient_email", "")).strip().lower()
        recipient_id = str(body.get("recipient_id", "")).strip()
        message = str(body.get("body", "")).strip()
        if not message or len(message) > 2000:
            raise ValueError("Messages must contain 1 to 2,000 characters.")
        if not recipient_id and (len(recipient_email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", recipient_email)):
            raise ValueError("Enter the recipient's full email address.")
        with connect_db() as db:
            recipient = db.execute("SELECT id FROM users WHERE " + ("id=?" if recipient_id else "email=?") + " AND is_disabled=0",
                                   (recipient_id or recipient_email,)).fetchone()
            if not recipient or recipient["id"] == user["id"]:
                self.send_error_json(HTTPStatus.NOT_FOUND, "We couldn't find another active account with that email."); return
            cursor = db.execute("INSERT INTO direct_messages(sender_id,recipient_id,body,created_at) VALUES(?,?,?,?)",
                                (user["id"], recipient["id"], message, utc_now()))
            message_id = cursor.lastrowid
            log_activity(db, user["id"], "Sent a private email chat message", recipient["id"])
        self.send_json({"ok": True, "id": message_id}, HTTPStatus.CREATED)

    def _class_chat_peer(self,db,user:dict,class_id:str,recipient_id:str):
        classroom=db.execute("SELECT teacher_id FROM classrooms WHERE id=?",(class_id,)).fetchone()
        if not classroom: return None,"Class not found."
        teacher=user["role"]=="teacher" and classroom["teacher_id"]==user["id"]
        member=db.execute("SELECT 1 FROM class_memberships WHERE class_id=? AND user_id=?",(class_id,user["id"])).fetchone()
        if not teacher and not member: return None,"Join this class before opening messages."
        peer=db.execute("SELECT id,name,role FROM users WHERE id=?",(recipient_id,)).fetchone()
        if not peer or peer["id"]==user["id"]: return None,"Choose another member of this class."
        is_teacher=peer["id"]==classroom["teacher_id"] and peer["role"]=="teacher"
        is_member=db.execute("SELECT 1 FROM class_memberships WHERE class_id=? AND user_id=?",(class_id,peer["id"])).fetchone()
        if not is_teacher and not is_member: return None,"You can only message people in this class."
        if teacher and is_teacher: return None,"Choose one of your students."
        return peer,None

    def get_class_messages(self,user:dict,class_id:str,recipient_id:str)->None:
        if not recipient_id:
            self.send_error_json(HTTPStatus.BAD_REQUEST,"Choose a class member to open a conversation.");return
        with connect_db() as db:
            peer,error=self._class_chat_peer(db,user,class_id,recipient_id)
            if error:
                status=HTTPStatus.FORBIDDEN if error.startswith(("Join","You can only","Choose one")) else HTTPStatus.NOT_FOUND
                self.send_error_json(status,error);return
            rows=db.execute("""SELECT m.id,m.sender_id,m.recipient_id,m.body,m.created_at,u.name AS sender_name,u.role AS sender_role
                              FROM class_messages m JOIN users u ON u.id=m.sender_id
                              WHERE m.class_id=? AND ((m.sender_id=? AND m.recipient_id=?) OR (m.sender_id=? AND m.recipient_id=?))
                              ORDER BY m.id DESC LIMIT 100""",
                            (class_id,user["id"],recipient_id,recipient_id,user["id"])).fetchall()
        self.send_json({"peer":dict(peer),"messages":[dict(row) for row in reversed(rows)]})

    def create_class_message(self,user:dict,class_id:str)->None:
        body=self.read_json();recipient_id=str(body.get("recipient_id",""));message=str(body.get("body","")).strip()
        if not message or len(message)>2000: raise ValueError("Messages must contain 1 to 2,000 characters.")
        with connect_db() as db:
            peer,error=self._class_chat_peer(db,user,class_id,recipient_id)
            if error:
                status=HTTPStatus.FORBIDDEN if error.startswith(("Join","You can only","Choose one")) else HTTPStatus.NOT_FOUND
                self.send_error_json(status,error);return
            cursor=db.execute("INSERT INTO class_messages(class_id,sender_id,recipient_id,body,created_at) VALUES(?,?,?,?,?)",
                              (class_id,user["id"],recipient_id,message,utc_now()))
            message_id=cursor.lastrowid
            created_at=db.execute("SELECT created_at FROM class_messages WHERE id=?",(message_id,)).fetchone()["created_at"]
            log_activity(db, user["id"], "Sent a private class chat message", recipient_id)
        self.send_json({"ok":True,"id":message_id,"created_at":created_at},HTTPStatus.CREATED)

    def download_submission_file(self,user:dict,submission_id:str,file_id:str)->None:
        with connect_db() as db:
            row=db.execute("""SELECT f.name,f.data,s.student_id,c.teacher_id
                              FROM submission_files f JOIN submissions s ON s.id=f.submission_id
                              JOIN assignments a ON a.id=s.assignment_id JOIN classrooms c ON c.id=a.class_id
                              WHERE f.id=? AND s.id=?""",(file_id,submission_id)).fetchone()
            if not row:
                self.send_error_json(HTTPStatus.NOT_FOUND,"Submitted file not found.");return
            teacher_access=user["role"]=="teacher" and row["teacher_id"]==user["id"]
            student_access=user["role"]=="student" and row["student_id"]==user["id"]
            if not teacher_access and not student_access:
                self.send_error_json(HTTPStatus.FORBIDDEN,"You do not have access to this submitted file.");return
            data=bytes(row["data"]);name=row["name"]
        mime=mimetypes.guess_type(name)[0] or "application/octet-stream"
        fallback=re.sub(r"[^A-Za-z0-9._-]","_",name.split("/")[-1]) or "submission-file"
        disposition=f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(name,safe='')}"
        self.send_response(HTTPStatus.OK);self.send_header("Content-Type",mime);self.send_header("Content-Length",str(len(data)))
        self.send_header("Content-Disposition",disposition);self.send_header("Cache-Control","private, no-store")
        self.end_headers();self.wfile.write(data)

    def serve_static(self, path: str) -> None:
        relative = "index.html" if path in ("", "/") else path.lstrip("/")
        parts = Path(relative).parts
        if (not relative or "\x00" in relative or any(part in {".", ".."} or part.startswith(".") for part in parts)):
            self.send_error(HTTPStatus.NOT_FOUND);return
        if relative in PUBLIC_STATIC_FILES and len(parts) == 1:
            target = (ROOT / relative).resolve()
        elif parts and parts[0] in PUBLIC_STATIC_DIRS:
            public_root = (ROOT / parts[0]).resolve()
            target = (public_root.joinpath(*parts[1:])).resolve()
            if public_root not in target.parents:
                self.send_error(HTTPStatus.NOT_FOUND);return
        else:
            # Never expose the SQLite database, source/config files, dotfiles, or Git metadata.
            self.send_error(HTTPStatus.NOT_FOUND);return
        if not target.is_file():
            self.send_error(HTTPStatus.NOT_FOUND);return
        data=target.read_bytes();mime=mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type",mime+("; charset=utf-8" if mime.startswith(("text/","application/javascript")) else ""))
        self.send_header("Content-Length",str(len(data)))
        if relative in {"index.html", "manifest.json", "sw.js"}:
            self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Security-Policy","default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; manifest-src 'self'; worker-src 'self'; form-action 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
        self.end_headers();self.wfile.write(data)


class BoundedThreadingHTTPServer(ThreadingHTTPServer):
    """Limit concurrent requests so bursts cannot spawn unbounded worker threads."""
    daemon_threads = True
    request_queue_size = 64
    max_workers = 8

    def __init__(self, *args, **kwargs):
        self._worker_slots = threading.BoundedSemaphore(self.max_workers)
        super().__init__(*args, **kwargs)

    def process_request(self, request, client_address):
        if not self._worker_slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self._worker_slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._worker_slots.release()


def main() -> None:
    init_db()
    # Render always supplies PORT; bind publicly there unless the host is set explicitly.
    # Keep local development private when no deployment port is present.
    host=os.environ.get("STUDYTRACK_HOST") or ("0.0.0.0" if os.environ.get("PORT") else "127.0.0.1")
    port=int(os.environ.get("PORT",os.environ.get("STUDYTRACK_PORT","8000")))
    print(f"StudyTrack running at http://{host}:{port}")
    print("Keep this terminal open while using the app. Set STUDYTRACK_TEACHER_CODE to allow teacher registration.")
    BoundedThreadingHTTPServer((host,port),StudyTrackHandler).serve_forever()


if __name__ == "__main__":
    main()
