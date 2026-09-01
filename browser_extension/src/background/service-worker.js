// Background Service Worker for LinkCrypta Extension
// Real Firebase Auth + Firestore Sync

const LINKCRYPTA_CONFIG = {
  FIREBASE_API_KEY: 'AIzaSyBTNuUpu41PKYBsbPTUGGKzHVhPNw9-Pmc',
  FIREBASE_PROJECT_ID: 'linkcrypta-61258',
  FIRESTORE_BASE: 'https://firestore.googleapis.com/v1/projects/linkcrypta-61258/databases/(default)/documents',
  AUTH_BASE: 'https://identitytoolkit.googleapis.com/v1',
  TOKEN_URL: 'https://securetoken.googleapis.com/v1/token',
  EXTENSION: {
    AUTO_LOCK_TIMEOUT: 15 * 60 * 1000,
    SYNC_INTERVAL: 60 * 1000
  },
  AUTOFILL: { CONFIDENCE_THRESHOLD: 0.7, MAX_SUGGESTIONS: 5 },
  STORAGE_KEYS: {
    SYNC_TIMESTAMP: 'lastSyncTime',
    USER_DATA: 'userData',
    AUTH_STATE: 'authState'
  }
};

class BackgroundService {
  constructor() {
    this.isInitialized = false;
    this.initPromise = null;
    this.autoLockTimer = null;
    this.syncInterval = null;
    this.currentUser = null;
    this.isAuthenticated = false;
    this.idToken = null;
    this.refreshToken = null;
    this.tokenExpiry = 0;
  }

