const STORAGE_KEY = "studytrack_language";
const exact = {
  "Dashboard":"ផ្ទាំងគ្រប់គ្រង", "Subjects":"មុខវិជ្ជា", "Score tracker":"តាមដានពិន្ទុ", "Study planner":"ផែនការសិក្សា",
  "Pomodoro timer":"កម្មវិធីកំណត់ម៉ោង Pomodoro", "Study goals":"គោលដៅសិក្សា", "Personal notes":"កំណត់ត្រាផ្ទាល់ខ្លួន",
  "Analytics":"ការវិភាគ", "Achievements":"សមិទ្ធផល", "Classroom":"ថ្នាក់រៀន", "Messages":"សារ", "Admin console":"ផ្ទាំងគ្រប់គ្រង Admin",
  "Settings & privacy":"ការកំណត់ និងឯកជនភាព", "WORKSPACE":"កន្លែងធ្វើការ", "Personal workspace":"កន្លែងសិក្សាផ្ទាល់ខ្លួន",
  "Account synced":"គណនីបានធ្វើសមកាលកម្ម", "Account sync":"ការធ្វើសមកាលកម្មគណនី", "Sync paused":"ផ្អាកការធ្វើសមកាលកម្ម",
  "Student":"សិស្ស", "Teacher":"គ្រូបង្រៀន", "Admin":"អ្នកគ្រប់គ្រង", "Student account":"គណនីសិស្ស", "Teacher account":"គណនីគ្រូបង្រៀន",
  "WELCOME BACK":"សូមស្វាគមន៍មកវិញ", "CREATE YOUR ACCOUNT":"បង្កើតគណនីរបស់អ្នក", "Sign in to StudyTrack":"ចូលទៅ StudyTrack",
  "Start your journey":"ចាប់ផ្តើមដំណើររបស់អ្នក", "Continue your learning right where you left off.":"បន្តការសិក្សារបស់អ្នកពីកន្លែងដែលអ្នកបានឈប់។",
  "Your personal learning space is ready when you are.":"កន្លែងសិក្សាផ្ទាល់ខ្លួនរបស់អ្នករួចរាល់ហើយ។", "Full name":"ឈ្មោះពេញ", "Email address":"អាសយដ្ឋានអ៊ីមែល",
  "Password":"ពាក្យសម្ងាត់", "Teacher access code":"កូដចូលប្រើរបស់គ្រូ", "Admin access code":"កូដចូលប្រើរបស់ Admin",
  "Use at least 10 characters.":"ប្រើយ៉ាងតិច ១០ តួអក្សរ។", "Create student account":"បង្កើតគណនីសិស្ស", "Create teacher account":"បង្កើតគណនីគ្រូបង្រៀន",
  "Create admin account":"បង្កើតគណនី Admin", "Sign in as student":"ចូលជាសិស្ស", "Sign in as teacher":"ចូលជាគ្រូបង្រៀន", "Sign in as admin":"ចូលជា Admin",
  "Already have an account?":"មានគណនីរួចហើយ?", "New to StudyTrack?":"ទើបប្រើ StudyTrack មែនទេ?", "Sign in":"ចូលគណនី", "Create account":"បង្កើតគណនី",
  "About this app":"អំពីកម្មវិធីនេះ", "Your data syncs to your account":"ទិន្នន័យរបស់អ្នកធ្វើសមកាលកម្មទៅគណនីរបស់អ្នក",
  "Choose language":"ជ្រើសរើសភាសា", "English":"English", "ខ្មែរ":"ខ្មែរ", "Language":"ភាសា",
  "MAKE STUDYTRACK YOURS":"កំណត់ StudyTrack តាមចំណូលចិត្ត", "Settings & privacy":"ការកំណត់ និងឯកជនភាព",
  "Manage your profile, account, and study workspace preferences.":"គ្រប់គ្រងប្រវត្តិរូប គណនី និងចំណូលចិត្តកន្លែងសិក្សារបស់អ្នក។",
  "Profile":"ប្រវត្តិរូប", "Preferences":"ចំណូលចិត្ត", "Privacy center":"មជ្ឈមណ្ឌលឯកជនភាព", "About":"អំពី",
  "Personal profile":"ប្រវត្តិរូបផ្ទាល់ខ្លួន", "Your name and profile pictures appear to classmates when you allow it.":"ឈ្មោះ និងរូបភាពរបស់អ្នកនឹងបង្ហាញដល់មិត្តរួមថ្នាក់ នៅពេលអ្នកអនុញ្ញាត។",
  "COVER PHOTO":"រូបភាពគម្រប", "ADD A COVER PHOTO":"បន្ថែមរូបភាពគម្រប", "Upload cover photo":"បង្ហោះរូបភាពគម្រប", "Change cover":"ប្តូររូបភាពគម្រប",
  "Upload picture":"បង្ហោះរូបភាព", "Profile picture":"រូបភាពប្រវត្តិរូប", "Remove photo":"លុបរូបភាព", "Remove cover":"លុបរូបភាពគម្រប",
  "Display name":"ឈ្មោះបង្ហាញ", "Avatar initials":"អក្សរដើមលើរូបតំណាង", "About me":"អំពីខ្ញុំ", "Save profile":"រក្សាទុកប្រវត្តិរូប",
  "Workspace preferences":"ចំណូលចិត្តកន្លែងសិក្សា", "Choose an easy-on-the-eyes theme and your default focus intervals.":"ជ្រើសរើសរូបរាងដែលស្រួលមើល និងរយៈពេលផ្តោតអារម្មណ៍លំនាំដើម។",
  "Color theme":"ពណ៌រូបរាង", "Light":"ភ្លឺ", "Dark":"ងងឹត", "Save preferences":"រក្សាទុកចំណូលចិត្ត", "Save settings":"រក្សាទុកការកំណត់",
  "Privacy center":"មជ្ឈមណ្ឌលឯកជនភាព", "Account storage":"ការរក្សាទុកទិន្នន័យគណនី", "Optional local PIN":"លេខសម្ងាត់ PIN ក្នុងឧបករណ៍ (ជាជម្រើស)",
  "Set a PIN":"កំណត់ PIN", "Disable PIN":"បិទ PIN", "Lock now":"ចាក់សោឥឡូវនេះ", "Export JSON backup":"នាំចេញច្បាប់ចម្លង JSON",
  "Import backup":"នាំចូលច្បាប់ចម្លង", "About StudyTrack":"អំពី StudyTrack", "A study companion for students and teachers.":"ជំនួយការសិក្សាសម្រាប់សិស្ស និងគ្រូបង្រៀន។",
  "Save profile":"រក្សាទុកប្រវត្តិរូប", "Sign out":"ចាកចេញ", "Sign out of StudyTrack":"ចាកចេញពី StudyTrack",
  "YOUR LEARNING COMMUNITY":"សហគមន៍សិក្សារបស់អ្នក", "Create a class":"បង្កើតថ្នាក់", "Join a class":"ចូលរួមថ្នាក់", "Open classroom":"បើកថ្នាក់រៀន",
  "All classes":"ថ្នាក់ទាំងអស់", "Assignments":"កិច្ចការ", "Class quizzes":"សំណួរប្រឡងក្នុងថ្នាក់", "Messages":"សារ",
  "No assignments yet":"មិនទាន់មានកិច្ចការទេ", "No quizzes yet":"មិនទាន់មានសំណួរប្រឡងទេ", "Your teacher has not posted an assignment yet.":"គ្រូរបស់អ្នកមិនទាន់បានដាក់កិច្ចការទេ។",
  "Your teacher has not posted a class quiz yet.":"គ្រូរបស់អ្នកមិនទាន់បានដាក់សំណួរប្រឡងក្នុងថ្នាក់ទេ។", "Add the first assignment for this class.":"បន្ថែមកិច្ចការដំបូងសម្រាប់ថ្នាក់នេះ។",
  "Create your first quiz":"បង្កើតសំណួរប្រឡងដំបូង", "Add a quiz and your students can answer it in this class.":"បន្ថែមសំណួរប្រឡង ដើម្បីឱ្យសិស្សអាចឆ្លើយក្នុងថ្នាក់នេះ។",
  "Copy":"ចម្លង", "Copy code":"ចម្លងកូដ", "Copied!":"បានចម្លង!", "Class join code copied":"បានចម្លងកូដចូលថ្នាក់", "Join code":"កូដចូលថ្នាក់",
  "JOIN CODE":"កូដចូលថ្នាក់", "CLASS JOIN CODE":"កូដចូលថ្នាក់", "CLASS QUIZ":"សំណួរប្រឡងក្នុងថ្នាក់", "Create quiz":"បង្កើតសំណួរប្រឡង",
  "New assignment":"កិច្ចការថ្មី", "Create assignment":"បង្កើតកិច្ចការ", "Submit work":"ដាក់ស្នើកិច្ចការ", "Not submitted yet":"មិនទាន់បានដាក់ស្នើ",
  "Maximum score":"ពិន្ទុអតិបរមា", "Grade submission":"ដាក់ពិន្ទុកិច្ចការ", "Edit score & feedback":"កែពិន្ទុ និងមតិយោបល់", "Teacher feedback":"មតិយោបល់ពីគ្រូ",
  "STUDYTRACK CONTROL CENTER":"មជ្ឈមណ្ឌលគ្រប់គ្រង STUDYTRACK", "Manage accounts and review classroom activity summaries.":"គ្រប់គ្រងគណនី និងពិនិត្យសកម្មភាពក្នុងថ្នាក់។",
  "Accounts":"គណនី", "Students":"សិស្ស", "Teachers":"គ្រូបង្រៀន", "Classes":"ថ្នាក់", "Recent activity":"សកម្មភាពថ្មីៗ",
  "Animated aurora":"ពន្លឺ Aurora មានចលនា", "Angkor Wat":"អង្គរវត្ត", "Custom image or GIF":"រូបភាព ឬ GIF ផ្ទាល់ខ្លួន",
  "Restore default":"ត្រឡប់ទៅលំនាំដើម", "Refresh":"ធ្វើឱ្យថ្មី", "Loading account and activity summary…":"កំពុងផ្ទុកសង្ខេបគណនី និងសកម្មភាព…",
  "Settings & privacy":"ការកំណត់ និងឯកជនភាព", "Plan your day":"រៀបចំផែនការថ្ងៃនេះ", "Open focus timer":"បើកម៉ោងផ្តោតអារម្មណ៍",
  "Subjects":"មុខវិជ្ជា", "Overall average":"មធ្យមភាគសរុប", "Total study hours":"ម៉ោងសិក្សាសរុប", "Completed tasks":"កិច្ចការដែលបានបញ្ចប់",
  "Study streak":"ថ្ងៃសិក្សាជាប់គ្នា", "Upcoming exams":"ការប្រឡងខាងមុខ", "Private account space":"កន្លែងគណនីឯកជន",
  "People in my classes":"អ្នកនៅក្នុងថ្នាក់របស់ខ្ញុំ", "Anyone with a StudyTrack account":"អ្នកណាក៏បានដែលមានគណនី StudyTrack", "Keep photos and About me private":"រក្សារូបថត និងអំពីខ្ញុំជាឯកជន",
  "Who can see your photos and About me?":"អ្នកណាអាចមើលរូបថត និងព័ត៌មានអំពីអ្នក?", "Save":"រក្សាទុក", "Cancel":"បោះបង់", "Close":"បិទ", "Delete":"លុប",
  "View profile":"មើលប្រវត្តិរូប", "Message":"ផ្ញើសារ", "Send":"ផ្ញើ", "Search":"ស្វែងរក", "Try again":"ព្យាយាមម្តងទៀត",
  "Loading your classroom…":"កំពុងផ្ទុកថ្នាក់រៀនរបស់អ្នក…", "Teacher":"គ្រូបង្រៀន", "Student":"សិស្ស", "Admin":"អ្នកគ្រប់គ្រង",
  "Good morning":"អរុណសួស្តី", "Good afternoon":"សួស្តីពេលរសៀល", "Good evening":"សួស្តីពេលល្ងាច",
  "Private classroom spaces":"កន្លែងថ្នាក់រៀនឯកជន", "STUDY WITH PURPOSE":"សិក្សាដោយមានគោលបំណង", "A brighter way to":"វិធីភ្លឺស្វាងជាងមុនដើម្បី",
  "make progress.":"រីកចម្រើន។", "One step at a time":"ម្តងមួយជំហានៗ", "STUDENT VIEW":"ទិដ្ឋភាពសិស្ស", "TEACHER VIEW":"ទិដ្ឋភាពគ្រូបង្រៀន",
  "Search people by name, email, or role…":"ស្វែងរកតាមឈ្មោះ អ៊ីមែល ឬតួនាទី…", "Profile saved":"បានរក្សាទុកប្រវត្តិរូប",
  "Profile picture saved to your account":"បានរក្សាទុករូបភាពប្រវត្តិរូបក្នុងគណនី", "Cover photo saved to your account":"បានរក្សាទុករូបភាពគម្របក្នុងគណនី",
  "Connected sign-in methods":"វិធីចូលគណនីដែលបានភ្ជាប់", "Not connected":"មិនទាន់ភ្ជាប់", "Connected":"បានភ្ជាប់",
  "Add subject":"បន្ថែមមុខវិជ្ជា", "New subject":"មុខវិជ្ជាថ្មី", "Edit subject":"កែប្រែមុខវិជ្ជា", "Subject name":"ឈ្មោះមុខវិជ្ជា",
  "Description":"ការពិពណ៌នា", "Target score":"ពិន្ទុគោលដៅ", "Add score":"បន្ថែមពិន្ទុ", "Record score":"កត់ត្រាពិន្ទុ", "Edit score":"កែប្រែពិន្ទុ",
  "Assessment":"ការវាយតម្លៃ", "Assessment type":"ប្រភេទការវាយតម្លៃ", "Obtained score":"ពិន្ទុទទួលបាន", "Maximum points":"ពិន្ទុអតិបរមា",
  "Date":"កាលបរិច្ឆេទ", "Notes":"កំណត់ត្រា", "Tasks":"កិច្ចការ", "Add task":"បន្ថែមកិច្ចការ", "New task":"កិច្ចការថ្មី",
  "Edit task":"កែប្រែកិច្ចការ", "Task title":"ចំណងជើងកិច្ចការ", "Category":"ប្រភេទ", "Duration":"រយៈពេល", "Priority":"អាទិភាព",
  "Description":"ការពិពណ៌នា", "Goals":"គោលដៅ", "Add goal":"បន្ថែមគោលដៅ", "New goal":"គោលដៅថ្មី", "Progress":"វឌ្ឍនភាព",
  "Focus":"ផ្តោតអារម្មណ៍", "Short break":"សម្រាកខ្លី", "Long break":"សម្រាកវែង", "Start":"ចាប់ផ្តើម", "Pause":"ផ្អាក", "Resume":"បន្ត",
  "Reset":"កំណត់ឡើងវិញ", "Save preferences":"រក្សាទុកចំណូលចិត្ត", "Search notes…":"ស្វែងរកកំណត់ត្រា…", "Add note":"បន្ថែមកំណត់ត្រា",
  "New note":"កំណត់ត្រាថ្មី", "Edit note":"កែប្រែកំណត់ត្រា", "Search":"ស្វែងរក", "No results":"គ្មានលទ្ធផល", "Today":"ថ្ងៃនេះ",
  "This week":"សប្តាហ៍នេះ", "This month":"ខែនេះ", "All time":"គ្រប់ពេល", "Average":"មធ្យមភាគ", "Total":"សរុប",
  "Study time":"រយៈពេលសិក្សា", "No subjects yet":"មិនទាន់មានមុខវិជ្ជាទេ", "No scores yet":"មិនទាន់មានពិន្ទុទេ",
  "No tasks yet":"មិនទាន់មានកិច្ចការទេ", "No goals yet":"មិនទាន់មានគោលដៅទេ", "No notes yet":"មិនទាន់មានកំណត់ត្រាទេ",
  "Start your first study session":"ចាប់ផ្តើមវគ្គសិក្សាដំបូងរបស់អ្នក", "Keep going":"បន្តទៅមុខ", "Your progress":"វឌ្ឍនភាពរបស់អ្នក",
  "Join class":"ចូលរួមថ្នាក់", "Class name":"ឈ្មោះថ្នាក់", "Enter class code":"បញ្ចូលកូដថ្នាក់", "Create class":"បង្កើតថ្នាក់",
  "Copy class join code":"ចម្លងកូដចូលថ្នាក់", "Students in this class":"សិស្សក្នុងថ្នាក់នេះ", "Classmates":"មិត្តរួមថ្នាក់",
  "No conversations yet":"មិនទាន់មានការសន្ទនាទេ", "Write a message…":"សរសេរសារ…", "Start the conversation":"ចាប់ផ្តើមការសន្ទនា",
  "Private conversations with people in this class":"ការសន្ទនាឯកជនជាមួយអ្នកក្នុងថ្នាក់នេះ", "Only you and the recipient can see these messages":"មានតែអ្នក និងអ្នកទទួលប៉ុណ្ណោះដែលអាចមើលសារទាំងនេះបាន",
  "View results":"មើលលទ្ធផល", "Review answers":"ពិនិត្យចម្លើយ", "Start quiz":"ចាប់ផ្តើមប្រឡង", "Ready to take":"ត្រៀមប្រឡង",
  "Completed":"បានបញ្ចប់", "Completed tasks":"កិច្ចការដែលបានបញ្ចប់", "One attempt":"ឆ្លើយបានម្តង", "questions":"សំណួរ",
  "Your grade":"ពិន្ទុរបស់អ្នក", "Score posted":"បានបង្ហោះពិន្ទុ", "Awaiting grade":"កំពុងរង់ចាំពិន្ទុ", "Submitted work":"កិច្ចការដែលបានដាក់ស្នើ",
  "Upload file":"បង្ហោះឯកសារ", "Choose files":"ជ្រើសរើសឯកសារ", "No file chosen":"មិនទាន់ជ្រើសរើសឯកសារ", "Feedback":"មតិយោបល់",
  "Who can see your photos and About me?":"អ្នកណាអាចមើលរូបថត និងព័ត៌មានអំពីអ្នក?", "People in my classes":"អ្នកនៅក្នុងថ្នាក់របស់ខ្ញុំ",
  "Anyone with a StudyTrack account":"អ្នកណាក៏បានដែលមានគណនី StudyTrack", "Keep photos and About me private":"រក្សារូបថត និងអំពីខ្ញុំជាឯកជន",
  "Add a little about yourself…":"សរសេរបន្តិចអំពីខ្លួនអ្នក…", "Share a little about what you are learning…":"ចែករំលែកបន្តិចអំពីអ្វីដែលអ្នកកំពុងសិក្សា…",
  "Your profile is private":"ប្រវត្តិរូបរបស់អ្នកជាឯកជន", "This member has not added an introduction yet.":"សមាជិកនេះមិនទាន់បានបន្ថែមការណែនាំខ្លួនទេ។",
  "Go back":"ត្រឡប់ក្រោយ", "Back":"ថយក្រោយ", "Next":"បន្ទាប់", "Finish":"បញ្ចប់", "Done":"រួចរាល់",
  "No account?":"មិនទាន់មានគណនី?", "Need help signing in?":"ត្រូវការជំនួយចូលគណនីទេ?", "Forgot password?":"ភ្លេចពាក្យសម្ងាត់?",
  "PASSWORD HELP":"ជំនួយពាក្យសម្ងាត់", "Reset your password":"កំណត់ពាក្យសម្ងាត់ឡើងវិញ", "Choose a new password":"ជ្រើសរើសពាក្យសម្ងាត់ថ្មី",
  "Use the form below to set a new password.":"ប្រើទម្រង់ខាងក្រោមដើម្បីកំណត់ពាក្យសម្ងាត់ថ្មី។",
  "Enter the email address on your StudyTrack account. We’ll send a one-time link.":"បញ្ចូលអ៊ីមែលគណនី StudyTrack របស់អ្នក។ យើងនឹងផ្ញើតំណប្រើបានម្តង។",
  "New password":"ពាក្យសម្ងាត់ថ្មី", "Confirm new password":"បញ្ជាក់ពាក្យសម្ងាត់ថ្មី", "Enter the new password again":"បញ្ចូលពាក្យសម្ងាត់ថ្មីម្តងទៀត",
  "Send reset link":"ផ្ញើតំណកំណត់ឡើងវិញ", "Save new password":"រក្សាទុកពាក្យសម្ងាត់ថ្មី", "Back to sign in":"ត្រឡប់ទៅចូលគណនី",
  "Remember your password?":"នៅចាំពាក្យសម្ងាត់ទេ?", "Reset link not working?":"តំណកំណត់ឡើងវិញមិនដំណើរការមែនទេ?", "Request a new link":"ស្នើសុំតំណថ្មី",
  "If an account exists for this email, a reset link will arrive shortly. Check your inbox and spam folder.":"បើមានគណនីដែលប្រើអ៊ីមែលនេះ តំណកំណត់ឡើងវិញនឹងមកដល់ឆាប់ៗនេះ។ សូមពិនិត្យប្រអប់សារ និងសារឥតបានការ។",
  "Reset links expire after 30 minutes and can only be used once.":"តំណកំណត់ឡើងវិញផុតកំណត់ក្រោយ ៣០ នាទី និងប្រើបានតែម្តងប៉ុណ្ណោះ។",
  "Password updated. Sign in with your new password.":"បានកែពាក្យសម្ងាត់ហើយ។ សូមចូលដោយប្រើពាក្យសម្ងាត់ថ្មី។",
  "The passwords do not match.":"ពាក្យសម្ងាត់មិនត្រូវគ្នាទេ។", "This reset link is invalid or expired. Request a new one.":"តំណកំណត់ឡើងវិញនេះមិនត្រឹមត្រូវ ឬផុតកំណត់ហើយ។ សូមស្នើសុំតំណថ្មី។",
  "Password reset email is not configured. Contact the StudyTrack administrator.":"មិនទាន់កំណត់អ៊ីមែលសម្រាប់កំណត់ពាក្យសម្ងាត់ទេ។ សូមទាក់ទងអ្នកគ្រប់គ្រង StudyTrack។",
  "Choose a password with at least 10 characters.":"ជ្រើសរើសពាក្យសម្ងាត់ដែលមានយ៉ាងតិច ១០ តួអក្សរ។",
  "All student and teacher accounts":"គណនីសិស្ស និងគ្រូទាំងអស់", "Active student accounts":"គណនីសិស្សសកម្ម", "Active teacher accounts":"គណនីគ្រូសកម្ម",
  "Shared background":"ផ្ទៃខាងក្រោយរួម", "Choose the backdrop shown to everyone using StudyTrack.":"ជ្រើសរើសផ្ទៃខាងក្រោយដែលបង្ហាញដល់អ្នកប្រើ StudyTrack ទាំងអស់។",
  "Admin setting":"ការកំណត់របស់ Admin", "Use the StudyTrack landmark photo":"ប្រើរូបភាពទីតាំងសម្គាល់របស់ StudyTrack", "Soft moving color lights":"ពន្លឺពណ៌ទន់ៗដែលមានចលនា",
  "Upload an image or GIF":"បង្ហោះរូបភាព ឬ GIF", "GIF animation is kept · up to 2 MB":"រក្សាចលនា GIF · ទំហំអតិបរមា ២ MB",
  "This affects the background across devices and accounts. The uploaded picture is stored with this app’s server settings.":"វាប្តូរផ្ទៃខាងក្រោយលើឧបករណ៍ និងគណនីទាំងអស់។ រូបភាពដែលបានបង្ហោះត្រូវបានរក្សាទុកក្នុងការកំណត់ server របស់កម្មវិធីនេះ។",
  "Shared background":"ផ្ទៃខាងក្រោយរួម", "Save role":"រក្សាទុកតួនាទី", "Active":"សកម្ម", "Paused":"បានផ្អាក", "Restore":"ស្ដារ", "Pause":"ផ្អាក",
  "Custom background saved for everyone":"បានរក្សាទុកផ្ទៃខាងក្រោយផ្ទាល់ខ្លួនសម្រាប់អ្នកទាំងអស់", "Animated background applied for everyone":"បានកំណត់ផ្ទៃខាងក្រោយចលនាសម្រាប់អ្នកទាំងអស់",
  "Angkor Wat background restored for everyone":"បានកំណត់ផ្ទៃខាងក្រោយអង្គរវត្តសម្រាប់អ្នកទាំងអស់", "Background":"ផ្ទៃខាងក្រោយ",
  "Study groups":"ក្រុមសិក្សា", "Posted assignments":"កិច្ចការដែលបានបង្ហោះ", "Published quizzes":"សំណួរប្រឡងដែលបានផ្សព្វផ្សាយ",
  "Student work submitted":"កិច្ចការដែលសិស្សបានដាក់ស្នើ", "Private messages sent":"សារឯកជនដែលបានផ្ញើ", "Pause account":"ផ្អាកគណនី", "Restore account":"ស្ដារគណនី",
};
const attributes = ["placeholder", "title", "aria-label"];
const originalNodes = new WeakMap();
const originalAttributes = new WeakMap();
let language = localStorage.getItem(STORAGE_KEY) === "km" ? "km" : "en";

