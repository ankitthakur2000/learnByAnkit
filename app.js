import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.LEARNNEST_CONFIG || {};
const hasConfig = /^https:\/\/.+\.supabase\.co$/.test(config.supabaseUrl || '') && /^sb_publishable_/.test(config.supabasePublishableKey || '') || /^https:\/\/.+\.supabase\.co$/.test(config.supabaseUrl || '') && /^eyJ/.test(config.supabasePublishableKey || '');
const supabase = hasConfig ? createClient(config.supabaseUrl, config.supabasePublishableKey) : null;
const ADMIN_USER_ID = '246bcd5e-cf1b-44d3-be9e-9a0acd516e0c';
const $ = (id) => document.getElementById(id);
const backdrop = $('modalBackdrop');
const modalBody = $('modalBody');
const toastNode = $('toast');
let toastTimer;
let stagedFiles = [];
let currentSession = null;
let dashboardAccessPending = false;
let libraryScope = 'mine';
let noteActionTargets = new Map();
let noteLibraryData = [];
let noteViewMode = 'grid';
let activeNotePreviewUrl = null;
let mammothPromise = null;

function toast(message, isError = false) {
  toastNode.textContent = message;
  toastNode.classList.toggle('toast-error', isError);
  toastNode.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('show'), 3200);
}
function escapeHtml(text) { return String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function displayName(user) { return user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Learner'; }
function isAdmin() { return currentSession?.user?.id === ADMIN_USER_ID; }
function clearNotePreviewUrl() {
  if (activeNotePreviewUrl) URL.revokeObjectURL(activeNotePreviewUrl);
  activeNotePreviewUrl = null;
}
function syncHeader(session) {
  currentSession = session;
  const user = session?.user;
  $('loginButton').textContent = user ? 'Log out' : 'Log in';
  $('signupButton').innerHTML = user ? `${escapeHtml(displayName(user).split(' ')[0])}’s notes <span>↗</span>` : 'Get started <span>↗</span>';
  $('loginButton').onclick = user ? signOut : () => openAuth('login');
}
function openModal(content) {
  backdrop.querySelector('.modal')?.classList.remove('wide-modal');
  modalBody.innerHTML = content;
  backdrop.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  $('modalClose').focus();
}
function closeModal() {
  backdrop.classList.add('hidden');
  document.body.style.overflow = '';
  stagedFiles = [];
  if (dashboardAccessPending && !currentSession?.user) dashboardAccessPending = false;
}
function requireBackend() {
  if (supabase) return true;
  openModal(`<div class="modal-kicker">learnByAnkit SETUP</div><h2 id="modalTitle">The site is ready to connect.</h2><p class="modal-copy">Account and file storage are built in. This copy needs the public Supabase project URL and publishable key in <code>config.js</code> before accounts can be enabled.</p><p class="form-note">The browser uses only the public publishable key. Database access is restricted with user-level security rules.</p>`);
  return false;
}
function openAuth(mode = 'login', reason = '') {
  if (!requireBackend()) return;
  const signup = mode === 'signup';
  const reset = mode === 'reset';
  const updatePassword = mode === 'update-password';
  const loginCopy = reason === 'dashboard' ? 'Please sign in to see your learning progress and quiz results.' : 'Log in to see your notes and continue learning.';
  openModal(`<div class="modal-kicker">${signup ? 'MAKE A LITTLE SPACE FOR LEARNING' : 'YOUR learnByAnkit SPACE'}</div><h2 id="modalTitle">${signup ? 'Start your learning journey.' : reset ? 'Reset your password.' : updatePassword ? 'Choose a new password.' : 'Welcome back.'}</h2><p class="modal-copy">${signup ? 'Create an account to view and download study notes.' : reset ? 'We’ll email you a secure password reset link.' : updatePassword ? 'Choose a new password for your learnByAnkit account.' : loginCopy}</p><form id="authForm">${signup ? '<label class="form-field"><span>Your name</span><input name="name" autocomplete="name" placeholder="How should we call you?" required maxlength="80"></label>' : ''}${updatePassword ? '' : '<label class="form-field"><span>Email address</span><input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label>'}${reset ? '' : '<label class="form-field"><span>Password</span><input name="password" type="password" autocomplete="' + (signup || updatePassword ? 'new-password' : 'current-password') + '" placeholder="At least 8 characters" minlength="8" required></label>'}<button class="primary-button modal-submit" type="submit">${signup ? 'Create my account' : reset ? 'Send reset link' : updatePassword ? 'Save new password' : 'Log in'} <span>→</span></button><p id="authError" class="auth-error" role="alert" hidden></p></form><p class="modal-switch">${signup ? 'Already have an account?' : reset ? 'Remembered your password?' : 'New to learnByAnkit?'} <button id="switchAuth">${signup || reset || updatePassword ? 'Log in' : 'Create an account'}</button>${!signup && !reset && !updatePassword ? ' · <button id="forgotPassword">Forgot password?</button>' : ''}</p><p class="form-note">Your account is securely managed by Supabase. Your password is never stored by this website.</p>`);
  $('authForm').addEventListener('submit', async event => {
    event.preventDefault();
    const authError = $('authError');
    authError.hidden = true;
    authError.textContent = '';
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim().toLowerCase();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.innerHTML = 'Please wait…';
    let result;
    if (reset) {
      const callbackUrl = new URL('index.html', window.location.href);
      callbackUrl.search = '';
      callbackUrl.hash = '';
      result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl.href });
      if (!result.error) { closeModal(); toast('Password reset link sent. Check your email.'); }
    } else if (updatePassword) {
      result = await supabase.auth.updateUser({ password: String(form.get('password')) });
      if (!result.error) { closeModal(); toast('Your password has been updated.'); }
    } else if (signup) {
      result = await supabase.auth.signUp({ email, password: String(form.get('password')), options: { data: { display_name: String(form.get('name')).trim() }, emailRedirectTo: window.location.href.split('#')[0] } });
      if (!result.error) {
        closeModal();
        if (result.data.session) {
          syncHeader(result.data.session);
          toast('Your account is ready. Welcome to learnByAnkit!');
          if (dashboardAccessPending) { dashboardAccessPending = false; navigatePage('dashboard'); }
        }
        else {
          openModal(`<div class="modal-kicker">ONE QUICK CHECK</div><h2 id="modalTitle">Check your inbox.</h2><p class="modal-copy">We sent a confirmation link to <b>${escapeHtml(email)}</b>. Confirm your email, then log in to start saving notes.</p><button class="primary-button modal-submit" id="confirmLogin">Back to log in <span>→</span></button>`);
          $('confirmLogin').onclick = () => openAuth('login');
        }
      }
    } else {
      result = await supabase.auth.signInWithPassword({ email, password: String(form.get('password')) });
      if (!result.error) {
        syncHeader(result.data.session);
        closeModal();
        toast('You’re logged in. Welcome back!');
        if (dashboardAccessPending) { dashboardAccessPending = false; navigatePage('dashboard'); }
      }
    }
    if (result?.error) {
      button.disabled = false;
      button.innerHTML = `${signup ? 'Create my account' : reset ? 'Send reset link' : updatePassword ? 'Save new password' : 'Log in'} <span>→</span>`;
      const message = String(result.error.message || 'Something went wrong. Please try again.');
      if (reset) {
        authError.textContent = /rate.?limit|too many|429|sending.?limit/i.test(message)
          ? 'Too many password reset emails were requested recently. Please wait a while before trying again. If you already requested one, check your inbox and spam folder.'
          : message;
        authError.hidden = false;
      } else {
        toast(message, true);
      }
    }
  });
  $('switchAuth').onclick = () => openAuth(signup || reset || updatePassword ? 'login' : 'signup');
  $('forgotPassword')?.addEventListener('click', () => openAuth('reset'));
}
async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) toast(error.message, true);
  else toast('You’re logged out.');
}
function openUpload() {
  if (!requireBackend()) return;
  if (!currentSession?.user) {
    openModal('<div class="modal-kicker">learnByAnkit STUDY NOTES</div><h2 id="modalTitle">Log in to view the library.</h2><p class="modal-copy">Sign in to browse and download the notes already uploaded. New notes can only be added by the learnByAnkit owner.</p><button class="primary-button modal-submit" id="uploadSignup">Create an account <span>→</span></button><p class="modal-switch">Already have an account? <button id="uploadLogin">Log in</button></p>');
    $('uploadSignup').onclick = () => openAuth('signup');
    $('uploadLogin').onclick = () => openAuth('login');
    return;
  }
  if (!isAdmin()) return toast('Only the learnByAnkit owner can add study notes.', true);
  stagedFiles = [];
  openModal('<div class="modal-kicker">learnByAnkit STUDY NOTES</div><h2 id="modalTitle">Add notes to the library.</h2><p class="modal-copy">Choose clear photos, scans, PDFs, or Word documents. Signed-in learners will be able to view and download these files.</p><label class="form-field"><span>Subject</span><select id="noteSubject"><option>Biology</option><option>Mathematics</option><option>History</option><option>Physics</option><option>Computer science</option><option>Other</option></select></label><div class="upload-drop" id="uploadDrop"><strong>Drop your files here</strong><small>JPG, PNG, WebP, HEIC, PDF, or DOCX · up to 25 MB each</small><button id="chooseFiles" type="button">Choose files</button><div class="file-list" id="fileList"></div></div><label class="form-field"><span>Note title (optional)</span><input id="noteTitle" placeholder="e.g. Plant cell revision" maxlength="140"></label><button class="primary-button modal-submit" id="saveNotes" type="button">Upload study notes <span>↑</span></button><p class="form-note">Only the learnByAnkit owner can add, change, or remove files.</p>');
  const fileInput = $('fileInput');
  $('chooseFiles').onclick = () => fileInput.click();
  fileInput.onchange = () => { stagedFiles = [...fileInput.files]; fileInput.value = ''; displayStagedFiles(); };
  const drop = $('uploadDrop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragging'); stagedFiles = [...e.dataTransfer.files].filter(validFile); displayStagedFiles(); });
  $('saveNotes').onclick = uploadNotes;
}
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
function isDocxNote(note) {
  return note?.file_type === DOCX_MIME || /\.docx$/i.test(note?.file_name || note?.title || '');
}
function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (!mammothPromise) {
    mammothPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.13.0/mammoth.browser.min.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => window.mammoth ? resolve(window.mammoth) : reject(new Error('The Word reader could not start.'));
      script.onerror = () => {
        mammothPromise = null;
        reject(new Error('The Word reader could not load. Please use Download to open this file.'));
      };
      document.head.appendChild(script);
    });
  }
  return mammothPromise;
}
const DOCX_ALLOWED_TAGS = new Set(['a','b','blockquote','br','caption','code','dd','div','dl','dt','em','h1','h2','h3','h4','h5','h6','hr','i','img','li','ol','p','pre','s','span','strong','sub','sup','table','tbody','td','tfoot','th','thead','tr','u','ul']);
const DOCX_BLOCKED_TAGS = new Set(['iframe','object','embed','script','style','svg','math','form','input','video','audio']);
function sanitizeDocxHtml(html) {
  const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const cleanNode = node => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const tag = node.tagName.toLowerCase();
    if (DOCX_BLOCKED_TAGS.has(tag)) return null;
    const children = Array.from(node.childNodes).map(cleanNode).filter(Boolean);
    if (!DOCX_ALLOWED_TAGS.has(tag)) {
      const fragment = document.createDocumentFragment();
      children.forEach(child => fragment.appendChild(child));
      return fragment;
    }
    const safe = document.createElement(tag);
    if (tag === 'a') {
      const href = node.getAttribute('href') || '';
      if (/^(https?:\/\/|mailto:)/i.test(href)) {
        safe.setAttribute('href', href);
        safe.setAttribute('rel', 'noopener noreferrer');
      }
    }
    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      if (!/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src)) return null;
      safe.setAttribute('src', src);
      safe.setAttribute('alt', (node.getAttribute('alt') || 'Image in Word document').slice(0, 300));
    }
    if (tag === 'td' || tag === 'th') {
      for (const attribute of ['colspan','rowspan']) {
        const value = Number(node.getAttribute(attribute));
        if (Number.isInteger(value) && value >= 1 && value <= 100) safe.setAttribute(attribute, String(value));
      }
    }
    children.forEach(child => safe.appendChild(child));
    return safe;
  };
  const output = document.createElement('div');
  Array.from(parsed.body.childNodes).map(cleanNode).filter(Boolean).forEach(node => output.appendChild(node));
  return output.innerHTML;
}
function fileMimeType(file) {
  if (file.type) return file.type;
  const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  return extension === 'docx' ? DOCX_MIME : extension === 'pdf' ? 'application/pdf' : '';
}
function validFile(file) { return ['image/jpeg','image/png','image/webp','image/heic','application/pdf',DOCX_MIME].includes(fileMimeType(file)) && file.size <= 25 * 1024 * 1024; }
function displayStagedFiles() {
  const list = $('fileList');
  if (!list) return;
  const invalid = stagedFiles.some(file => !validFile(file));
  list.textContent = stagedFiles.length ? stagedFiles.map(file => `${file.name} · ${formatSize(file.size)}`).join('\n') : '';
  list.style.whiteSpace = 'pre-line';
  if (invalid) list.textContent += '\nOne or more files are too large or use an unsupported format.';
}
function formatSize(bytes) { return bytes > 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB'; }
async function uploadNotes() {
  if (!isAdmin()) return toast('Only the learnByAnkit owner can add study notes.', true);
  if (!currentSession?.user) return toast('Log in to add study notes.', true);
  if (!stagedFiles.length) return toast('Choose at least one photo, PDF, or Word document first.', true);
  if (stagedFiles.some(file => !validFile(file))) return toast('Use JPG, PNG, WebP, HEIC, PDF, or DOCX files under 25 MB.', true);
  const button = $('saveNotes');
  button.disabled = true;
  const user = currentSession.user;
  const subject = $('noteSubject').value;
  const typedTitle = $('noteTitle').value.trim();
  const files = [...stagedFiles];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const fileType = fileMimeType(file);
    button.innerHTML = `Uploading ${index + 1} of ${files.length}…`;
    const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin';
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: storageError } = await supabase.storage.from('study-notes').upload(path, file, { contentType: fileType, upsert: false });
    if (storageError) { button.disabled = false; button.innerHTML = 'Upload my notes <span>↑</span>'; return toast(`Upload failed: ${storageError.message}`, true); }
    const title = files.length === 1 && typedTitle ? typedTitle : file.name.replace(/\.[^.]+$/, '');
    const { error: rowError } = await supabase.from('notes').insert({ user_id: user.id, owner_name: displayName(user), title, subject, file_path: path, file_name: file.name, file_type: fileType, file_size: file.size, is_public: true });
    if (rowError) {
      await supabase.storage.from('study-notes').remove([path]);
      button.disabled = false;
      button.innerHTML = 'Upload my notes <span>↑</span>';
      return toast(`Could not save note details: ${rowError.message}`, true);
    }
  }
  closeModal();
  toast(files.length === 1 ? 'Your note has a new home.' : 'Your notes have a new home.');
  openNotes();
}
async function openNotes() {
  if (!requireBackend()) return;
  libraryScope = 'all';
  noteViewMode = 'grid';
  const host = $('notesLibrary');
  if (!host) return;
  clearNotePreviewUrl();
  $('notes')?.classList.remove('reader-open');
  if (!currentSession?.user) {
    noteActionTargets = new Map();
    noteLibraryData = [];
    host.innerHTML = '<div class="notes-signin-state"><div class="notes-state-icon">✎</div><div class="eyebrow section-eyebrow">learnByAnkit STUDY LIBRARY</div><h3>Sign in to view the notes.</h3><p>Log in or create an account to browse, open, and download the notes already uploaded.</p><div class="notes-state-actions"><button class="primary-button" id="notesLogin">Log in <span>→</span></button><button class="outline-button" id="notesSignup">Create account</button></div></div>';
    $('notesLogin').onclick = () => openAuth('login');
    $('notesSignup').onclick = () => openAuth('signup');
    return;
  }
  host.innerHTML = '<div class="notes-loading"><span class="loading-dot"></span> Loading study notes…</div>';
  const { data: notes, error } = await supabase.from('notes').select('id,user_id,owner_name,title,subject,file_path,file_name,file_type,file_size,is_public,created_at').order('created_at', { ascending: false }).limit(100);
  if (error) {
    host.innerHTML = '<div class="notes-error-state"><b>We couldn’t load these notes.</b><p>' + escapeHtml(error.message) + '</p><button class="outline-button" id="retryNotes">Try again</button></div>';
    $('retryNotes').onclick = () => openNotes();
    return;
  }
  noteLibraryData = notes || [];
  noteActionTargets = new Map(noteLibraryData.map(note => [String(note.id), note]));
  const subjects = [...new Set(noteLibraryData.map(note => String(note.subject || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const subjectOptions = '<option value="all">All subjects</option>' + subjects.map(subject => '<option value="' + escapeHtml(subject) + '">' + escapeHtml(subject) + '</option>').join('');
  host.innerHTML =
    (isAdmin() ? '<aside class="master-control"><div class="master-control-copy"><div class="eyebrow">OWNER ONLY · YOUR MASTER CONTROL</div><h3>Master Control</h3><p>Only your learnByAnkit owner login can add or remove notes. Other signed-in accounts can view and download them.</p></div><button class="primary-button" id="masterUploadButton">Upload study notes <span>↑</span></button></aside>' : '') +
    '<div class="notes-library-heading"><div><div class="eyebrow section-eyebrow">learnByAnkit STUDY LIBRARY</div><h3>Study notes, all in one place.</h3><p>Browse the notes already uploaded. Sign in to open PDFs and download files.</p></div>' +  '</div>' +
    '<div class="notes-tools"><label class="notes-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><input id="noteSearch" type="search" placeholder="Search notes by title or subject" autocomplete="off" aria-label="Search notes"></label><label class="notes-filter"><span>Subject</span><select id="noteSubjectFilter">' + subjectOptions + '</select></label><label class="notes-filter"><span>Sort</span><select id="noteSort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select></label><button class="notes-view-toggle" id="noteViewToggle" type="button" aria-label="Switch to list view"><span aria-hidden="true">☷</span> List view</button></div>' +
    '<div class="notes-results"><span id="notesResultCount"></span><span>Available to signed-in learners</span></div>' +
    '<div class="notes-library-list" id="notesList" data-layout="grid"></div>';
  $('masterUploadButton')?.addEventListener('click', openUpload);
  $('noteSearch').addEventListener('input', renderNoteCards);
  $('noteSubjectFilter').addEventListener('change', renderNoteCards);
  $('noteSort').addEventListener('change', renderNoteCards);
  $('noteViewToggle').addEventListener('click', () => {
    noteViewMode = noteViewMode === 'grid' ? 'list' : 'grid';
    $('noteViewToggle').innerHTML = '<span aria-hidden="true">' + (noteViewMode === 'grid' ? '☷' : '▦') + '</span> ' + (noteViewMode === 'grid' ? 'List view' : 'Grid view');
    $('noteViewToggle').setAttribute('aria-label', 'Switch to ' + (noteViewMode === 'grid' ? 'list' : 'grid') + ' view');
    renderNoteCards();
  });
  renderNoteCards();
}
function renderNoteCards() {
  const list = $('notesList');
  if (!list) return;
  const search = String($('noteSearch')?.value || '').trim().toLowerCase();
  const subject = $('noteSubjectFilter')?.value || 'all';
  const sortBy = $('noteSort')?.value || 'newest';
  const filtered = noteLibraryData.filter(note => {
    const matchesSubject = subject === 'all' || note.subject === subject;
    const searchable = [note.title, note.subject, note.file_name].join(' ').toLowerCase();
    return matchesSubject && searchable.includes(search);
  });
  filtered.sort((a, b) => {
    if (sortBy === 'title') return String(a.title || '').localeCompare(String(b.title || ''));
    const first = Date.parse(a.created_at || '') || 0;
    const second = Date.parse(b.created_at || '') || 0;
    return sortBy === 'oldest' ? first - second : second - first;
  });
  $('notesResultCount').textContent = filtered.length + (filtered.length === 1 ? ' note' : ' notes');
  list.dataset.layout = noteViewMode;
  if (!filtered.length) {
    const hasNotes = noteLibraryData.length > 0;
    list.innerHTML = '<div class="notes-empty-state"><span>✳</span><b>' + (hasNotes ? 'No notes match those filters.' : 'No study notes have been added yet.') + '</b><small>' + (hasNotes ? 'Try another search or subject.' : (isAdmin() ? 'Upload the first PDF, photo, or Word document to the library.' : 'Check back after the learnByAnkit owner adds study notes.')) + '</small>' + (!hasNotes && isAdmin() ? '<button class="primary-button" id="emptyUpload">Upload study notes <span>↑</span></button>' : '') + '</div>';
    $('emptyUpload')?.addEventListener('click', openUpload);
    return;
  }
  list.innerHTML = filtered.map(note => {
    const fileName = note.file_name || note.title || 'study-note';
    const isPdf = note.file_type === 'application/pdf' || /\.pdf$/i.test(fileName);
    const isDocx = isDocxNote(note);
    const isImage = String(note.file_type || '').startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(fileName);
    const viewButton = isPdf || isDocx || isImage
      ? '<button class="note-icon-action" type="button" data-view-note="' + escapeHtml(note.id) + '" title="View on site" aria-label="View ' + escapeHtml(note.title) + ' on site"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.6"></circle></svg></button>'
      : '';
    const fileActions = '<div class="note-file-actions">' + viewButton + '<button class="note-icon-action" type="button" data-download-note="' + escapeHtml(note.id) + '" title="Download note" aria-label="Download ' + escapeHtml(note.title) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v4h14v-4"></path></svg></button></div>';
    const controls = isAdmin()
      ? '<div class="note-owner-actions"><button class="note-action delete-action" type="button" data-delete="' + escapeHtml(note.id) + '" title="Delete this note">Delete</button></div>'
      : '';
    const fileBadge = isPdf ? 'PDF' : isDocx ? 'DOCX' : '✎';
    return '<article class="saved-note"><div class="saved-note-icon">' + fileBadge + '</div><div class="saved-note-info"><b>' + escapeHtml(note.title || fileName) + '</b><small>' + escapeHtml(note.subject || 'Other') + ' · ' + (note.is_public ? 'Available to learners' : 'Admin only') + ' · ' + formatSize(note.file_size) + '</small></div><div class="saved-note-actions">' + fileActions + controls + '</div></article>';
  }).join('');
  list.querySelectorAll('[data-view-note]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try { await openNotePreview(button.dataset.viewNote); }
    finally { if (button.isConnected) button.disabled = false; }
  }));
  list.querySelectorAll('[data-download-note]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try { await downloadNote(button.dataset.downloadNote); }
    finally { if (button.isConnected) button.disabled = false; }
  }));
  list.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => deleteNote(button.dataset.delete)));
}
async function openNotePreview(noteId) {
  if (!currentSession?.user) return openAuth('login');
  const note = noteActionTargets.get(String(noteId));
  const host = $('notesLibrary');
  if (!note || !host) return toast('Couldn’t find this note. Reopen your notes and try again.', true);
  const { data, error } = await supabase.storage.from('study-notes').download(note.file_path);
  if (error || !data) return toast('Couldn’t open this note: ' + (error?.message || 'The file could not be loaded.'), true);

  const fileName = note.file_name || note.title || '';
  const isPdf = note.file_type === 'application/pdf' || /\.pdf$/i.test(fileName);
  const isDocx = isDocxNote(note);
  const isImage = String(note.file_type || '').startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(fileName);
  if (!isPdf && !isDocx && !isImage) return toast('This file type can be downloaded but not previewed here.', true);

  clearNotePreviewUrl();
  const previewUrl = isDocx ? '' : URL.createObjectURL(data);
  if (previewUrl) activeNotePreviewUrl = previewUrl;
  const title = escapeHtml(note.title || fileName || 'Study note');
  const url = escapeHtml(previewUrl);
  const typeLabel = isPdf ? 'PDF NOTE' : isDocx ? 'WORD NOTE' : 'IMAGE NOTE';
  let viewer;
  if (isPdf) {
    viewer = '<iframe class="note-pdf-viewer" src="' + url + '#toolbar=1&navpanes=0" title="PDF preview: ' + title + '" referrerpolicy="no-referrer"></iframe><p class="pdf-viewer-hint">Use the PDF controls to zoom or move between pages. If the preview doesn’t appear, use Download.</p>';
  } else if (isDocx) {
    viewer = '<div class="note-docx-viewer"><div class="docx-reader-status" id="docxReaderStatus" role="status">Preparing the Word document…</div><article class="docx-reader-content" id="docxReaderContent" hidden></article><p class="docx-reader-hint" id="docxReaderHint">This reading view keeps the text and common formatting. Page layout may differ slightly from the original Word file.</p></div>';
  } else {
    viewer = '<div class="note-image-preview"><img src="' + url + '" alt="Preview of ' + title + '"></div>';
  }

  $('notes').classList.add('reader-open');
  host.innerHTML = '<div class="note-reader-page"><div class="note-view-toolbar"><button class="note-back-button" id="backToNotes">← Back to notes</button><button class="note-download-link" id="readerDownload" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v4h14v-4"></path></svg> Download original</button></div><div class="note-reader-heading"><div class="eyebrow section-eyebrow">' + typeLabel + ' · ' + escapeHtml(note.subject || 'Study notes') + '</div><h2>' + title + '</h2><p>' + escapeHtml(fileName) + '</p></div>' + viewer + '</div>';
  $('backToNotes').onclick = () => openNotes();
  $('readerDownload').onclick = () => downloadNote(noteId);

  if (isDocx) {
    const status = $('docxReaderStatus');
    const content = $('docxReaderContent');
    try {
      const mammoth = await loadMammoth();
      const arrayBuffer = await data.arrayBuffer();
      const converted = await mammoth.convertToHtml({ arrayBuffer }, {
        convertImage: mammoth.images.imgElement(image => image.read('base64').then(imageBuffer => ({
          src: 'data:' + image.contentType + ';base64,' + imageBuffer
        })))
      });
      const cleanHtml = sanitizeDocxHtml(converted.value);
      if (cleanHtml.trim()) {
        content.innerHTML = cleanHtml;
        content.hidden = false;
        status.hidden = true;
      } else {
        status.textContent = 'This Word file has no readable text. You can still download the original.';
      }
      if (converted.messages?.some(message => message.type === 'warning')) {
        $('docxReaderHint').textContent = 'Some Word formatting could not be shown in the reading view. Download the original to see its full layout.';
      }
    } catch (error) {
      status.textContent = 'This Word file could not be displayed here. Use Download original to open it in Word or another document reader.';
    }
  }
}
async function downloadNote(noteId) {
  if (!currentSession?.user) return openAuth('login');
  const note = noteActionTargets.get(String(noteId));
  if (!note) return toast('Couldn’t find this note. Reopen your notes and try again.', true);
  const { data, error } = await supabase.storage.from('study-notes').download(note.file_path);
  if (error || !data) return toast('Couldn’t download this note: ' + (error?.message || 'The file could not be loaded.'), true);
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = note.file_name || 'study-note';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function deleteNote(id) {
  if (!isAdmin()) return toast('Only the learnByAnkit owner can remove study notes.', true);
  const { data: note, error: readError } = await supabase.from('notes').select('file_path').eq('id', id).single();
  if (readError) return toast(readError.message, true);
  const { error: fileError } = await supabase.storage.from('study-notes').remove([note.file_path]);
  if (fileError) return toast(`Couldn’t delete file: ${fileError.message}`, true);
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) return toast(`Couldn’t delete note: ${error.message}`, true);
  toast('Note deleted.');
  openNotes();
}

