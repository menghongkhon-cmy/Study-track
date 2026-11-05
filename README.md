# StudyTrack

StudyTrack is a responsive personal study and score manager for students, with a classroom area for teachers. The interface is built with HTML, CSS, and vanilla JavaScript. Shared sign-in and classroom features use a small Python server with SQLite. Optional social sign-in contacts only the identity providers that the app owner configures; the app does not use analytics or external learning services.

## Run StudyTrack

Install the small server dependency, then start StudyTrack from this folder. Python 3.10 or newer is recommended.

```bash
python3 -m pip install -r requirements.txt
python3 server.py
```

On Windows, run `py -m pip install -r requirements.txt` and then `py server.py` from PowerShell. Then open <http://127.0.0.1:8000>. Keep the server running while using the app. The default server listens only on this computer.

If sign-up shows `405`, the page is being served without the account API. Start `py server.py` in the project folder and use the `127.0.0.1:8000` address above; do not open `index.html` directly or use a static preview link.

For Render, deploy this repository as a **Python Web Service**, keep the build command `pip install -r requirements.txt`, and use `python server.py` as the start command. The Render health check uses `/api/health`; opening that path on the service domain should return `{"ok":true,"service":"StudyTrack API"}`. If it does not, the browser app and account API are not running together on that service yet.

The interface uses a consistent Angkor Wat background and locally bundled SVG icons. Both are included in the offline app shell.

The server creates `studytrack.sqlite3` in this folder for accounts, study data, classes, assignments, submissions, uploaded files, and classroom messages. Keep that file on persistent storage and back it up securely.

## Student and teacher accounts

- Students can create an account, join a class with the teacher's six-character code, view assignments, and submit a comment with files or a whole folder.
- Teachers can create classes, share join codes, post assignments, review student work, add feedback, and enter or update scores.
- Teachers can publish multiple-choice quizzes with due dates and up to 100 questions each. Students can take each quiz once, see their score, and review which answers were correct; teachers can review class results.
- The full-width study planner combines personal tasks and class deadlines in month, week, and agenda calendar views. Select a day to see its plan, then add tasks or open a class item directly.
- Sign-in includes a one-time email password-reset flow when SMTP is configured on the server. Successful sign-in shows a brief full-screen welcome animation with an opening book; users can skip it.
- Students can privately message their class teacher or classmates. Teachers can privately message students in their own classes; each conversation is visible only to its two participants.
- The Messages area can find a registered StudyTrack account by its exact email address and start a private chat. It does not send email to people outside StudyTrack, and the address is not shown in the chat.
- Each account has a separate study workspace. Teachers only see class membership and submissions for classes they own; students only see their own work and classes they joined.
- Each assignment submission accepts up to 20 files, 8 MB each and 12 MB total. Folder uploads keep their relative file paths.
- Teacher sign-up is restricted by an access code configured by the person running the server. Set it before starting the app:

  **PowerShell:**
  ```powershell
  $env:STUDYTRACK_TEACHER_CODE = "your-private-code"
  py server.py
  ```

  **macOS/Linux:**
  ```bash
  STUDYTRACK_TEACHER_CODE="your-private-code" python3 server.py
  ```

- The app owner can create a protected admin account using a separate private code. Set `STUDYTRACK_ADMIN_CODE` on the server before registration. Choose **Admin** on the sign-in screen and register with that code. Keep it secret; people with the code can create an admin account.
- For local use, start the server with both codes set, for example: `STUDYTRACK_TEACHER_CODE="teacher-secret" STUDYTRACK_ADMIN_CODE="owner-secret" python3 server.py` (PowerShell uses `$env:STUDYTRACK_ADMIN_CODE = "owner-secret"` before `py server.py`).
- The Admin console lists student and teacher accounts, lets the owner pause or restore accounts, and shows recent class and account actions. Role changes are locked while an account is part of a class. The activity log does not include message text, scores, or notes.

Students do not need that code. If SMTP email is configured on the server, users can recover a forgotten password with a one-time link that expires after 30 minutes. The link can only be used once; resetting the password signs the account out on all devices. See the AWS deployment guide for the SMTP settings.

## Social sign-in

Google and GitHub can create a student account on first use or sign in to a matching account using the provider's verified email. Existing teacher or admin roles remain unchanged when the verified email matches. New provider sign-ups receive the Student role; social sign-in never grants teacher or admin access by itself. Telegram does not provide an email address, so first sign in with an existing StudyTrack method, then connect Telegram from **Settings & privacy → Connected sign-in methods**. After linking, Telegram can be used on the login screen.