function translate(value) {
  const text = value.trim();
  if (language !== "km") return value;
  let result = exact[text];
  if (!result) {
    let match = text.match(/^(\d+) assignments?$/i);
    if (match) result = `${match[1]} កិច្ចការ`;
    match ||= text.match(/^(\d+) quizzes?$/i);
    if (!result && match) result = `${match[1]} សំណួរប្រឡង`;
    match = text.match(/^Teacher: (.+) · (\d+) assignments?$/i);
    if (!result && match) result = `គ្រូ៖ ${match[1]} · ${match[2]} កិច្ចការ`;
    match = text.match(/^Due (.+)$/i);
    if (!result && match) result = `កំណត់ថ្ងៃ ${match[1]}`;
    match = text.match(/^Maximum score$/i);
    if (!result && match) result = "ពិន្ទុអតិបរមា";
    match = text.match(/^Good (morning|afternoon|evening), (.+)$/i);
    if (!result && match) result = `${({morning:"អរុណសួស្តី",afternoon:"សួស្តីពេលរសៀល",evening:"សួស្តីពេលល្ងាច"})[match[1].toLowerCase()]}, ${match[2]}`;
    match = text.match(/^(\d+) (student|students|teacher|teachers|classmates)$/i);
    if (!result && match) result = `${match[1]} ${{student:"សិស្ស",students:"សិស្ស",teacher:"គ្រូបង្រៀន",teachers:"គ្រូបង្រៀន",classmates:"មិត្តរួមថ្នាក់"}[match[2].toLowerCase()]}`;
    match = text.match(/^(\d+)h (\d+)m$/i);
    if (!result && match) result = `${match[1]} ម៉ោង ${match[2]} នាទី`;
    match = text.match(/^Today · (.+)$/i);
    if (!result && match) result = `ថ្ងៃនេះ · ${match[1]}`;
    match = text.match(/^Due (.+)$/i);
    if (!result && match) result = `កំណត់ថ្ងៃ ${match[1]}`;
    match = text.match(/^Sign in as (student|teacher|admin)$/i);
    if (!result && match) result = `ចូលជា${({student:"សិស្ស",teacher:"គ្រូបង្រៀន",admin:"Admin"})[match[1].toLowerCase()]}`;
    match = text.match(/^Create (student|teacher|admin) account$/i);
    if (!result && match) result = `បង្កើតគណនី${({student:"សិស្ស",teacher:"គ្រូបង្រៀន",admin:"Admin"})[match[1].toLowerCase()]}`;
  }
  if (!result) return value;
  const offset = value.indexOf(text);
  return value.slice(0, offset) + result + value.slice(offset + text.length);
}

