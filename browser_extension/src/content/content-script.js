// Main Content Script for LinkCrypta Extension
class LinkCryptaContentScript {
  constructor() {
    this.autoFillManager = null;
    this.autoCaptureService = null;
    this.isInitialized = false;
    this.messageHandlers = new Map();
  }

  // Initialize content script
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // Initialize auto-fill manager
      this.autoFillManager = new AutoFillManager();
      this.autoFillManager.initialize();

      // Initialize auto-capture service
      this.autoCaptureService = new AutoCaptureService();
      await this.autoCaptureService.initialize();

      // Setup message handlers
      this.setupMessageHandlers();

      // Setup runtime message listener
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        this.handleMessage(request, sender, sendResponse);
        return true; // Keep message channel open
      });

      // Notify background script that content script is ready
      chrome.runtime.sendMessage({
        type: 'CONTENT_SCRIPT_READY',
        url: window.location.href
      }).catch(() => {}); // Ignore if background not ready

      this.isInitialized = true;
      console.log('LinkCrypta content script initialized');

    } catch (error) {
      console.error('LinkCrypta content script initialization failed:', error);
    }
  }

  // Setup message handlers
  setupMessageHandlers() {
    this.messageHandlers.set('FILL_CREDENTIALS', this.handleFillCredentials.bind(this));
    this.messageHandlers.set('SHOW_CREDENTIAL_SELECTOR', this.handleShowCredentialSelector.bind(this));
    this.messageHandlers.set('EXTRACT_CREDENTIALS', this.handleExtractCredentials.bind(this));
    this.messageHandlers.set('FILL_GENERATED_PASSWORD', this.handleFillGeneratedPassword.bind(this));
    this.messageHandlers.set('DETECT_FORMS', this.handleDetectForms.bind(this));
    this.messageHandlers.set('GET_PAGE_INFO', this.handleGetPageInfo.bind(this));
    this.messageHandlers.set('HIGHLIGHT_FORM', this.handleHighlightForm.bind(this));
    this.messageHandlers.set('EXTENSION_LOCKED', this.handleExtensionLocked.bind(this));
    this.messageHandlers.set('TOGGLE_AUTO_CAPTURE', this.handleToggleAutoCapture.bind(this));
    this.messageHandlers.set('GET_CAPTURED_CREDENTIALS', this.handleGetCapturedCredentials.bind(this));
    this.messageHandlers.set('CLEAR_CAPTURED_CREDENTIALS', this.handleClearCapturedCredentials.bind(this));
  }

  // Handle incoming messages
  async handleMessage(request, sender, sendResponse) {
    try {
      const handler = this.messageHandlers.get(request.type);
      
      if (handler) {
        const result = await handler(request, sender);
        sendResponse({ success: true, result });
      } else {
        console.warn('Unknown message type:', request.type);
        sendResponse({ success: false, message: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, message: error.message });
    }
  }

  // Handle fill credentials request
  async handleFillCredentials(request) {
    if (!this.autoFillManager) return;

    const credentials = request.credentials;
    if (!credentials) {
      throw new Error('No credentials provided');
    }

    await this.autoFillManager.fillCredentials(credentials);
    return { filled: true };
  }

  // Handle show credential selector
  async handleShowCredentialSelector(request) {
    if (!this.autoFillManager) return;

    const credentials = request.credentials;
    if (!credentials || !credentials.length) {
      throw new Error('No credentials provided');
    }

    // Find best form to show selector near
    const forms = this.autoFillManager.formDetector.getDetectedForms();
    const bestForm = forms.sort((a, b) => b.confidence - a.confidence)[0];
    
    if (bestForm && bestForm.passwordField) {
      this.autoFillManager.showCredentialSuggestions(bestForm.passwordField, credentials);
    }

    return { shown: true };
  }

  // Handle extract credentials request
  async handleExtractCredentials(request) {
    if (!this.autoFillManager) return;

    const forms = this.autoFillManager.formDetector.getDetectedForms();
    const extractedCredentials = [];

    for (const formData of forms) {
      if (formData.isLoginForm) {
        const credentials = this.autoFillManager.extractCredentialsFromForm(formData);
        if (credentials.username && credentials.password) {
          extractedCredentials.push(credentials);
        }
      }
    }

    if (extractedCredentials.length > 0) {
      // Show save prompt for first found credentials
      this.autoFillManager.promptToSaveCredentials(extractedCredentials[0]);
    }

    return { extracted: extractedCredentials.length };
  }

  // Handle fill generated password
  async handleFillGeneratedPassword(request) {
    if (!this.autoFillManager) return;

    const password = request.password;
    if (!password) {
      throw new Error('No password provided');
    }

    const forms = this.autoFillManager.formDetector.getDetectedForms();
    const bestForm = forms.sort((a, b) => b.confidence - a.confidence)[0];

    if (bestForm && bestForm.passwordField) {
      await this.autoFillManager.fillField(bestForm.passwordField, password);
      return { filled: true };
    } else {
      throw new Error('No password field found');
    }
  }

  // Handle detect forms request
  async handleDetectForms(request) {
    if (!this.autoFillManager) return;

    this.autoFillManager.formDetector.stopObserving();
    this.autoFillManager.formDetector.clearDetectedForms();
    this.autoFillManager.formDetector.startObserving();

    const forms = this.autoFillManager.formDetector.getDetectedForms();
    return { 
      formsDetected: forms.length,
      forms: forms.map(form => ({
        url: form.url,
        confidence: form.confidence,
        hasUsername: !!form.usernameField,
        hasPassword: !!form.passwordField,
        isFormless: form.isFormless || false
      }))
    };
  }

  // Handle get page info request
  async handleGetPageInfo(request) {
    const forms = this.autoFillManager?.formDetector.getDetectedForms() || [];
    
    return {
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title,
      formsCount: forms.length,
      hasLoginForms: forms.some(form => form.isLoginForm),
      readyState: document.readyState
    };
  }

  // Handle highlight form request
  async handleHighlightForm(request) {
    if (!this.autoFillManager) return;

    const forms = this.autoFillManager.formDetector.getDetectedForms();
    
    forms.forEach((formData, index) => {
      if (formData.form) {
        this.highlightElement(formData.form, 2000);
      }
      if (formData.usernameField) {
        this.highlightElement(formData.usernameField, 2000);
      }
      if (formData.passwordField) {
        this.highlightElement(formData.passwordField, 2000);
      }
    });

    return { highlighted: forms.length };
  }

  // Handle extension locked
  async handleExtensionLocked(request) {
    if (this.autoFillManager) {
      // Hide any open suggestion popups
      this.autoFillManager.hideSuggestions();
      
      // Show locked notification
      this.autoFillManager.showNotification('LinkCrypta locked due to inactivity', 'info');
    }

    return { locked: true };
  }

  // Highlight element temporarily
  highlightElement(element, duration = 1000) {
    if (!element) return;

    const originalStyle = element.style.cssText;
    
    element.style.cssText += `
      outline: 3px solid #6C63FF !important;
      outline-offset: 2px !important;
      background-color: rgba(108, 99, 255, 0.1) !important;
      transition: all 0.3s ease !important;
    `;

    setTimeout(() => {
      element.style.cssText = originalStyle;
    }, duration);
  }

  // Get current page context
  getPageContext() {
    return {
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title,
      hasLoginForms: this.autoFillManager?.formDetector.getDetectedForms().some(form => form.isLoginForm) || false,
      formsCount: this.autoFillManager?.formDetector.getDetectedForms().length || 0
    };
  }

  // Check if page is likely a login page
  isLoginPage() {
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const body = document.body.textContent.toLowerCase();

    const loginKeywords = /sign.?in|log.?in|auth|login|account|portal/i;
    
    return loginKeywords.test(url) || 
           loginKeywords.test(title) || 
           loginKeywords.test(body);
  }

  // Handle toggle auto-capture
  async handleToggleAutoCapture(request) {
    if (!this.autoCaptureService) return { enabled: false };

    if (request.enabled) {
      this.autoCaptureService.enable();
    } else {
      this.autoCaptureService.disable();
    }

    return { enabled: request.enabled };
  }

  // Handle get captured credentials
  async handleGetCapturedCredentials(request) {
    if (!this.autoCaptureService) return { credentials: [] };

    const credentials = await this.autoCaptureService.getCapturedCredentials();
    return { credentials };
  }

  // Handle clear captured credentials
  async handleClearCapturedCredentials(request) {
    if (!this.autoCaptureService) return { cleared: false };

    await this.autoCaptureService.clearCapturedCredentials();
    return { cleared: true };
  }

  // Cleanup when page unloads
  cleanup() {
    if (this.autoFillManager) {
      this.autoFillManager.formDetector.stopObserving();
      this.autoFillManager.hideSuggestions();
    }
    
    if (this.autoCaptureService) {
      // Clear any pending captures
      this.autoCaptureService.pendingCaptures.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
    }
  }
}

// Initialize content script
const linkCryptaContentScript = new LinkCryptaContentScript();

// Start initialization when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    linkCryptaContentScript.initialize();
  });
} else {
  linkCryptaContentScript.initialize();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  linkCryptaContentScript.cleanup();
});

// Handle visibility changes (tab switches)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Reset auto-lock timer when tab becomes visible
    chrome.runtime.sendMessage({
      type: 'UPDATE_AUTO_LOCK'
    }).catch(() => {});
  }
});

// Make content script instance available globally for debugging
if (typeof window !== 'undefined') {
  window.linkCryptaContentScript = linkCryptaContentScript;
}
