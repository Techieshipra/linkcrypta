# LinkCrypta Browser Extension

A secure, mobile-compatible browser extension for the VaultMate password manager that provides seamless auto-fill capabilities and password management directly in your browser.

## Features

### 🔐 **Security & Authentication**
- Google Sign-in integration with Firebase/Supabase
- End-to-end encryption for all stored data
- Auto-lock functionality for enhanced security
- Secure local storage with Hive integration

### 📱 **Mobile-First Design**
- Responsive design that works on all screen sizes
- Touch-optimized interface with haptic feedback
- Mobile-friendly button sizes (44px minimum)
- Smooth animations and transitions
- Dark/light theme support

### 🚀 **Auto-Fill Capabilities**
- Smart form detection and field categorization
- Intelligent URL matching for credential suggestions
- Real-time password strength analysis
- Automatic credential saving prompts

### 🎯 **Advanced Features**
- Built-in password generator with customizable options
- Search functionality with keyboard shortcuts
- Current page analysis and security status
- Cross-device synchronization with Flutter app
- Activity logging and analytics

### ⌨️ **Keyboard Shortcuts**
- `Ctrl+Shift+L` (Cmd+Shift+L on Mac) - Quick search
- `Ctrl+Shift+F` (Cmd+Shift+F on Mac) - Auto-fill password
- `Ctrl+K` (Cmd+K on Mac) - Focus search
- `Escape` - Close modals
│   │   ├── popup.html         # Extension popup UI
│   │   ├── popup.css          # Responsive styles
│   │   └── popup.js           # Popup functionality
│   └── shared/
│       ├── config.js          # Configuration
│       ├── crypto.js          # Encryption utilities
│       └── firebase-config.js # Firebase integration
├── create_icons.html          # Icon generator tool
└── README.md                  # This file
```

## Mobile Compatibility

### **Responsive Design**
- Mobile-first CSS with breakpoints
- Flexible layouts that adapt to screen size
- Touch-friendly interface elements

### **Touch Optimizations**
- Minimum 44px touch targets
- Haptic feedback support
- Smooth scroll and gesture handling
- Optimized for one-handed use

### **Performance**
- Lightweight and fast loading
- Efficient memory usage
- Smooth animations with reduced motion support
- Accessibility features built-in

## Integration with VaultMate App

The extension seamlessly integrates with your VaultMate Flutter app:

### **Data Synchronization**
- Real-time sync with Firebase/Supabase
- Automatic conflict resolution
- Offline capability with local storage
- Manual sync controls

### **Shared Features**
- Same encryption standards
- Unified password health analysis
- Consistent user experience
- Cross-platform activity logging

## Development

### **Building & Testing**
1. Make changes to source files
2. Reload extension in browser
3. Test on different screen sizes
4. Verify mobile compatibility

### **Debugging**
- Use Chrome DevTools for popup debugging
- Check background script logs in Extensions page
- Monitor content script console in web pages
- Test auto-fill on various websites

### **Contributing**
1. Follow existing code style
2. Test on multiple browsers
3. Ensure mobile compatibility
4. Update documentation

## Security Considerations

### **Data Protection**
- All passwords encrypted before storage
- No plaintext passwords in memory
- Secure communication with backend
- Regular security audits

### **Privacy**
- No data collection or tracking
- Local-first approach
- User controls all data
- Transparent permissions

## Troubleshooting

### **Common Issues**

**Extension not loading:**
- Check manifest.json syntax
- Verify all file paths exist
- Enable Developer mode
- Check browser console for errors

**Auto-fill not working:**
- Verify content script injection
- Check website CSP policies
- Test on different form types
- Review permissions

**Sync issues:**
- Check Firebase/Supabase configuration
- Verify authentication status
- Test network connectivity
- Review error logs

**Mobile display issues:**
- Test viewport meta tags
- Check CSS media queries
- Verify touch event handling
- Test on actual mobile devices

### **Support**
For issues and support:
1. Check browser console for errors
2. Review extension logs
3. Test in incognito mode
4. Contact VaultMate support

## License

This extension is part of the VaultMate password manager project.

## Version History

### v1.0.0 (Current)
- Initial release
- Mobile-responsive design
- Full auto-fill functionality
- Firebase/Supabase integration
- Password generator
- Security features