function apply(root=document) {
  const nodes = [];
  if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
  else {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) nodes.push(walker.currentNode);
  }
  for (const node of nodes) {
    if (!node.parentElement || node.parentElement.closest("script,style,textarea,code,pre,[contenteditable='true'],.studytrack-icon")) continue;
    if (!originalNodes.has(node)) originalNodes.set(node, node.nodeValue || "");
    node.nodeValue = translate(originalNodes.get(node));
  }
  const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll("*")] : root.nodeType === Node.DOCUMENT_NODE ? [...document.querySelectorAll("*")] : [];
  for (const element of elements) {
    let saved = originalAttributes.get(element);
    for (const name of attributes) {
      if (!element.hasAttribute(name)) continue;
      if (!saved) { saved = {}; originalAttributes.set(element, saved); }
      if (!(name in saved)) saved[name] = element.getAttribute(name);
      element.setAttribute(name, translate(saved[name]));
    }
  }
  document.documentElement.lang = language === "km" ? "km" : "en";
  const label = language === "km" ? "ខ្មែរ" : "English";
  document.querySelectorAll("[data-language-current]").forEach(current => {
    if (current.textContent !== label) current.textContent = label;
  });
  document.querySelectorAll("[data-language-option]").forEach(option => {
    const selected = option.dataset.languageOption === language;
    option.setAttribute("aria-checked", String(selected));
    option.classList.toggle("selected", selected);
  });
}
function closeLanguageMenus(restoreFocus=false) {
  document.querySelectorAll("[data-language-menu]:not([hidden])").forEach(menu => {
    menu.hidden = true;
    const trigger = menu.closest("[data-language-picker]")?.querySelector("[data-language-trigger]");
    trigger?.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger?.focus();
  });
}
function openLanguageMenu(trigger) {
  const picker = trigger.closest("[data-language-picker]");
  const menu = picker?.querySelector("[data-language-menu]");
  if (!picker || !menu) return;
  const opening = menu.hidden;
  closeLanguageMenus();
  if (!opening) return;
  menu.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  menu.querySelector('[data-language-option][aria-checked="true"]')?.focus();
}