const courseData = {
  web: { title: 'Web development', intro: 'Build a clear foundation for your first website. Work through these short lessons at your own pace.', lessons: [
    { title: 'A webpage starts with HTML', text: 'HTML gives a page its structure. Headings, paragraphs, images, and links are all described with HTML elements. A browser reads those elements and turns them into the page you see.', code: '<h1>My first page</h1>\n<p>I made something today.</p>' },
    { title: 'Give it a style with CSS', text: 'CSS controls the look and layout of HTML. A rule selects an element, then applies one or more style declarations. Try changing the color or spacing to see what changes.', code: 'h1 {\n  color: seagreen;\n  margin-bottom: 1rem;\n}' },
    { title: 'Add a little interaction', text: 'JavaScript can respond when someone uses a page. This example finds a button and changes its label when clicked. Small interactions are a great first project.', code: "document.querySelector('button')\n  .addEventListener('click', (event) => {\n    event.target.textContent = 'You did it!';\n  });" }
  ]},
  math: { title: 'Maths, made clearer', intro: 'Build confidence in everyday number skills, one worked example at a time.', lessons: [
    { title: 'Fractions with a shared denominator', text: 'To add fractions, first give them the same denominator. For example, one half is the same as two quarters. Then add the numerators: 2/4 + 1/4 = 3/4.', code: '1/2 + 1/4\n= 2/4 + 1/4\n= 3/4' },
    { title: 'Order of operations', text: 'When an expression has several operations, use parentheses first, then multiplication and division, then addition and subtraction. This keeps everyone’s answer consistent.', code: '3 + 2 × 4\n= 3 + 8\n= 11' },
    { title: 'A first look at algebra', text: 'A letter can stand for a number we do not know yet. Solve  x + 5 = 12  by undoing the addition: subtract 5 from both sides, so x = 7.', code: 'x + 5 = 12\nx = 12 − 5\nx = 7' }
  ]},
  science: { title: 'Science all around', intro: 'Notice the patterns and processes that help explain the world around us.', lessons: [
    { title: 'How plants make food', text: 'In photosynthesis, plants use light energy to turn water and carbon dioxide into sugar. Oxygen is released along the way. The process mainly happens in leaves.', code: 'carbon dioxide + water\n  — light energy →\n sugar + oxygen' },
    { title: 'The journey of a water drop', text: 'The water cycle moves water through the environment. Sunlight warms water and causes evaporation. The vapor cools into clouds, then returns to Earth as precipitation.', code: 'evaporation → condensation\n       → precipitation\n       → collection' },
    { title: 'Forces can change motion', text: 'A force is a push or pull. An unbalanced force can change an object’s speed or direction. If the forces balance, its motion does not change.', code: 'balanced forces → no change\nunbalanced force → acceleration' }
  ]}
};
const courseQuizzes = {
  web: [
    { question: 'Which language gives a webpage its structure?', options: ['HTML', 'CSS', 'SQL'], answer: 0, explanation: 'HTML provides the structure and meaning of page content.' },
    { question: 'Which language controls a page’s visual style?', options: ['Java', 'CSS', 'JSON'], answer: 1, explanation: 'CSS controls color, spacing, layout, and other visual styles.' },
    { question: 'What does addEventListener help JavaScript do?', options: ['Listen for an event', 'Create a database', 'Compress an image'], answer: 0, explanation: 'It runs code in response to events such as clicks.' }
  ],
  math: [
    { question: 'What is 1/2 + 1/4?', options: ['2/6', '3/4', '1/6'], answer: 1, explanation: 'Convert one half to two quarters, then add: 2/4 + 1/4 = 3/4.' },
    { question: 'What is 3 + 2 × 4?', options: ['20', '11', '14'], answer: 1, explanation: 'Multiply first: 2 × 4 = 8, then add 3.' },
    { question: 'If x + 5 = 12, what is x?', options: ['7', '17', '6'], answer: 0, explanation: 'Subtract 5 from both sides: x = 12 − 5 = 7.' }
  ],
  science: [
    { question: 'What do plants use as an energy source in photosynthesis?', options: ['Sound', 'Light', 'Wind'], answer: 1, explanation: 'Plants use light energy to make sugar from water and carbon dioxide.' },
    { question: 'What happens when water vapor cools in the water cycle?', options: ['Condensation', 'Combustion', 'Digestion'], answer: 0, explanation: 'Cooling vapor condenses into tiny droplets that form clouds.' },
    { question: 'What can an unbalanced force change?', options: ['An object’s motion', 'An object’s name', 'The amount of matter'], answer: 0, explanation: 'An unbalanced force can change an object’s speed or direction.' }
  ]
};
function courseProgress() {
  try { return JSON.parse(localStorage.getItem('learnnest-course-progress') || '{}'); }
  catch { return {}; }
}
function quizAttempts() {
  try {
    const saved = JSON.parse(localStorage.getItem('learnbyankit-quiz-attempts') || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}
function renderDashboard() {
  const host = $('dashboardContent');
  if (!host) return;
  const progress = courseProgress();
  const attempts = quizAttempts().sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  const totals = Object.values(courseData).reduce((sum, course) => sum + course.lessons.length, 0);
  const completed = Object.entries(courseData).reduce((sum, [id, course]) => sum + Math.min((progress[id] || []).length, course.lessons.length), 0);
  const started = Object.keys(courseData).filter(id => (progress[id] || []).length > 0).length;
  const average = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score / attempt.total, 0) / attempts.length * 100) : 0;
  const courseCards = Object.entries(courseData).map(([id, course]) => {
    const done = Math.min((progress[id] || []).length, course.lessons.length);
    const percent = Math.round(done / course.lessons.length * 100);
    const next = course.lessons.findIndex((_, index) => !(progress[id] || []).includes(index));
    return `<article class="dashboard-course"><div class="dashboard-course-top"><span class="dashboard-course-icon">${id === 'web' ? '&lt;/&gt;' : id === 'math' ? 'π' : '✳'}</span><span>${done}/${course.lessons.length} lessons</span></div><h3>${escapeHtml(course.title)}</h3><p>${done === course.lessons.length ? 'Path complete — great work.' : done ? 'Pick up where you left off.' : 'Your next learning path is ready.'}</p><div class="progress-track" role="progressbar" aria-label="${escapeHtml(course.title)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div><div class="dashboard-course-actions"><button class="primary-button" type="button" data-dashboard-course="${id}" data-lesson-index="${next < 0 ? 0 : next}">${done ? 'Continue learning' : 'Start learning'} <span>→</span></button><button class="quiet-link" type="button" data-dashboard-quiz="${id}">Take quiz</button></div></article>`;
  }).join('');
  const latest = attempts[0];
  const recentAttempts = attempts.slice(0, 5).map(attempt => `<li><span><b>${escapeHtml(courseData[attempt.courseId]?.title || 'Course')}</b><small>${new Date(attempt.completedAt).toLocaleDateString()}</small></span><strong>${attempt.score}/${attempt.total}</strong></li>`).join('');
  host.innerHTML = `<div class="dashboard-stats"><article><span>Courses started</span><strong>${started}</strong></article><article><span>Lessons completed</span><strong>${completed}<small> / ${totals}</small></strong></article><article><span>Quiz average</span><strong>${attempts.length ? average + '%' : '—'}</strong></article></div><div class="dashboard-subheading"><div><h3>Your learning paths</h3><p>Progress is saved in this browser.</p></div>${latest ? `<p class="latest-quiz">Latest quiz: <b>${escapeHtml(courseData[latest.courseId]?.title || 'Course')}</b> · ${latest.score}/${latest.total}</p>` : ''}</div><div class="dashboard-course-grid">${courseCards}</div><section class="quiz-history"><div><h3>Recent quiz attempts</h3><p>Review how your practice is going.</p></div>${attempts.length ? `<ul>${recentAttempts}</ul>` : '<p class="quiz-history-empty">Your quiz results will appear here after your first practice round.</p>'}</section>`;
  host.querySelectorAll('[data-dashboard-course]').forEach(button => button.addEventListener('click', () => showLesson(button.dataset.dashboardCourse, Number(button.dataset.lessonIndex))));
  host.querySelectorAll('[data-dashboard-quiz]').forEach(button => button.addEventListener('click', () => showQuiz(button.dataset.dashboardQuiz)));
}
async function renderCoursePage(courseId) {
  const host = $('courseDetailContent');
  const course = courseData[courseId];
  if (!host || !course) return;
  host.innerHTML = '<div class="notes-loading"><span class="loading-dot"></span> Loading this learning path…</div>';
  let lectures = [];
  let loadError = '';
  if (supabase) {
    const { data, error } = await supabase.from('course_lectures').select('id,course_id,title,lecture_type,file_path,file_name,file_size,created_at').eq('course_id', courseId).order('created_at', { ascending: true });
    if (error) loadError = error.message;
    else lectures = data || [];
  } else {
    loadError = 'Lecture storage is not connected yet.';
  }
  const progress = courseProgress()[courseId] || [];
  const lessons = course.lessons.map((lesson, index) => `<button class="course-lesson" data-course-page-lesson="${courseId}" data-lesson-index="${index}"><span class="lesson-number">${progress.includes(index) ? '✓' : String(index + 1).padStart(2, '0')}</span><span><b>${escapeHtml(lesson.title)}</b><small>${progress.includes(index) ? 'Completed' : 'Short lesson'}</small></span><i>→</i></button>`).join('');
  const materials = lectures.map(lecture => {
    const { data: { publicUrl } } = supabase.storage.from('course-materials').getPublicUrl(lecture.file_path);
    const remove = isAdmin() ? `<button class="quiet-link" type="button" data-delete-lecture="${escapeHtml(lecture.id)}">Remove</button>` : '';
    return lecture.lecture_type === 'video'
      ? `<article class="lecture-card"><video controls preload="metadata" src="${escapeHtml(publicUrl)}" aria-label="${escapeHtml(lecture.title)}"></video><div><span class="lecture-kind">VIDEO LECTURE · ${formatSize(lecture.file_size)}</span><h4>${escapeHtml(lecture.title)}</h4><div class="lecture-actions"><a class="quiet-link" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">Open video</a>${remove}</div></div></article>`
      : `<article class="lecture-card lecture-pdf"><span class="lecture-file-icon">PDF</span><div><span class="lecture-kind">PDF LECTURE · ${formatSize(lecture.file_size)}</span><h4>${escapeHtml(lecture.title)}</h4><div class="lecture-actions"><a class="quiet-link" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">Open PDF →</a>${remove}</div></div></article>`;
  }).join('');
  const ownerPanel = isAdmin() ? `<form class="lecture-upload-panel" id="courseLectureForm"><div class="lecture-upload-intro"><div><div class="eyebrow section-eyebrow">INSTRUCTOR TOOLS</div><h3>Add a lecture</h3><p>Upload a video or PDF for this course. Files up to 50 MB are supported.</p></div><span>↑</span></div><label class="form-field"><span>Lecture title</span><input id="lectureTitle" name="title" maxlength="140" placeholder="e.g. Lesson 1: HTML basics" required></label><div class="lecture-upload-fields"><label class="form-field"><span>Lecture format</span><select id="lectureType" name="type"><option value="video">Video (MP4 or WebM)</option><option value="pdf">PDF document</option></select></label><label class="form-field"><span>Choose file</span><input id="lectureFile" name="file" type="file" accept="video/mp4,video/webm,application/pdf,.mp4,.webm,.pdf" required></label></div><button class="primary-button" id="uploadLectureButton" type="submit">Upload lecture <span>↑</span></button><p class="form-note" id="lectureUploadStatus" aria-live="polite">Uploads are resumable and restricted to the site owner.</p></form>` : '';
  const backendMessage = loadError ? `<div class="lecture-notice">Lecture files are not available right now. ${isAdmin() ? 'The lecture storage setup must be enabled in the connected backend before uploads can be saved.' : 'Please check back later.'}</div>` : '';
  host.innerHTML = `<div class="course-detail-top"><a class="back-to-courses" href="#courses">← All courses</a><span class="course-detail-tag">LEARNING PATH · BEGINNER</span></div><div class="course-detail-hero"><div><div class="eyebrow section-eyebrow">YOUR NEXT LEARNING PATH</div><h1>${escapeHtml(course.title)}</h1><p>${escapeHtml(course.intro)}</p><button class="outline-button" id="coursePageQuiz">Take a quick quiz <span>→</span></button></div><div class="course-detail-art">${courseId === 'web' ? '&lt;/&gt;' : courseId === 'math' ? 'π' : '✿'}</div></div><div class="course-detail-columns"><section class="course-detail-lessons"><div class="course-detail-heading"><div><div class="eyebrow section-eyebrow">COURSE OUTLINE</div><h2>Your lessons</h2><p>${course.lessons.length} short lessons · save your progress as you go</p></div></div><div class="course-lesson-list">${lessons}</div></section><section class="course-detail-materials"><div class="course-detail-heading"><div><div class="eyebrow section-eyebrow">WATCH & READ</div><h2>Lecture library</h2><p>Videos and PDFs for this learning path.</p></div></div>${ownerPanel}${backendMessage}${lectures.length ? `<div class="lecture-list">${materials}</div>` : `<div class="lecture-empty"><span>✳</span><b>${loadError ? 'Lecture library is getting ready.' : 'No lectures uploaded yet.'}</b><small>${isAdmin() ? 'Use the upload form to add a video or PDF to this course.' : 'The course owner will add lecture videos and PDFs here.'}</small></div>`}</section></div>`;
  host.querySelectorAll('[data-course-page-lesson]').forEach(button => button.addEventListener('click', () => showLesson(button.dataset.coursePageLesson, Number(button.dataset.lessonIndex))));
  $('coursePageQuiz')?.addEventListener('click', () => showQuiz(courseId));
  $('courseLectureForm')?.addEventListener('submit', event => uploadCourseLecture(event, courseId));
  host.querySelectorAll('[data-delete-lecture]').forEach(button => button.addEventListener('click', () => deleteCourseLecture(button.dataset.deleteLecture, courseId)));
}
function lectureMimeType(file) {
  if (file.type === 'application/pdf' || file.type === 'video/mp4' || file.type === 'video/webm') return file.type;
  const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  return extension === 'pdf' ? 'application/pdf' : extension === 'mp4' ? 'video/mp4' : extension === 'webm' ? 'video/webm' : '';
}
async function resumableLectureUpload(file, path, contentType, title, courseId, onProgress) {
  const { Upload } = await import('https://esm.sh/tus-js-client@4.3.1');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Please sign in again before uploading.');
  const projectRef = new URL(config.supabaseUrl).hostname.split('.')[0];
  return new Promise((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${session.access_token}`, apikey: config.supabasePublishableKey, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: { bucketName: 'course-materials', objectName: path, contentType, cacheControl: '3600', metadata: JSON.stringify({ title, courseId }) },
      onProgress,
      onError: reject,
      onSuccess: resolve,
    });
    upload.start();
  });
}
async function uploadCourseLecture(event, courseId) {
  event.preventDefault();
  if (!isAdmin() || !currentSession?.user) return toast('Only the signed-in site owner can upload course lectures.', true);
  const file = $('lectureFile')?.files?.[0];
  const title = $('lectureTitle')?.value.trim();
  const type = $('lectureType')?.value;
  const mime = file && lectureMimeType(file);
  const expectedMime = type === 'pdf' ? 'application/pdf' : ['video/mp4', 'video/webm'].includes(mime) ? mime : '';
  if (!file || !title) return toast('Add a title and choose a lecture file.', true);
  if (!expectedMime || (type === 'pdf' && mime !== 'application/pdf')) return toast('Choose a PDF or an MP4/WebM video that matches the lecture format.', true);
  if (file.size > 50 * 1024 * 1024) return toast('Lecture files must be 50 MB or smaller.', true);
  const button = $('uploadLectureButton');
  const status = $('lectureUploadStatus');
  button.disabled = true;
  const extension = file.name.split('.').pop().toLowerCase();
  const path = `${currentSession.user.id}/${courseId}/${crypto.randomUUID()}.${extension}`;
  try {
    await resumableLectureUpload(file, path, expectedMime, title, courseId, (sent, total) => {
      const percent = Math.round(sent / total * 100);
      button.textContent = `Uploading ${percent}%…`;
      status.textContent = `${formatSize(sent)} of ${formatSize(total)} uploaded`;
    });
    const { error } = await supabase.from('course_lectures').insert({ course_id: courseId, title, lecture_type: type, file_path: path, file_name: file.name, file_size: file.size, content_type: expectedMime, created_by: currentSession.user.id });
    if (error) {
      await supabase.storage.from('course-materials').remove([path]);
      throw error;
    }
    toast('Lecture uploaded. It is now available on this course page.');
    await renderCoursePage(courseId);
  } catch (error) {
    button.disabled = false;
    button.innerHTML = 'Upload lecture <span>↑</span>';
    status.textContent = 'Uploads are resumable and restricted to the site owner.';
    toast(`Lecture upload failed: ${error.message || 'Please try again.'}`, true);
  }
}
async function deleteCourseLecture(id, courseId) {
  if (!isAdmin()) return toast('Only the site owner can remove course lectures.', true);
  const { data: lecture, error: readError } = await supabase.from('course_lectures').select('file_path').eq('id', id).single();
  if (readError) return toast(readError.message, true);
  const { error: fileError } = await supabase.storage.from('course-materials').remove([lecture.file_path]);
  if (fileError) return toast(`Could not remove the lecture file: ${fileError.message}`, true);
  const { error } = await supabase.from('course_lectures').delete().eq('id', id);
  if (error) return toast(error.message, true);
  toast('Lecture removed.');
  await renderCoursePage(courseId);
}
function showCourse(courseId) {
  const course = courseData[courseId];
  if (!course) return;
  const progress = courseProgress()[courseId] || [];
  const lessonRows = course.lessons.map((lesson, index) => `<button class="course-lesson" data-course-lesson="${courseId}" data-lesson-index="${index}"><span class="lesson-number">${progress.includes(index) ? '✓' : String(index + 1).padStart(2,'0')}</span><span><b>${escapeHtml(lesson.title)}</b><small>${progress.includes(index) ? 'Completed' : 'Short lesson'}</small></span><i>→</i></button>`).join('');
  openModal(`<div class="modal-kicker">LEARNING PATH</div><h2 id="modalTitle">${course.title}</h2><p class="modal-copy">${course.intro}</p><div class="course-lesson-list">${lessonRows}</div><button class="outline-button course-quiz-button" id="courseQuiz">Take a quick quiz <span>→</span></button><p class="form-note">Your lesson progress is saved in this browser.</p>`);
  modalBody.querySelectorAll('[data-course-lesson]').forEach(button => button.addEventListener('click', () => showLesson(button.dataset.courseLesson, Number(button.dataset.lessonIndex))));
  $('courseQuiz').onclick = () => showQuiz(courseId);
}
function showLesson(courseId, index) {
  const course = courseData[courseId];
  const lesson = course?.lessons[index];
  if (!lesson) return;
  const escapedCode = escapeHtml(lesson.code);
  const progress = courseProgress();
  const done = (progress[courseId] || []).includes(index);
  const returnToCoursePage = document.body.dataset.page === `course-${courseId}`;
  openModal(`<button class="back-to-course" id="backToCourse">← ${escapeHtml(course.title)}</button><div class="modal-kicker">LESSON ${index + 1} OF ${course.lessons.length}</div><h2 id="modalTitle">${escapeHtml(lesson.title)}</h2><p class="modal-copy lesson-copy">${escapeHtml(lesson.text)}</p><pre class="lesson-code"><code>${escapedCode}</code></pre><button class="primary-button modal-submit" id="completeLesson">${done ? 'Completed ✓' : 'Mark lesson complete'} <span>→</span></button>`);
  $('backToCourse').onclick = () => returnToCoursePage ? closeModal() : showCourse(courseId);
  $('completeLesson').onclick = () => {
    const current = courseProgress();
    current[courseId] = [...new Set([...(current[courseId] || []), index])];
    localStorage.setItem('learnnest-course-progress', JSON.stringify(current));
    toast('Lesson progress saved. Nice work!');
    showCourse(courseId);
  };
}
function showQuiz(courseId) {
  const course = courseData[courseId];
  const questions = courseQuizzes[courseId];
  if (!course || !questions) return;
  const questionMarkup = questions.map((item, index) => `<fieldset class="quiz-question"><legend><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(item.question)}</legend><div class="quiz-options">${item.options.map((option, optionIndex) => `<label><input type="radio" name="answer-${index}" value="${optionIndex}"><span>${escapeHtml(option)}</span></label>`).join('')}</div></fieldset>`).join('');
  openModal(`<button class="back-to-course" id="backToQuizCourse">← ${escapeHtml(course.title)}</button><div class="modal-kicker">QUICK PRACTICE · ${questions.length} QUESTIONS</div><h2 id="modalTitle">Check what you’ve learned</h2><p class="modal-copy">Choose one answer for each question. You’ll see your score and explanations at the end.</p><form id="quizForm">${questionMarkup}<p class="quiz-feedback" id="quizFeedback" role="alert" hidden>Answer each question before submitting.</p><button class="primary-button modal-submit" type="submit">Submit quiz <span>→</span></button></form>`);
  $('backToQuizCourse').onclick = () => showCourse(courseId);
  $('quizForm').addEventListener('submit', event => {
    event.preventDefault();
    const selected = questions.map((_, index) => modalBody.querySelector(`input[name="answer-${index}"]:checked`));
    if (selected.some(answer => !answer)) {
      $('quizFeedback').hidden = false;
      return;
    }
    const score = selected.reduce((sum, answer, index) => sum + (Number(answer.value) === questions[index].answer ? 1 : 0), 0);
    const attempt = { courseId, score, total: questions.length, completedAt: new Date().toISOString() };
    const attempts = quizAttempts();
    attempts.push(attempt);
    localStorage.setItem('learnbyankit-quiz-attempts', JSON.stringify(attempts.slice(-100)));
    showQuizResult(courseId, questions, selected, score);
  });
}
function showQuizResult(courseId, questions, selected, score) {
  const course = courseData[courseId];
  const percent = Math.round(score / questions.length * 100);
  const review = questions.map((item, index) => {
    const correct = Number(selected[index].value) === item.answer;
    return `<li class="${correct ? 'answer-correct' : 'answer-incorrect'}"><b>${correct ? 'Correct' : 'Review'} · ${escapeHtml(item.question)}</b><span>${escapeHtml(item.explanation)}</span></li>`;
  }).join('');
  openModal(`<div class="modal-kicker">QUIZ COMPLETE</div><h2 id="modalTitle">${score}/${questions.length} correct</h2><p class="modal-copy">${percent}% · ${percent === 100 ? 'Excellent work!' : percent >= 60 ? 'Nice progress — keep going.' : 'A little review will help this stick.'}</p><ol class="quiz-review">${review}</ol><div class="quiz-result-actions"><button class="primary-button" id="retryQuiz">Try again</button><button class="outline-button" id="quizBackToCourse">Back to course</button></div>`);
  $('retryQuiz').onclick = () => showQuiz(courseId);
  $('quizBackToCourse').onclick = () => showCourse(courseId);
  if (document.body.dataset.page === 'dashboard') renderDashboard();
}
function filterCourses() {
  const search = $('courseSearch');
  const subject = $('courseSubject');
  const level = $('courseLevel');
  if (!search || !subject || !level) return;
  const query = search.value.trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll('.course-card[data-course-category]').forEach(card => {
    const matches = card.textContent.toLowerCase().includes(query) &&
      (subject.value === 'all' || card.dataset.courseCategory === subject.value) &&
      (level.value === 'all' || card.dataset.courseLevel === level.value);
    card.hidden = !matches;
    if (matches) visible += 1;
  });
  $('courseResults').textContent = `${visible} ${visible === 1 ? 'course' : 'courses'} found`;
  $('courseEmpty').hidden = visible > 0;
}
['courseSearch', 'courseSubject', 'courseLevel'].forEach(id => {
  $(id)?.addEventListener(id === 'courseSearch' ? 'input' : 'change', filterCourses);
});
filterCourses();
const pageTitles = {
  home: 'learnByAnkit — Learn something new, every day',
  courses: 'Courses · learnByAnkit',
  'course-web': 'Web development · learnByAnkit',
  'course-math': 'Maths, made clearer · learnByAnkit',
  'course-science': 'Science all around · learnByAnkit',
  dashboard: 'My learning · learnByAnkit',
  how: 'How learnByAnkit works',
  notes: 'Study notes · learnByAnkit'
};
function routeFromHash() {
  const route = window.location.hash.slice(1).split(/[?&]/)[0];
  return Object.prototype.hasOwnProperty.call(pageTitles, route) ? route : (document.body.dataset.defaultPage || 'home');
}
function navigatePage(page, options = {}) {
  if (!Object.prototype.hasOwnProperty.call(pageTitles, page)) page = 'home';
  if (page === 'dashboard' && !currentSession?.user) {
    dashboardAccessPending = true;
    if (document.body.dataset.page !== 'home') navigatePage('home', { updateHistory: true, scroll: options.scroll });
    else if (options.updateHistory === false && window.location.hash === '#dashboard') window.history.replaceState({ learnNestPage: 'home' }, '', '#home');
    openAuth('login', 'dashboard');
    return;
  }
  if (options.scope) libraryScope = options.scope;
  document.body.dataset.page = page;
  document.querySelectorAll('main > [data-page-view]').forEach(section => {
    const visible = section.dataset.pageView === page || (section.dataset.pageView === 'course-detail' && page.startsWith('course-'));
    section.classList.toggle('page-view-hidden', !visible);
    section.setAttribute('aria-hidden', String(!visible));
    if (visible) {
      section.classList.remove('page-view-enter');
      void section.offsetWidth;
      section.classList.add('page-view-enter');
    }
  });
  document.querySelectorAll('[data-page-link]').forEach(link => {
    const active = link.dataset.pageLink === page || (link.dataset.pageLink === 'courses' && page.startsWith('course-'));
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = pageTitles[page];
  $('mainNav').classList.remove('open');
  $('menuToggle').setAttribute('aria-expanded', 'false');
  $('menuToggle').setAttribute('aria-label', 'Open navigation');
  if (options.updateHistory !== false && window.location.hash !== '#' + page) {
    window.history.pushState({ learnNestPage: page }, '', '#' + page);
  }
  if (page !== 'notes') clearNotePreviewUrl();
  if (options.scroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });
  if (page === 'notes') openNotes(options.scope || libraryScope);
  if (page === 'dashboard') renderDashboard();
  if (page.startsWith('course-')) renderCoursePage(page.slice('course-'.length));
}
document.querySelectorAll('[data-course-open]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  navigatePage(`course-${link.dataset.courseOpen}`);
}));
document.addEventListener('click', event => {
  if (event.defaultPrevented) return;
  const link = event.target.closest('a[href^="#"]');
  if (!link || link.hasAttribute('data-course-open')) return;
  const route = link.getAttribute('href').slice(1);
  if (!Object.prototype.hasOwnProperty.call(pageTitles, route)) return;
  event.preventDefault();
  navigatePage(route);
});
window.addEventListener('popstate', () => navigatePage(routeFromHash(), { updateHistory: false, scroll: false }));

$('modalClose').addEventListener('click', closeModal);
backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
$('signupButton').addEventListener('click', () => currentSession?.user ? window.location.assign('notes.html') : openAuth('signup'));
$('ctaSignup')?.addEventListener('click', () => openAuth('signup'));
$('browseNotes').addEventListener('click', () => { if (document.body.dataset.defaultPage === 'notes') $('notesLibrary').scrollIntoView({ behavior: 'smooth' }); else window.location.href = 'notes.html'; });
$('footerLogin').addEventListener('click', event => { event.preventDefault(); navigatePage('notes', { scope: 'mine' }); if (!currentSession?.user) openAuth('login'); });
$('menuToggle').addEventListener('click', () => {
  const isOpen = $('mainNav').classList.toggle('open');
  $('menuToggle').setAttribute('aria-expanded', String(isOpen));
  $('menuToggle').setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
});

if (supabase) {
  let recoveryPromptShown = false;
  const showRecoveryPrompt = () => {
    if (recoveryPromptShown) return;
    recoveryPromptShown = true;
    setTimeout(() => openAuth('update-password'), 0);
  };
  supabase.auth.onAuthStateChange((event, nextSession) => {
    syncHeader(nextSession);
    if (!nextSession?.user && document.body.dataset.page === 'dashboard') navigatePage('home');
    if (document.body.dataset.page === 'notes') setTimeout(() => openNotes(libraryScope), 0);
    if (document.body.dataset.page?.startsWith('course-')) setTimeout(() => renderCoursePage(document.body.dataset.page.slice('course-'.length)), 0);
    if (event === 'PASSWORD_RECOVERY') showRecoveryPrompt();
  });
  const { data: { session } } = await supabase.auth.getSession();
  syncHeader(session);
  if (window.location.hash.includes('type=recovery')) showRecoveryPrompt();
} else {
  syncHeader(null);
}
navigatePage(routeFromHash(), { updateHistory: false, scroll: false });

