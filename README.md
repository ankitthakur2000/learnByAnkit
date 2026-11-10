# learnByAnkit

learnByAnkit is a responsive education website with searchable courses, short interactive quizzes, a student dashboard, account login, saved lesson progress, and a handwritten notes library. GitHub Pages serves the website; Supabase provides authentication, the notes database, and private file storage.

The site includes account creation, email confirmation, login, logout, password reset, three interactive starter courses with saved lesson progress, course-specific lecture pages, resumable video/PDF lecture uploads for the site owner, handwritten photo/PDF/DOCX uploads, and a private notes library. Only signed-in learners can open “My learning.”

To enable course lecture uploads, run `supabase/course-lectures.sql` in the Supabase SQL Editor after `supabase/setup.sql`. This creates a public lecture library for the three courses and a public `course-materials` bucket for the uploaded lecture files. Uploads are limited to MP4, WebM, or PDF files up to 50 MB; row-level and storage policies restrict upload and removal to the configured site-owner account. The normal course lessons remain available without signing in.

Study-note file access remains restricted by Supabase row-level and storage policies in `supabase/setup.sql`.

The GitHub Pages workflow publishes on pushes to `main`. The Supabase project URL and publishable key are configured in `config.js`; a publishable key is intended for browser use and is protected by the project’s RLS policies. No secret/service-role key is used by the site.