export function setLanguage(value) {
  language = value === "km" ? "km" : "en";
  localStorage.setItem(STORAGE_KEY, language);
  apply(document);
  window.dispatchEvent(new CustomEvent("studytrack:language-change", { detail: { language } }));
}
export function getLanguage() { return language; }
window.StudyTrackI18n = { setLanguage, getLanguage };
document.addEventListener("click", event => {
  const option = event.target.closest("[data-language-option]");
  if (option) {
    setLanguage(option.dataset.languageOption);
    closeLanguageMenus(true);
    return;
  }
  const trigger = event.target.closest("[data-language-trigger]");
  if (trigger) { openLanguageMenu(trigger); return; }
  if (!event.target.closest("[data-language-picker]")) closeLanguageMenus();
});
document.addEventListener("keydown", event => {
  const menu = event.target.closest("[data-language-menu]");
  const options = menu ? [...menu.querySelectorAll("[data-language-option]")] : [];
  const index = options.indexOf(document.activeElement);
  if (menu && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    options[(index + step + options.length) % options.length]?.focus();
  } else if (menu && (event.key === "Home" || event.key === "End")) {
    event.preventDefault(); options[event.key === "Home" ? 0 : options.length - 1]?.focus();
  } else if (event.key === "Escape" && menu) {
    event.preventDefault(); closeLanguageMenus(true);
  } else if (event.key === "ArrowDown" && event.target.matches("[data-language-trigger]")) {
    event.preventDefault(); openLanguageMenu(event.target);
  }
});
apply(document);
new MutationObserver(records => {
  for (const record of records) for (const node of record.addedNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) apply(node);
    else if (node.nodeType === Node.TEXT_NODE) apply(node);
  }
}).observe(document.documentElement, { childList: true, subtree: true });
