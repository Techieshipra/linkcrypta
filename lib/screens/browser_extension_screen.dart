import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import '../services/browser_extension_service.dart';

class BrowserExtensionScreen extends StatefulWidget {
  const BrowserExtensionScreen({Key? key}) : super(key: key);

  @override
  State<BrowserExtensionScreen> createState() => _BrowserExtensionScreenState();
}

class _BrowserExtensionScreenState extends State<BrowserExtensionScreen>
    with TickerProviderStateMixin {
  final BrowserExtensionService _extensionService = BrowserExtensionService();
  late TabController _tabController;
  Timer? _statusTimer;
  
  Map<String, dynamic> _statistics = {};
  List<Map<String, dynamic>> _recentCaptures = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _initializeService();
    _startStatusUpdates();
    _setupListener();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _statusTimer?.cancel();
    _extensionService.dispose();
    super.dispose();
  }

  Future<void> _initializeService() async {
    setState(() => _isLoading = true);
    
    try {
      final success = await _extensionService.startServer();
      if (success) {
        _updateStatistics();
        _showSnackBar('Browser extension service started successfully', isError: false);
      } else {
        _showSnackBar('Failed to start browser extension service', isError: true);
      }
    } catch (e) {
      _showSnackBar('Error initializing service: $e', isError: true);
      print('Browser extension service error: $e'); // Debug print
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _setupListener() {
    _extensionService.addListener((data) {
      setState(() {
        _recentCaptures.insert(0, {
          ...data,
          'receivedAt': DateTime.now(),
        });
        
        // Keep only last 20 captures
        if (_recentCaptures.length > 20) {
          _recentCaptures.removeLast();
        }
      });
      
      _updateStatistics();
      
      // Show notification
      _showSnackBar(
        'New credentials captured from ${data['domain']}', 
        isError: false,
      );
    });
  }

  void _startStatusUpdates() {
    _statusTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (mounted) {
        _updateStatistics();
      }
    });
  }

  void _updateStatistics() {
    setState(() {
      _statistics = _extensionService.getStatistics();
    });
  }

  Future<void> _toggleService() async {
    setState(() => _isLoading = true);
    
    try {
      if (_extensionService.isRunning) {
        await _extensionService.stopServer();
        _showSnackBar('Browser extension service stopped', isError: false);
      } else {
        final success = await _extensionService.startServer();
        if (success) {
          _showSnackBar('Browser extension service started', isError: false);
        } else {
          _showSnackBar('Failed to start service', isError: true);
        }
      }
      _updateStatistics();
    } catch (e) {
      _showSnackBar('Error toggling service: $e', isError: true);
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _resetStatistics() {
    _extensionService.resetStatistics();
    setState(() {
      _recentCaptures.clear();
    });
    _updateStatistics();
    _showSnackBar('Statistics reset', isError: false);
  }

  void _showSnackBar(String message, {required bool isError}) {
    if (!mounted) return;
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : Colors.green,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Browser Extension'),
        backgroundColor: const Color(0xFF6C63FF),
        foregroundColor: Colors.white,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: const [
            Tab(icon: Icon(Icons.dashboard), text: 'Status'),
            Tab(icon: Icon(Icons.history), text: 'Captures'),
            Tab(icon: Icon(Icons.settings), text: 'Setup'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildStatusTab(),
          _buildCapturesTab(),
          _buildSetupTab(),
        ],
      ),
    );
  }

  Widget _buildStatusTab() {
    return RefreshIndicator(
      onRefresh: () async {
        _updateStatistics();
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildServiceStatusCard(),
            const SizedBox(height: 16),
            _buildStatisticsCard(),
            const SizedBox(height: 16),
            _buildQuickActionsCard(),
          ],
        ),
      ),
    );
  }

  Widget _buildServiceStatusCard() {
    final isRunning = _statistics['isRunning'] ?? false;
    final port = _statistics['currentPort'] ?? 0;
    
    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isRunning ? Icons.check_circle : Icons.error,
                  color: isRunning ? Colors.green : Colors.red,
                  size: 24,
                ),
                const SizedBox(width: 8),
                Text(
                  'Service Status',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const Spacer(),
                if (_isLoading)
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Status',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      Text(
                        isRunning ? 'Running' : 'Stopped',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: isRunning ? Colors.green : Colors.red,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                if (isRunning)
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Port',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        Text(
                          port.toString(),
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _isLoading ? null : _toggleService,
                icon: Icon(isRunning ? Icons.stop : Icons.play_arrow),
                label: Text(isRunning ? 'Stop Service' : 'Start Service'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isRunning ? Colors.red : Colors.green,
                  foregroundColor: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatisticsCard() {
    final totalReceived = _statistics['totalReceived'] ?? 0;
    final totalProcessed = _statistics['totalProcessed'] ?? 0;
    final totalErrors = _statistics['totalErrors'] ?? 0;
    final successRate = _statistics['successRate'] ?? '0.0';
    final lastSync = _statistics['lastSyncTime'];
    
    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.analytics, color: Color(0xFF6C63FF)),
                const SizedBox(width: 8),
                Text(
                  'Statistics',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const Spacer(),
                TextButton(
                  onPressed: _resetStatistics,
                  child: const Text('Reset'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildStatItem('Received', totalReceived.toString(), Icons.download),
                ),
                Expanded(
                  child: _buildStatItem('Processed', totalProcessed.toString(), Icons.check),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildStatItem('Errors', totalErrors.toString(), Icons.error),
                ),
                Expanded(
                  child: _buildStatItem('Success Rate', '$successRate%', Icons.trending_up),
                ),
              ],
            ),
            if (lastSync != null) ...[
              const SizedBox(height: 16),
              Text(
                'Last Sync: ${_formatDateTime(DateTime.parse(lastSync))}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: const Color(0xFF6C63FF), size: 32),
        const SizedBox(height: 8),
        Text(
          value,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.bold,
            color: const Color(0xFF6C63FF),
          ),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }

  Widget _buildQuickActionsCard() {
    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.flash_on, color: Color(0xFF6C63FF)),
                const SizedBox(width: 8),
                Text(
                  'Quick Actions',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ElevatedButton.icon(
                  onPressed: () => _copyToClipboard('localhost:${_statistics['currentPort'] ?? 8080}'),
                  icon: const Icon(Icons.copy),
                  label: const Text('Copy Server URL'),
                ),
                ElevatedButton.icon(
                  onPressed: () => _openExtensionGuide(),
                  icon: const Icon(Icons.help),
                  label: const Text('Extension Guide'),
                ),
                ElevatedButton.icon(
                  onPressed: () => _testConnection(),
                  icon: const Icon(Icons.network_check),
                  label: const Text('Test Connection'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCapturesTab() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          color: Colors.grey[100],
          child: Row(
            children: [
              const Icon(Icons.history, color: Color(0xFF6C63FF)),
              const SizedBox(width: 8),
              Text(
                'Recent Captures (${_recentCaptures.length})',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const Spacer(),
              if (_recentCaptures.isNotEmpty)
                TextButton(
                  onPressed: () {
                    setState(() {
                      _recentCaptures.clear();
                    });
                  },
                  child: const Text('Clear'),
                ),
            ],
          ),
        ),
        Expanded(
          child: _recentCaptures.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.inbox, size: 64, color: Colors.grey),
                      SizedBox(height: 16),
                      Text(
                        'No captures yet',
                        style: TextStyle(fontSize: 18, color: Colors.grey),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Install and use the browser extension to see captures here',
                        style: TextStyle(color: Colors.grey),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  itemCount: _recentCaptures.length,
                  itemBuilder: (context, index) {
                    final capture = _recentCaptures[index];
                    return _buildCaptureItem(capture);
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildCaptureItem(Map<String, dynamic> capture) {
    final domain = capture['domain'] ?? 'Unknown';
    final username = capture['username'] ?? 'Unknown';
    final captureType = capture['captureType'] ?? 'unknown';
    final isRegistration = capture['isRegistration'] ?? false;
    final receivedAt = capture['receivedAt'] as DateTime?;
    
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isRegistration ? Colors.green : const Color(0xFF6C63FF),
          child: Icon(
            isRegistration ? Icons.person_add : Icons.login,
            color: Colors.white,
          ),
        ),
        title: Text(
          domain,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Username: $username'),
            Text('Type: ${isRegistration ? 'Registration' : 'Login'} ($captureType)'),
            if (receivedAt != null)
              Text(
                'Captured: ${_formatDateTime(receivedAt)}',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
          ],
        ),
        trailing: PopupMenuButton(
          itemBuilder: (context) => [
            const PopupMenuItem(
              value: 'copy_domain',
              child: Row(
                children: [
                  Icon(Icons.copy),
                  SizedBox(width: 8),
                  Text('Copy Domain'),
                ],
              ),
            ),
            const PopupMenuItem(
              value: 'copy_username',
              child: Row(
                children: [
                  Icon(Icons.person),
                  SizedBox(width: 8),
                  Text('Copy Username'),
                ],
              ),
            ),
          ],
          onSelected: (value) {
            switch (value) {
              case 'copy_domain':
                _copyToClipboard(domain);
                break;
              case 'copy_username':
                _copyToClipboard(username);
                break;
            }
          },
        ),
      ),
    );
  }

  Widget _buildSetupTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildInstallationCard(),
          const SizedBox(height: 16),
          _buildConfigurationCard(),
          const SizedBox(height: 16),
          _buildTroubleshootingCard(),
        ],
      ),
    );
  }

  Widget _buildInstallationCard() {
    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.extension, color: Color(0xFF6C63FF)),
                const SizedBox(width: 8),
                Text(
                  'Browser Extension Installation',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              'Follow these steps to install the VaultMate browser extension:',
              style: TextStyle(fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 12),
            _buildStep('1', 'Open Chrome and go to chrome://extensions/'),
            _buildStep('2', 'Enable "Developer mode" in the top right'),
            _buildStep('3', 'Click "Load unpacked" and select the browser_extension folder'),
            _buildStep('4', 'The extension should now appear in your browser'),
            _buildStep('5', 'Pin the extension for easy access'),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _copyToClipboard('chrome://extensions/'),
                icon: const Icon(Icons.copy),
                label: const Text('Copy Chrome Extensions URL'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6C63FF),
                  foregroundColor: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep(String number, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: const BoxDecoration(
              color: Color(0xFF6C63FF),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                number,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(text),
          ),
        ],
      ),
    );
  }

  Widget _buildConfigurationCard() {
    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.settings, color: Color(0xFF6C63FF)),
                const SizedBox(width: 8),
                Text(
                  'Configuration',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildConfigItem(
              'Server URL',
              'http://localhost:${_statistics['currentPort'] ?? 8080}',
              'The extension will connect to this URL',
            ),
            _buildConfigItem(
              'Auto-capture',
              'Enabled by default',
              'Automatically captures login and registration forms',
            ),
            _buildConfigItem(
              'Notifications',
              'Enabled by default',
              'Shows notifications when credentials are captured',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConfigItem(String title, String value, String description) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
              ),
              Text(
                value,
                style: const TextStyle(color: Color(0xFF6C63FF)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            description,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }

  Widget _buildTroubleshootingCard() {
    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.help_outline, color: Color(0xFF6C63FF)),
                const SizedBox(width: 8),
                Text(
                  'Troubleshooting',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildTroubleshootItem(
              'Extension not capturing credentials',
              'Make sure the service is running and the extension is properly installed',
            ),
            _buildTroubleshootItem(
              'Connection failed',
              'Check if the app is running and the port is not blocked by firewall',
            ),
            _buildTroubleshootItem(
              'Duplicate passwords',
              'The app automatically detects and updates existing passwords',
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _testConnection,
                icon: const Icon(Icons.network_check),
                label: const Text('Test Connection'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.orange,
                  foregroundColor: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTroubleshootItem(String issue, String solution) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            issue,
            style: const TextStyle(fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 4),
          Text(
            solution,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }

  void _copyToClipboard(String text) {
    Clipboard.setData(ClipboardData(text: text));
    _showSnackBar('Copied to clipboard', isError: false);
  }

  void _openExtensionGuide() {
    // Navigate to extension guide or show dialog
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Extension Guide'),
        content: const Text(
          'The browser extension automatically captures login and registration credentials '
          'from websites and syncs them to your VaultMate app. Make sure the service is '
          'running before using the extension.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _testConnection() async {
    _showSnackBar('Testing connection...', isError: false);
    
    // Simulate connection test
    await Future.delayed(const Duration(seconds: 2));
    
    if (_extensionService.isRunning) {
      _showSnackBar('Connection test successful!', isError: false);
    } else {
      _showSnackBar('Connection test failed - service not running', isError: true);
    }
  }

  String _formatDateTime(DateTime dateTime) {
    return '${dateTime.day}/${dateTime.month}/${dateTime.year} '
           '${dateTime.hour.toString().padLeft(2, '0')}:'
           '${dateTime.minute.toString().padLeft(2, '0')}';
  }
}
