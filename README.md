# StudyTrack

StudyTrack is a responsive personal study and score manager for students, with a classroom area for teachers. The interface is built with HTML, CSS, and vanilla JavaScript. Shared sign-in and classroom features use a small Python standard-library server with SQLite; there is no Node.js, PHP, Firebase, Supabase, external API, or analytics code.

## Run StudyTrack

Start the included server from this folder. Python 3.10 or newer is recommended.

```bash
python3 server.py
```

On Windows, run `py server.py` from PowerShell. Then open <http://127.0.0.1:8000>. Keep the server running while using the app. The default server listens only on this computer.

If sign-up shows `405`, the page is being served without the account API. Start `py server.py` in the project folder and use the `127.0.0.1:8000` address above; do not open `index.html` directly or use a static preview link.

The server creates `studytrack.sqlite3` in this folder for accounts, study data, classes, assignments, submissions, uploaded files, and classroom messages. Keep that file on persistent storage and back it up securely.

## Student and teacher accounts

- Students can create an account, join a class with the teacher's six-character code, view assignments, and submit a comment with files or a whole folder.
- Teachers can create classes, share join codes, post assignments, review student work, add feedback, and enter or update scores.
- Teachers can publish multiple-choice quizzes with due dates and up to 100 questions each. Students can take each quiz once, see their score, and review which answers were correct; teachers can review class results.
- The study planner calendar combines personal study tasks with class assignment and quiz due dates, including each student's submitted, graded, or completed status.
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

Students do not need that code. There is currently no email verification or password-reset flow, so accounts should use a password they can keep safe.

## Use across devices

The included server is configured for local use. To allow sign-in from other devices, deploy the app and server on a host that those devices can reach, use HTTPS, set `STUDYTRACK_SECURE_COOKIE=1`, and keep the SQLite database on persistent storage. Configure `STUDYTRACK_HOST=0.0.0.0` only when the deployment environment requires it. Do not expose the development server directly to the public internet.

## Deploy for users with Render

The included `render.yaml` configures a Python web service in Singapore, HTTPS cookies, a persistent disk for the SQLite account database and submitted files, and a private teacher registration code. The service uses Render's paid Starter compute plan because its free web service does not support persistent disks; on a free instance, account data and uploaded work can disappear after a restart or deploy.

1. Put the project files in a GitHub repository. Keep `studytrack.sqlite3` and the `upload/` folders out of the repository; `.gitignore` excludes them.
2. In Render, choose **New → Blueprint**, connect the repository, and review the service and disk plan before creating it.
3. When Render asks for `STUDYTRACK_TEACHER_CODE` and `STUDYTRACK_ADMIN_CODE`, set separate strong private codes. Share the teacher code only with trusted teachers and keep the admin code for the app owner. Students can create accounts without either code.
4. After the deploy completes, open the public `onrender.com` address shown in the Render dashboard and create an account.

The app stores account data and submissions in the server's SQLite database so users can sign in and share classroom work. The person who owns the hosting account can access the server and its database. Use the account's JSON export for backups; keep a separate copy somewhere safe.

## Features

- Dashboard, subjects, score tracker, planner calendar, Pomodoro timer, goals, notes, analytics, and achievements.
- Personal notes use a document-style editor with headings, emphasis, lists, and quote formatting. Saved documents are sanitized before display.
- Interactive charts and statistics calculated from each signed-in user's records.
- Light and dark themes, subtle transitions, reduced-motion support, responsive navigation, and empty states.
- Profile initials or an uploaded profile picture. Pictures are resized in the browser and stored with the account's app data.
- Optional profile cover photos and short bios. Profiles can be shared with classmates, with any StudyTrack account, or kept private. When a profile is private or only shared with classmates, other accounts can see only the person's name and role. Emails and academic records are not returned by the profile-view endpoint.
- JSON backup export/import, confirmed account-data deletion, and an optional local PIN for casual privacy.
- Teacher, student, and protected admin roles; private class join codes; file/folder submissions; teacher feedback and grades; multi-question class quizzes; private class-member chat; and email-address lookup for chats between StudyTrack accounts.

## Privacy and security

StudyTrack sends account and app data only to the server you configure, so shared accounts and cross-device sync require that server. `LocalStorage` keeps a browser copy while the app is in use; it is not encrypted. The server stores account and study records in SQLite. Passwords are stored as salted PBKDF2 hashes, but study records are not encrypted by this app, and anyone with access to the server database can inspect them. Admins can view account details and short activity labels, but the console does not expose private chat text, study notes, or personal scores. Use HTTPS for online deployments. The optional local PIN is a casual browser lock, not encryption.

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