  async initialize() {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      console.log('🔧 Initializing background service...');
      await this.loadAuthState();
      this.setupContextMenus();
      this.setupMessageListeners();
      this.setupAutoLock();
      this.setupPeriodicSync();
      this.setupCommandListeners();
      this.isInitialized = true;
      console.log('✅ Background service initialized');
    } catch (error) {
      console.error('❌ Init failed:', error);
    }
  }

  // ─── FIREBASE AUTH ───────────────────────────────────────────────

  async authenticateUser() {
    try {
      console.log('🔐 Starting authentication...');

      // Step 1: Get Google OAuth token via chrome.identity
      // This uses the Google account already signed into Chrome — no separate popup needed
      let accessToken;
      try {
        accessToken = await this.getGoogleToken();
        console.log('✅ Got Google access token');
      } catch (tokenError) {
        console.error('❌ Google token error:', tokenError);
        // Fallback: try launchWebAuthFlow
        accessToken = await this.getGoogleTokenViaWebFlow();
        console.log('✅ Got Google access token via web flow');
      }

      if (!accessToken) throw new Error('No access token received');

      // Step 2: Exchange Google token for Firebase ID token
      console.log('🔄 Exchanging token with Firebase...');
      const firebaseResponse = await fetch(
        `${LINKCRYPTA_CONFIG.AUTH_BASE}/accounts:signInWithIdp?key=${LINKCRYPTA_CONFIG.FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postBody: `access_token=${accessToken}&providerId=google.com`,
            requestUri: 'https://linkcrypta-61258.firebaseapp.com/__/auth/handler',
            returnIdpCredential: true,
            returnSecureToken: true
          })
        }
      );

      if (!firebaseResponse.ok) {
        const err = await firebaseResponse.json();
        console.error('❌ Firebase response error:', err);
        throw new Error(err.error?.message || 'Firebase auth failed');
      }

      const firebaseData = await firebaseResponse.json();
      console.log('✅ Firebase auth successful');

      this.idToken = firebaseData.idToken;
      this.refreshToken = firebaseData.refreshToken;
      this.tokenExpiry = Date.now() + (parseInt(firebaseData.expiresIn) * 1000);

      this.currentUser = {
        uid: firebaseData.localId,
        email: firebaseData.email,
        displayName: firebaseData.displayName || firebaseData.email.split('@')[0],
        photoURL: firebaseData.photoUrl || ''
      };
      this.isAuthenticated = true;

      // Persist auth state
      await chrome.storage.local.set({
        isAuthenticated: true,
        currentUser: this.currentUser,
        idToken: this.idToken,
        refreshToken: this.refreshToken,
        tokenExpiry: this.tokenExpiry
      });

      console.log('✅ Auth complete for:', this.currentUser.email);

      // Sync passwords from Firestore after login (non-blocking)
      this.performSync().catch(e => console.error('Post-login sync failed:', e));

      return { success: true, user: this.currentUser };
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Primary: Use chrome.identity.getAuthToken (simplest, uses Chrome's signed-in account)
  async getGoogleToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!token) {
          reject(new Error('No token returned'));
        } else {
          resolve(token);
        }
      });
    });
  }

  // Fallback: Use launchWebAuthFlow (works when getAuthToken is not available)
  async getGoogleTokenViaWebFlow() {
    const clientId = await this.getOAuthClientId();
    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `response_type=token&` +
      `redirect_uri=${encodeURIComponent(redirectUrl)}&` +
      `scope=email%20profile%20openid`;

    console.log('🔗 Auth URL:', authUrl);
    console.log('🔗 Redirect URL:', redirectUrl);

    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        (url) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(url);
          }
        }
      );
    });

    const params = new URLSearchParams(responseUrl.replace(/.*[#?]/, ''));
    const token = params.get('access_token');
    if (!token) throw new Error('No access token in redirect URL');
    return token;
  }

  async getOAuthClientId() {
    // Try to get from manifest's oauth2 config, or use the web client ID
    try {
      const manifest = chrome.runtime.getManifest();
      if (manifest.oauth2?.client_id) return manifest.oauth2.client_id;
    } catch (e) { /* ignore */ }
    // Fallback: use Firebase web API key based client
    // The user should set their OAuth 2.0 Web Client ID here
    return '795878816417-a5jab510h6c0nolcpcsvumt3nljao4bb.apps.googleusercontent.com';
  }

  async ensureValidToken() {
    if (!this.idToken || Date.now() >= this.tokenExpiry - 60000) {
      await this.refreshFirebaseToken();
    }
    return this.idToken;
  }

  async refreshFirebaseToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token — user must sign in again');
    }
    try {
      const response = await fetch(
        `${LINKCRYPTA_CONFIG.TOKEN_URL}?key=${LINKCRYPTA_CONFIG.FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=refresh_token&refresh_token=${this.refreshToken}`
        }
      );
      if (!response.ok) throw new Error('Token refresh failed');
      const data = await response.json();
      this.idToken = data.id_token;
      this.refreshToken = data.refresh_token;
      this.tokenExpiry = Date.now() + (parseInt(data.expires_in) * 1000);

      await chrome.storage.local.set({
        idToken: this.idToken,
        refreshToken: this.refreshToken,
        tokenExpiry: this.tokenExpiry
      });
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.isAuthenticated = false;
      throw error;
    }
  }

  async signOutUser() {
    try {
      // Revoke the Google token if possible
      try {
        const result = await chrome.storage.local.get(['idToken']);
        if (result.idToken) {
          await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${result.idToken}`).catch(() => {});
        }
      } catch (e) { /* ignore */ }

      this.currentUser = null;
      this.isAuthenticated = false;
      this.idToken = null;
      this.refreshToken = null;
      this.tokenExpiry = 0;

      await chrome.storage.local.clear();
      return { success: true };
    } catch (error) {
      console.error('Sign out failed:', error);
      return { success: false, error: error.message };
    }
  }

  async loadAuthState() {
    try {
      const result = await chrome.storage.local.get([
        'isAuthenticated', 'currentUser', 'idToken', 'refreshToken', 'tokenExpiry'
      ]);
      this.isAuthenticated = result.isAuthenticated || false;
      this.currentUser = result.currentUser || null;
      this.idToken = result.idToken || null;
      this.refreshToken = result.refreshToken || null;
      this.tokenExpiry = result.tokenExpiry || 0;
    } catch (error) {
      console.error('Failed to load auth state:', error);
      this.isAuthenticated = false;
    }
  }

  // ─── FIRESTORE CRUD ──────────────────────────────────────────────

  async getStoredPasswords() {
    try {
      if (!this.isAuthenticated || !this.currentUser) {
        const local = await chrome.storage.local.get(['passwords']);
        return local.passwords || [];
      }

      const token = await this.ensureValidToken();
      const uid = this.currentUser.uid;
      const url = `${LINKCRYPTA_CONFIG.FIRESTORE_BASE}/users/${uid}/passwords`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.warn('Firestore fetch failed, using cached passwords');
        const local = await chrome.storage.local.get(['passwords']);
        return local.passwords || [];
      }

      const data = await response.json();
      const passwords = (data.documents || []).map(doc => this.firestoreDocToPassword(doc));

      // Cache locally for offline access
      await chrome.storage.local.set({ passwords });
      return passwords;
    } catch (error) {
      console.error('Failed to get passwords:', error);
      const local = await chrome.storage.local.get(['passwords']);
      return local.passwords || [];
    }
  }

  firestoreDocToPassword(doc) {
    const f = doc.fields || {};
    const getString = (field) => f[field]?.stringValue || '';
    const getBool = (field) => f[field]?.booleanValue || false;
    const getInt = (field) => parseInt(f[field]?.integerValue || f[field]?.stringValue || '0');
    return {
      id: getString('id') || doc.name.split('/').pop(),
      siteName: getString('name') || getString('siteName'),
      name: getString('name') || getString('siteName'),
      username: getString('username'),
      password: getString('password'),
      url: getString('url'),
      email: getString('email'),
      notes: getString('notes'),
      category: getString('category') || 'General',
      domain: getString('domain'),
      favicon: getString('favicon'),
      isFavorite: getBool('isFavorite'),
      createdAt: getString('createdAt') || new Date().toISOString(),
      updatedAt: getString('updatedAt') || new Date().toISOString()
    };
  }

  passwordToFirestoreFields(password) {
    const s = (val) => ({ stringValue: val || '' });
    const b = (val) => ({ booleanValue: !!val });
    return {
      id: s(password.id),
      name: s(password.siteName || password.name || password.title || 'Untitled'),
      username: s(password.username),
      password: s(password.password),
      url: s(password.url),
      email: s(password.email),
      notes: s(password.notes),
      category: s(password.category || 'General'),
      domain: s(password.domain),
      favicon: s(password.favicon),
      isFavorite: b(password.isFavorite),
      createdAt: s(password.createdAt || new Date().toISOString()),
      updatedAt: s(new Date().toISOString()),
      source: s('browser_extension')
    };
  }

  async savePassword(passwordData) {
    try {
      if (!passwordData || !passwordData.username || !passwordData.password) {
        return { success: false, error: 'Username and password are required' };
      }

      const newPassword = {
        id: this.generateId(),
        siteName: passwordData.title || passwordData.siteName || passwordData.domain || 'Untitled',
        name: passwordData.title || passwordData.siteName || passwordData.domain || 'Untitled',
        username: passwordData.username,
        password: passwordData.password,
        url: passwordData.url || '',
        email: passwordData.email || '',
        notes: passwordData.notes || '',
        favicon: passwordData.favicon || '',
        domain: passwordData.domain || '',
        category: passwordData.category || 'General',
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save locally first
      const result = await chrome.storage.local.get(['passwords']);
      const passwords = result.passwords || [];
      passwords.push(newPassword);
      await chrome.storage.local.set({ passwords });

      // Then save to Firestore
      if (this.isAuthenticated && this.currentUser) {
        await this.savePasswordToFirestore(newPassword).catch(e =>
          console.error('Firestore save failed (will retry on sync):', e)
        );
      }

      console.log('✅ Password saved:', newPassword.siteName);
      chrome.runtime.sendMessage({ type: 'PASSWORD_SAVED', password: newPassword }).catch(() => {});

      return { success: true, message: 'Password saved successfully', password: newPassword };
    } catch (error) {
      console.error('❌ Error saving password:', error);
      return { success: false, error: error.message };
    }
  }

  async savePasswordToFirestore(password) {
    const token = await this.ensureValidToken();
    const uid = this.currentUser.uid;
    const docId = password.id;
    const url = `${LINKCRYPTA_CONFIG.FIRESTORE_BASE}/users/${uid}/passwords/${docId}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields: this.passwordToFirestoreFields(password) })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Firestore save failed: ${err}`);
    }
    return true;
  }

  // ─── SYNC ────────────────────────────────────────────────────────

  async performSync() {
    if (!this.isAuthenticated || !this.currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      console.log('🔄 Starting sync...');

      // 1. Get passwords from Firestore
      const firestorePasswords = await this.getStoredPasswords();

      // 2. Get local passwords
      const localResult = await chrome.storage.local.get(['passwords']);
      const localPasswords = localResult.passwords || [];

      // 3. Merge: find local passwords not in Firestore and push them
      const firestoreIds = new Set(firestorePasswords.map(p => p.id));
      const localOnly = localPasswords.filter(p => !firestoreIds.has(p.id));

      for (const password of localOnly) {
        await this.savePasswordToFirestore(password).catch(e =>
          console.error('Failed to push local password:', e)
        );
      }

      // 4. Update local cache with merged set
      const mergedIds = new Set();
      const merged = [];
      for (const p of [...firestorePasswords, ...localOnly]) {
        if (!mergedIds.has(p.id)) {
          mergedIds.add(p.id);
          merged.push(p);
        }
      }
      await chrome.storage.local.set({
        passwords: merged,
        lastSyncTime: Date.now()
      });

      console.log(`✅ Sync complete: ${merged.length} passwords`);
      return { success: true, message: `Synced ${merged.length} passwords` };
    } catch (error) {
      console.error('❌ Sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  // ─── MESSAGE HANDLING ────────────────────────────────────────────

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.type || request.action) {
        case 'authenticate':
          sendResponse(await this.authenticateUser());
          break;
        case 'signOut':
          sendResponse(await this.signOutUser());
          break;
        case 'getPasswords':
          sendResponse({ success: true, passwords: await this.getStoredPasswords() });
          break;
        case 'addPassword':
          sendResponse(await this.savePassword(request.password));
          break;
        case 'syncData':
          sendResponse(await this.performSync());
          break;
        case 'logActivity':
          await this.logUserActivity(request.activity);
          sendResponse({ success: true });
          break;
        case 'CREDENTIALS_CAPTURED':
          await this.handleCredentialsCaptured(request.data, request.showOnNextPage);
          sendResponse({ success: true });
          break;
        case 'FORM_DETECTED':
          sendResponse({ success: true });
          break;
        case 'CONTENT_SCRIPT_READY':
          sendResponse({ success: true });
          break;
        case 'UPDATE_AUTO_LOCK':
          this.resetAutoLockTimer();
          sendResponse({ success: true });
          break;
        case 'SYNC_TO_FLUTTER_APP':
          sendResponse(await this.syncToFlutterApp());
          break;
        case 'SEARCH_PASSWORDS': {
          const passwords = await this.getMatchingPasswords(request.url || '');
          sendResponse({ success: true, results: passwords });
          break;
        }
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // ─── CONTEXT MENUS ───────────────────────────────────────────────

  setupContextMenus() {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'linkcrypta-fill-password', title: 'Fill with LinkCrypta',
        contexts: ['editable'], documentUrlPatterns: ['http://*/*', 'https://*/*']
      });
      chrome.contextMenus.create({
        id: 'linkcrypta-save-credentials', title: 'Save credentials to LinkCrypta',
        contexts: ['page'], documentUrlPatterns: ['http://*/*', 'https://*/*']
      });
      chrome.contextMenus.create({
        id: 'linkcrypta-generate-password', title: 'Generate password',
        contexts: ['editable'], documentUrlPatterns: ['http://*/*', 'https://*/*']
      });
    });

    if (!this._contextMenuListenerAdded) {
      chrome.contextMenus.onClicked.addListener((info, tab) => this.handleContextMenuClick(info, tab));
      this._contextMenuListenerAdded = true;
    }
  }

  async handleContextMenuClick(info, tab) {
    switch (info.menuItemId) {
      case 'linkcrypta-fill-password': await this.handleFillPassword(tab); break;
      case 'linkcrypta-save-credentials': await this.handleSaveCredentials(tab); break;
      case 'linkcrypta-generate-password': await this.handleGeneratePassword(tab); break;
    }
  }

  // ─── AUTO-FILL & PASSWORD MATCHING ───────────────────────────────

  async handleFillPassword(tab) {
    if (!this.isAuthenticated) { this.showNotification('Please sign in first'); return; }
    try {
      const passwords = await this.getMatchingPasswords(tab.url);
      if (passwords.length === 0) { this.showNotification('No passwords found for this site'); return; }
      if (passwords.length === 1) {
        await chrome.tabs.sendMessage(tab.id, { action: 'fillPassword', password: passwords[0] });
      } else {
        await chrome.tabs.sendMessage(tab.id, { action: 'showPasswordSelector', passwords });
      }
    } catch (error) {
      console.error('Error filling password:', error);
    }
  }

  async handleSaveCredentials(tab) {
    if (!this.isAuthenticated) { this.showNotification('Please sign in first'); return; }
    try { await chrome.tabs.sendMessage(tab.id, { action: 'extractCredentials' }); } catch (e) { /* ignore */ }
  }

  async handleGeneratePassword(tab) {
    try {
      const password = this.generateRandomPassword();
      await chrome.tabs.sendMessage(tab.id, { action: 'fillGeneratedPassword', password });
    } catch (e) { console.error('Error generating password:', e); }
  }

  async getMatchingPasswords(url) {
    try {
      const passwords = await this.getStoredPasswords();
      const domain = this.extractDomain(url);
      return passwords.filter(p => {
        if (!p.url && !p.domain) return false;
        const pDomain = this.extractDomain(p.url || p.domain || '');
        return this.calculateDomainMatch(domain, pDomain) > LINKCRYPTA_CONFIG.AUTOFILL.CONFIDENCE_THRESHOLD;
      });
    } catch (error) {
      return [];
    }
  }

  // ─── CREDENTIAL CAPTURE ──────────────────────────────────────────

  async handleCredentialsCaptured(captureData, showOnNextPage = false) {
    try {
      console.log('Credentials captured:', captureData?.domain);

      // Save as a password entry
      await this.savePassword({
        title: captureData.title,
        siteName: captureData.title || captureData.domain,
        username: captureData.username,
        password: captureData.password,
        url: captureData.url,
        domain: captureData.domain,
        favicon: captureData.favicon,
        notes: `Auto-captured from ${captureData.domain} on ${new Date().toLocaleDateString()}`
      });

      if (showOnNextPage) {
        await chrome.storage.local.set({
          pendingCapture: { data: captureData, timestamp: Date.now() }
        });
      }

      // Also try local server sync (fallback for when app is running locally)
      this.tryLocalServerSync(captureData).catch(() => {});
    } catch (error) {
      console.error('Error handling captured credentials:', error);
    }
  }

  // ─── LOCAL SERVER SYNC (FALLBACK) ────────────────────────────────

  async tryLocalServerSync(data) {
    const ports = [8080, 8081, 3000, 3001, 5000];
    for (const port of ports) {
      try {
        const response = await fetch(`http://localhost:${port}/api/extension-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Extension-ID': chrome.runtime.id },
          body: JSON.stringify(data)
        });
        if (response.ok) {
          console.log(`✅ Synced to Flutter app on port ${port}`);
          return true;
        }
      } catch (e) { /* port not available */ }
    }
    return false;
  }

  async syncToFlutterApp() {
    try {
      const result = await chrome.storage.local.get(['passwords']);
      const passwords = result.passwords || [];
      let synced = 0;
      for (const p of passwords) {
        if (await this.tryLocalServerSync(p)) synced++;
      }
      return { success: true, message: `Synced ${synced} items` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ─── UTILITIES ───────────────────────────────────────────────────

  setupCommandListeners() {
    chrome.commands.onCommand.addListener((command) => this.handleCommand(command));
  }

  async handleCommand(command) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (command === 'open-quick-search') chrome.action.openPopup();
    else if (command === 'auto-fill-password') await this.handleFillPassword(tab);
  }

  setupAutoLock() {
    this.resetAutoLockTimer();
    chrome.tabs.onActivated.addListener(() => this.resetAutoLockTimer());
    chrome.tabs.onUpdated.addListener(() => this.resetAutoLockTimer());
  }

  resetAutoLockTimer() {
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer);
    this.autoLockTimer = setTimeout(() => this.lockExtension(), LINKCRYPTA_CONFIG.EXTENSION.AUTO_LOCK_TIMEOUT);
  }

  async lockExtension() {
    await chrome.storage.session?.clear?.().catch(() => {});
    chrome.runtime.sendMessage({ type: 'EXTENSION_LOCKED' }).catch(() => {});
  }

  setupPeriodicSync() {
    this.syncInterval = setInterval(() => {
      if (this.isAuthenticated) this.performSync().catch(() => {});
    }, LINKCRYPTA_CONFIG.EXTENSION.SYNC_INTERVAL);
  }

  async logUserActivity(activity) {
    try {
      const result = await chrome.storage.local.get(['activities']);
      const activities = result.activities || [];
      activities.push({ ...activity, timestamp: Date.now() });
      if (activities.length > 100) activities.splice(0, activities.length - 100);
      await chrome.storage.local.set({ activities });
    } catch (e) { /* ignore */ }
  }

  extractDomain(url) {
    try { return new URL(url).hostname.replace('www.', ''); }
    catch { return url || ''; }
  }

  calculateDomainMatch(d1, d2) {
    if (d1 === d2) return 1.0;
    const p1 = d1.split('.'), p2 = d2.split('.');
    if (p1.length > 1 && p2.length > 1) {
      if (p1.slice(-2).join('.') === p2.slice(-2).join('.')) return 0.8;
    }
    return 0.0;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  generateRandomPassword(opts = {}) {
    const { length = 16, uppercase = true, lowercase = true, numbers = true, symbols = true } = opts;
    let charset = '';
    if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (numbers) charset += '0123456789';
    if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    if (!charset) charset = 'abcdefghijklmnopqrstuvwxyz';
    let pw = '';
    for (let i = 0; i < length; i++) pw += charset.charAt(Math.floor(Math.random() * charset.length));
    return pw;
  }

  showNotification(message) {
    chrome.notifications.create({ type: 'basic', iconUrl: '/icons/icon-48.png', title: 'LinkCrypta', message });
  }

  async detectFormsOnPage(tab) {
    try { await chrome.tabs.sendMessage(tab.id, { type: 'DETECT_FORMS' }); }
    catch (e) {
      if (!e.message?.includes('Receiving end does not exist') && !e.message?.includes('Could not establish connection')) {
        console.error('Error detecting forms:', e);
      }
    }
  }
}

// ─── INITIALIZATION ──────────────────────────────────────────────

const backgroundService = new BackgroundService();

console.log('🚀 Background service worker loaded');
backgroundService.initialize().then(() => {
  console.log('✅ Background service ready');
}).catch(e => console.error('❌ Init failed:', e));

chrome.runtime.onStartup.addListener(() => backgroundService.initialize());
chrome.runtime.onInstalled.addListener(() => backgroundService.initialize());

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    setTimeout(() => backgroundService.detectFormsOnPage(tab), 500);
  }
});