The Google and GitHub buttons only work after you create OAuth credentials for StudyTrack and add them to the hosted server. For the current Render address shown for this project, use these callback URLs (if your service URL changed, replace the domain with its current primary URL):

```text
https://study-track-7.onrender.com/auth/google/callback
https://study-track-7.onrender.com/auth/github/callback
```

1. In [Google Cloud Console](https://console.cloud.google.com/), create an OAuth client with application type **Web application**. Add the Google callback URL above under **Authorized redirect URIs** and copy its client ID and client secret.
2. In GitHub, open **Settings → Developer settings → OAuth Apps → New OAuth App**. Set the homepage to `https://study-track-7.onrender.com`, add the GitHub callback URL above as the **Authorization callback URL**, then copy the client ID and generate a client secret.
3. In Render, open the StudyTrack service's **Environment** page and add the variables below. Set `STUDYTRACK_PUBLIC_URL` to the exact public site origin, without a trailing slash. Keep the client secrets private.
4. Save the variables and redeploy/restart the service, then try the buttons again. GitHub users need a verified primary email address on their GitHub account.

```text
STUDYTRACK_PUBLIC_URL=https://study-track-7.onrender.com
STUDYTRACK_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
STUDYTRACK_GOOGLE_CLIENT_SECRET=...
STUDYTRACK_GITHUB_CLIENT_ID=...
STUDYTRACK_GITHUB_CLIENT_SECRET=...
```

For local testing, register `http://127.0.0.1:8000/auth/google/callback` and `http://127.0.0.1:8000/auth/github/callback`, then set the corresponding variables in the same terminal before starting `python3 server.py`.

Telegram is optional. For it, add `https://study-track-7.onrender.com` and `https://study-track-7.onrender.com/auth/telegram/callback` to the bot's allowed URLs in @BotFather, then add these values to the Render service's **Environment** page:

```text
STUDYTRACK_TELEGRAM_CLIENT_ID=...
STUDYTRACK_TELEGRAM_CLIENT_SECRET=...
```

Set only the providers you plan to offer. Keep all client secrets on the server, never in JavaScript or GitHub. Google and Telegram ID tokens are signature-checked; each provider flow uses state and PKCE. GitHub access is limited to basic profile and verified email (`read:user user:email`). StudyTrack does not store provider access tokens. Install the server dependencies with `pip install -r requirements.txt` before starting the app.

## Install StudyTrack on desktop or phone

StudyTrack can be installed as a web app after it is deployed at an HTTPS address with a valid certificate. Sign in, then use the download icon in the top navigation. Chrome and Edge show the native install prompt when the browser supports it; otherwise, use the browser's **Install app** menu. On Android, use Chrome's **Install app** or **Add to Home screen** menu. On iPhone or iPad, open the site in Safari, tap **Share**, then **Add to Home Screen**. Keep the internet connection on for sign-in and classroom features.

## Use across devices

The included server is configured for local use. To allow sign-in from other devices, deploy the app and server on a host that those devices can reach, use HTTPS, set `STUDYTRACK_SECURE_COOKIE=1`, and keep the SQLite database on persistent storage. Configure `STUDYTRACK_HOST=0.0.0.0` only when the deployment environment requires it. Do not expose the development server directly to the public internet.

## Deploy for users with Render

The included `render.yaml` configures a Python web service in Singapore, HTTPS cookies, a persistent disk for the SQLite account database and submitted files, and a private teacher registration code. The service uses Render's paid Starter compute plan because its free web service does not support persistent disks; on a free instance, account data and uploaded work can disappear after a restart or deploy.

1. Put the project files in a GitHub repository. Keep `studytrack.sqlite3` and the `upload/` folders out of the repository; `.gitignore` excludes them.
2. In Render, choose **New → Blueprint**, connect the repository, and review the service and disk plan before creating it.
3. When Render asks for `STUDYTRACK_TEACHER_CODE` and `STUDYTRACK_ADMIN_CODE`, set separate strong private codes. Share the teacher code only with trusted teachers and keep the admin code for the app owner. Students can create accounts without either code.
4. After the deploy completes, open the public `onrender.com` address shown in the Render dashboard and create an account.

## Prepare an AWS EC2 deployment

The project includes an Ubuntu EC2 deployment guide and starter files under [`deploy/aws/`](deploy/aws/README.md): a systemd service, an Nginx reverse-proxy configuration, and an environment-variable example. The guide keeps the app bound to localhost, enables secure cookies, and stores SQLite data under `/var/lib/studytrack` so that directory can be mounted on persistent EBS storage. Follow the guide and verify the database volume's delete-on-termination setting before creating real accounts.

This is a single-instance setup for testing and small deployments. It does not add failover or a managed database. The current app server is Python's built-in HTTP server behind Nginx; arrange a security review before using it for sensitive student records at scale.

The app stores account data and submissions in the server's SQLite database so users can sign in and share classroom work. The person who owns the hosting account can access the server and its database. Use the account's JSON export for backups; keep a separate copy somewhere safe.

## Features

- Dashboard, subjects, score tracker, planner calendar, Pomodoro timer, goals, notes, analytics, and achievements.
- Personal notes use a document-style editor with headings, emphasis, lists, and quote formatting. Saved documents are sanitized before display.
- Interactive charts and statistics calculated from each signed-in user's records.
- Dark theme by default, with an optional light theme, subtle transitions, reduced-motion support, responsive navigation, and empty states.
- Switch the interface between English and Khmer from the sign-in screen or top bar; your choice is saved in this browser.
- Admins can set a shared Angkor Wat or animated aurora background, or upload a GIF/image that is saved in the app database.
- Profile initials or an uploaded profile picture. Pictures are resized in the browser and stored with the account's app data.
- Optional profile cover photos and short bios. Profiles can be shared with classmates, with any StudyTrack account, or kept private. When a profile is private or only shared with classmates, other accounts can see only the person's name and role. Emails and academic records are not returned by the profile-view endpoint.
- JSON backup export/import, confirmed account-data deletion, and an optional local PIN for casual privacy.
- Teacher, student, and protected admin roles; private class join codes; file/folder submissions; teacher feedback and grades; multi-question class quizzes; private class-member chat; and email-address lookup for chats between StudyTrack accounts.
- Shared member photos appear in direct and classroom chat avatars when the profile visibility settings allow that viewer to see them.
- Direct private chats support a message plus one file or picture attachment (up to 8 MB) and an emoji picker. Attachments are stored with the chat and can be opened only by the two conversation participants.
- Class join codes include a working one-click copy button. Profile settings use a cover-and-avatar layout and keep the existing sharing controls.

## Privacy and security

StudyTrack sends account and app data only to the server you configure, so shared accounts and cross-device sync require that server. `LocalStorage` keeps a browser copy while the app is in use; it is not encrypted. The server stores account and study records in SQLite. Passwords are stored as salted PBKDF2 hashes, but study records are not encrypted by this app, and anyone with access to the server database can inspect them. Admins can view account details and short activity labels, but the console does not expose private chat text, study notes, or personal scores. Use HTTPS for online deployments. The optional local PIN is a casual browser lock, not encryption.

The server now serves only the public app files from `index.html`, `manifest.json`, `sw.js`, `assets/`, `css/`, and `js/`; it does not serve the database, Git files, environment files, or other project files. Authenticated browser writes require a matching same-origin request and CSRF token; sign-in and registration also require a same-origin request. Hosted sessions use secure, HttpOnly, SameSite cookies and additional browser security headers. Login/code failures are rate-limited, new class invite codes are longer with a separate attempt limit per signed-in student, and OAuth callbacks validate state and PKCE. Keep teacher/admin access codes and provider client secrets private, use unique passwords, and never commit secrets or database backups to GitHub.

These defenses reduce common risks, but cannot guarantee that the app is impossible to hack. The current backend uses Python's built-in `http.server`, which is not intended as a production web server. Use this app for learning/testing only until the backend is moved to a production-grade server and receives a security review.

Export a JSON backup before deleting data. “Delete all study data” removes the signed-in account's profile and study records from the server but keeps the account, classes, assignments, and submissions. Pausing an account from the Admin console ends its sessions and prevents sign-in until it is restored.

## Project structure

```text
studytrack/
├── index.html
├── css/style.css
├── js/                 # Vanilla JavaScript app modules
├── server.py           # Python standard-library account and classroom API
└── README.md
```

## Site icon in search results

StudyTrack includes a square 192 × 192 PNG favicon linked from the home page. When the site is deployed, keep the icon URL stable and make both the home page and icon publicly crawlable. Search engines decide whether and when to display the icon; adding the link makes the site eligible, but does not guarantee a search-result logo.
