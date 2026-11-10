# learnByAnkit

learnByAnkit is a responsive education website with searchable courses, short interactive quizzes, a student dashboard, account login, saved lesson progress, and a handwritten notes library. GitHub Pages serves the website; Supabase provides authentication, the notes database, and private file storage.

The site includes account creation, email confirmation, login, logout, password reset, three interactive starter courses with saved lesson progress, handwritten photo/PDF/DOCX uploads, a private notes library, and optional public sharing. File access is restricted by Supabase row-level and storage policies in `supabase/setup.sql`.

The GitHub Pages workflow publishes on pushes to `main`. The Supabase project URL and publishable key are configured in `config.js`; a publishable key is intended for browser use and is protected by the project’s RLS policies. No secret/service-role key is used by the site.


