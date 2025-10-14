// Auto-Capture Service for LinkCrypta Extension
class AutoCaptureService {
  constructor() {
    this.detectedForms = new Map();
    this.observing = false;
    this.observer = null;
    this.pendingCaptures = new Map();
    this.formSubmissionHandlers = new Map();
    this.registrationDetector = null;
    this.lastCaptureTime = 0;
    this.captureDelay = 1000; // Prevent duplicate captures within 1 second
  }

  // Initialize auto-capture service
  async initialize() {
    try {
      // Check if auto-capture is enabled in settings
      const settings = await this.getSettings();
      this.isEnabled = settings.autoCaptureEnabled !== false;

      if (!this.isEnabled) {
        console.log('Auto-capture is disabled');
        return;
      }

      // Setup form submission listeners
      this.setupFormSubmissionListeners();
      
      // Setup registration detection
      this.setupRegistrationDetection();
      
      // Setup input change listeners for real-time capture
      this.setupInputChangeListeners();

      console.log('Auto-capture service initialized');
    } catch (error) {
      console.error('Failed to initialize auto-capture service:', error);
    }
  }

  // Get extension settings
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['autoCaptureEnabled', 'autoCaptureNotifications'], (result) => {
        resolve({
          autoCaptureEnabled: result.autoCaptureEnabled !== false,
          autoCaptureNotifications: result.autoCaptureNotifications !== false
        });
      });
    });
  }

  // Setup form submission listeners
  setupFormSubmissionListeners() {
    // Listen for form submissions
    document.addEventListener('submit', this.handleFormSubmission.bind(this), true);
    
    // Listen for button clicks that might trigger AJAX submissions
    document.addEventListener('click', this.handleButtonClick.bind(this), true);
    
    // Listen for Enter key in password fields
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    
    // Listen for navigation changes (SPA applications)
    this.setupNavigationListeners();
  }

  // Setup registration detection
  setupRegistrationDetection() {
    // Look for registration forms
    this.detectRegistrationForms();
    
    // Setup mutation observer for dynamic registration forms
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          setTimeout(() => this.detectRegistrationForms(), 100);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Setup input change listeners for real-time capture
  setupInputChangeListeners() {
    document.addEventListener('input', (event) => {
      const field = event.target;
      
      // Only monitor password and username fields
      if (this.isCredentialField(field)) {
        this.scheduleCapture(field);
      }
    }, true);

    document.addEventListener('change', (event) => {
      const field = event.target;
      
      if (this.isCredentialField(field)) {
        this.scheduleCapture(field);
      }
    }, true);
  }

  // Setup navigation listeners for SPA applications
  setupNavigationListeners() {
    // Listen for pushState/replaceState changes
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      setTimeout(() => this.handleNavigationChange(), 500);
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(() => this.handleNavigationChange(), 500);
    };

    // Listen for popstate events
    window.addEventListener('popstate', () => {
      setTimeout(() => this.handleNavigationChange(), 500);
    });
  }

  // Handle form submission
  async handleFormSubmission(event) {
    if (!this.isEnabled) return;

    const form = event.target;
    if (!form || form.tagName !== 'FORM') return;

    try {
      const credentials = await this.extractCredentialsFromForm(form);
      
      if (credentials && this.isValidCredentials(credentials)) {
        const captureData = {
          ...credentials,
          captureType: 'form_submission',
          timestamp: Date.now(),
          url: window.location.href,
          domain: window.location.hostname,
          formAction: form.action || window.location.href,
          isRegistration: this.isRegistrationForm(form)
        };

        await this.captureCredentials(captureData);
      }
    } catch (error) {
      console.error('Error handling form submission:', error);
    }
  }

  // Handle button clicks for AJAX submissions
  async handleButtonClick(event) {
    if (!this.isEnabled) return;

    const button = event.target;
    if (!this.isSubmitButton(button)) return;

    // Wait a bit for any form validation or processing
    setTimeout(async () => {
      try {
        const form = this.findParentForm(button) || this.findNearbyCredentialFields(button);
        
        if (form) {
          const credentials = await this.extractCredentialsFromElement(form);
          
          if (credentials && this.isValidCredentials(credentials)) {
            const captureData = {
              ...credentials,
              captureType: 'button_click',
              timestamp: Date.now(),
              url: window.location.href,
              domain: window.location.hostname,
              isRegistration: this.isRegistrationContext()
            };

            await this.captureCredentials(captureData);
          }
        }
      } catch (error) {
        console.error('Error handling button click:', error);
      }
    }, 1000);
  }

  // Handle Enter key in password fields
  async handleKeyDown(event) {
    if (!this.isEnabled || event.key !== 'Enter') return;

    const field = event.target;
    if (!this.isPasswordField(field)) return;

    // Wait a bit for any form processing
    setTimeout(async () => {
      try {
        const form = this.findParentForm(field) || this.findNearbyCredentialFields(field);
        
        if (form) {
          const credentials = await this.extractCredentialsFromElement(form);
          
          if (credentials && this.isValidCredentials(credentials)) {
            const captureData = {
              ...credentials,
              captureType: 'enter_key',
              timestamp: Date.now(),
              url: window.location.href,
              domain: window.location.hostname,
              isRegistration: this.isRegistrationContext()
            };

            await this.captureCredentials(captureData);
          }
        }
      } catch (error) {
        console.error('Error handling Enter key:', error);
      }
    }, 1000);
  }

  // Handle navigation changes in SPAs
  handleNavigationChange() {
    // Clear previous captures for new page
    this.capturedData.clear();
    
    // Re-detect forms on new page
    setTimeout(() => {
      this.detectRegistrationForms();
    }, 1000);
  }

  // Schedule credential capture with debouncing
  scheduleCapture(field) {
    const fieldId = this.getFieldId(field);
    
    // Initialize pendingCaptures as Map if not already
    if (!this.pendingCaptures) {
      this.pendingCaptures = new Map();
    }
    
    // Clear existing timeout for this field
    if (this.pendingCaptures.has(fieldId)) {
      clearTimeout(this.pendingCaptures.get(fieldId));
    }

    // Schedule new capture
    const timeoutId = setTimeout(async () => {
      try {
        const form = this.findParentForm(field) || this.findNearbyCredentialFields(field);
        
        if (form) {
          const credentials = await this.extractCredentialsFromElement(form);
          
          if (credentials && this.isValidCredentials(credentials)) {
            const captureData = {
              ...credentials,
              captureType: 'input_change',
              timestamp: Date.now(),
              url: window.location.href,
              domain: window.location.hostname,
              isRegistration: this.isRegistrationContext()
            };

            await this.captureCredentials(captureData);
          }
        }
      } catch (error) {
        console.error('Error in scheduled capture:', error);
      } finally {
        this.pendingCaptures.delete(fieldId);
      }
    }, 2000); // Wait 2 seconds after user stops typing

    this.pendingCaptures.set(fieldId, timeoutId);
  }

  // Extract credentials from form element
  async extractCredentialsFromForm(form) {
    const usernameField = this.findUsernameField(form);
    const passwordField = this.findPasswordField(form);
    const emailField = this.findEmailField(form);

    if (!passwordField || !passwordField.value.trim()) {
      return null;
    }

    const username = usernameField?.value.trim() || emailField?.value.trim() || '';
    const password = passwordField.value.trim();

    if (!username || !password) {
      return null;
    }

    return {
      username,
      password,
      email: emailField?.value.trim() || (username.includes('@') ? username : ''),
      title: this.generateTitle(window.location.hostname, username),
      url: window.location.href,
      domain: window.location.hostname,
      favicon: this.getFavicon()
    };
  }

  // Extract credentials from any element (for formless detection)
  async extractCredentialsFromElement(element) {
    const container = element.tagName === 'FORM' ? element : document.body;
    
    const usernameField = this.findUsernameField(container);
    const passwordField = this.findPasswordField(container);
    const emailField = this.findEmailField(container);

    if (!passwordField || !passwordField.value.trim()) {
      return null;
    }

    const username = usernameField?.value.trim() || emailField?.value.trim() || '';
    const password = passwordField.value.trim();

    if (!username || !password) {
      return null;
    }

    return {
      username,
      password,
      email: emailField?.value.trim() || (username.includes('@') ? username : ''),
      title: this.generateTitle(window.location.hostname, username),
      url: window.location.href,
      domain: window.location.hostname,
      favicon: this.getFavicon()
    };
  }

  // Capture credentials and send to Flutter app
  async captureCredentials(captureData) {
    // Prevent duplicate captures
    const captureKey = `${captureData.domain}-${captureData.username}-${captureData.password}`;
    const now = Date.now();
    
    if (this.capturedData.has(captureKey) && 
        (now - this.capturedData.get(captureKey)) < this.captureDelay) {
      return;
    }

    this.capturedData.set(captureKey, now);

    try {
      // Store in extension storage
      await this.storeCapture(captureData);
      
      // Send to background script
      chrome.runtime.sendMessage({
        type: 'CREDENTIALS_CAPTURED',
        data: captureData
      });

      // Show notification if enabled
      const settings = await this.getSettings();
      if (settings.autoCaptureNotifications) {
        this.showCaptureNotification(captureData);
      }

      console.log('Credentials captured:', {
        domain: captureData.domain,
        username: captureData.username,
        type: captureData.captureType,
        isRegistration: captureData.isRegistration
      });

    } catch (error) {
      console.error('Error capturing credentials:', error);
    }
  }

  // Store capture in extension storage
  async storeCapture(captureData) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['capturedCredentials'], (result) => {
        const captures = result.capturedCredentials || [];
        
        // Add new capture
        captures.push({
          ...captureData,
          id: this.generateId(),
          synced: false
        });

        // Keep only last 100 captures
        if (captures.length > 100) {
          captures.splice(0, captures.length - 100);
        }

        chrome.storage.local.set({ capturedCredentials: captures }, resolve);
      });
    });
  }

  // Show capture notification
  showCaptureNotification(captureData) {
    const notification = document.createElement('div');
    notification.className = 'linkcrypta-capture-notification';
    notification.innerHTML = `
      <div class="linkcrypta-notification-content">
        <div class="linkcrypta-notification-icon">🔐</div>
        <div class="linkcrypta-notification-text">
          <strong>Credentials Captured</strong>
          <br>Saved for ${captureData.domain}
        </div>
        <button class="linkcrypta-notification-close">×</button>
      </div>
    `;

    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #6C63FF;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .linkcrypta-notification-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .linkcrypta-notification-icon {
        font-size: 20px;
      }
      .linkcrypta-notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);

    // Close button handler
    notification.querySelector('.linkcrypta-notification-close').addEventListener('click', () => {
      notification.remove();
    });
  }

  // Detect registration forms
  detectRegistrationForms() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
      if (this.isRegistrationForm(form)) {
        this.setupRegistrationFormListener(form);
      }
    });

    // Also check for formless registration
    this.detectFormlessRegistration();
  }

  // Setup listener for registration form
  setupRegistrationFormListener(form) {
    if (form.hasAttribute('data-linkcrypta-registration-listener')) return;
    
    form.setAttribute('data-linkcrypta-registration-listener', 'true');
    
    form.addEventListener('submit', async (event) => {
      const credentials = await this.extractCredentialsFromForm(form);
      
      if (credentials && this.isValidCredentials(credentials)) {
        const captureData = {
          ...credentials,
          captureType: 'registration',
          timestamp: Date.now(),
          url: window.location.href,
          domain: window.location.hostname,
          isRegistration: true
        };

        await this.captureCredentials(captureData);
      }
    });
  }

  // Detect formless registration
  detectFormlessRegistration() {
    const passwordFields = document.querySelectorAll('input[type="password"]');
    
    passwordFields.forEach(passwordField => {
      if (this.isInRegistrationContext(passwordField)) {
        this.setupFormlessRegistrationListener(passwordField);
      }
    });
  }

  // Setup listener for formless registration
  setupFormlessRegistrationListener(passwordField) {
    if (passwordField.hasAttribute('data-linkcrypta-registration-listener')) return;
    
    passwordField.setAttribute('data-linkcrypta-registration-listener', 'true');
    
    // Listen for changes and nearby button clicks
    const container = passwordField.closest('div, section, main') || document.body;
    
    container.addEventListener('click', async (event) => {
      if (this.isSubmitButton(event.target)) {
        setTimeout(async () => {
          const credentials = await this.extractCredentialsFromElement(container);
          
          if (credentials && this.isValidCredentials(credentials)) {
            const captureData = {
              ...credentials,
              captureType: 'formless_registration',
              timestamp: Date.now(),
              url: window.location.href,
              domain: window.location.hostname,
              isRegistration: true
            };

            await this.captureCredentials(captureData);
          }
        }, 1000);
      }
    });
  }

  // Helper methods for field detection
  findUsernameField(container) {
    const selectors = [
      'input[name*="username" i]',
      'input[name*="user" i]',
      'input[name*="login" i]',
      'input[id*="username" i]',
      'input[id*="user" i]',
      'input[id*="login" i]',
      'input[autocomplete="username"]',
      'input[type="text"]',
      'input[type="email"]'
    ];

    for (const selector of selectors) {
      const field = container.querySelector(selector);
      if (field && this.isVisibleField(field) && field.value.trim()) {
        return field;
      }
    }

    return null;
  }

  findPasswordField(container) {
    const passwordFields = container.querySelectorAll('input[type="password"]');
    
    for (const field of passwordFields) {
      if (this.isVisibleField(field) && field.value.trim()) {
        return field;
      }
    }

    return null;
  }

  findEmailField(container) {
    const selectors = [
      'input[type="email"]',
      'input[name*="email" i]',
      'input[id*="email" i]',
      'input[autocomplete="email"]'
    ];

    for (const selector of selectors) {
      const field = container.querySelector(selector);
      if (field && this.isVisibleField(field) && field.value.trim()) {
        return field;
      }
    }

    return null;
  }

  // Helper methods for form analysis
  isRegistrationForm(form) {
    const text = (form.textContent || '').toLowerCase();
    const action = (form.action || '').toLowerCase();
    const className = (form.className || '').toLowerCase();
    const id = (form.id || '').toLowerCase();

    const registrationKeywords = /sign.?up|register|create.?account|join|signup/i;
    
    return registrationKeywords.test(text) || 
           registrationKeywords.test(action) || 
           registrationKeywords.test(className) || 
           registrationKeywords.test(id);
  }

  isRegistrationContext() {
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const body = document.body.textContent.toLowerCase();

    const registrationKeywords = /sign.?up|register|create.?account|join|signup/i;
    
    return registrationKeywords.test(url) || 
           registrationKeywords.test(title) || 
           registrationKeywords.test(body);
  }

  isInRegistrationContext(element) {
    const container = element.closest('form, div, section') || document.body;
    const text = (container.textContent || '').toLowerCase();
    
    const registrationKeywords = /sign.?up|register|create.?account|join|signup/i;
    
    return registrationKeywords.test(text) || this.isRegistrationContext();
  }

  isSubmitButton(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    const type = (element.type || '').toLowerCase();
    const text = (element.textContent || '').toLowerCase();
    
    if (tagName === 'input' && type === 'submit') return true;
    if (tagName === 'button' && (type === 'submit' || type === '')) return true;
    
    const submitKeywords = /sign.?in|log.?in|sign.?up|register|submit|continue|next|create|join/i;
    return submitKeywords.test(text);
  }

  isCredentialField(field) {
    if (!field || !field.tagName) return false;
    
    const type = (field.type || '').toLowerCase();
    const name = (field.name || '').toLowerCase();
    const id = (field.id || '').toLowerCase();
    
    if (type === 'password') return true;
    if (type === 'email') return true;
    
    const credentialKeywords = /username|user|login|email|password/i;
    return credentialKeywords.test(name) || credentialKeywords.test(id);
  }

  isPasswordField(field) {
    return field && field.type === 'password';
  }

  isVisibleField(field) {
    if (!field) return false;
    
    const style = window.getComputedStyle(field);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           field.offsetWidth > 0 && 
           field.offsetHeight > 0;
  }

  isValidCredentials(credentials) {
    return credentials && 
           credentials.username && 
           credentials.password && 
           credentials.username.length > 0 && 
           credentials.password.length > 2;
  }

  // Helper methods
  findParentForm(element) {
    return element.closest('form');
  }

  findNearbyCredentialFields(element) {
    const container = element.closest('div, section, main, body');
    const hasCredentialFields = container.querySelector('input[type="password"]') || 
                               container.querySelector('input[type="email"]') ||
                               container.querySelector('input[name*="username" i]');
    
    return hasCredentialFields ? container : null;
  }

  getFieldId(field) {
    return field.id || field.name || field.type + '_' + Array.from(document.querySelectorAll(field.tagName)).indexOf(field);
  }

  generateTitle(domain, username) {
    const cleanDomain = domain.replace(/^www\./, '');
    return `${cleanDomain} - ${username}`;
  }

  getFavicon() {
    const favicon = document.querySelector('link[rel*="icon"]');
    return favicon ? favicon.href : `https://${window.location.hostname}/favicon.ico`;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Public methods for controlling auto-capture
  enable() {
    this.isEnabled = true;
    chrome.storage.sync.set({ autoCaptureEnabled: true });
  }

  disable() {
    this.isEnabled = false;
    chrome.storage.sync.set({ autoCaptureEnabled: false });
  }

  isEnabled() {
    return this.isEnabled;
  }

  // Get captured credentials
  async getCapturedCredentials() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['capturedCredentials'], (result) => {
        resolve(result.capturedCredentials || []);
      });
    });
  }

  // Clear captured credentials
  async clearCapturedCredentials() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ capturedCredentials: [] }, resolve);
    });
  }
}

// Make AutoCaptureService available globally
if (typeof window !== 'undefined') {
  window.AutoCaptureService = AutoCaptureService;
}
