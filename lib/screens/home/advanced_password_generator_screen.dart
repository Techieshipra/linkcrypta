import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/advanced_password_generator.dart';

class AdvancedPasswordGeneratorScreen extends StatefulWidget {
  const AdvancedPasswordGeneratorScreen({super.key});

  @override
  State<AdvancedPasswordGeneratorScreen> createState() => _AdvancedPasswordGeneratorScreenState();
}

class _AdvancedPasswordGeneratorScreenState extends State<AdvancedPasswordGeneratorScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  
  // Current options
  PasswordGenerationOptions _options = PasswordGenerationOptions();
  List<GeneratedPassword> _generatedPasswords = [];
  
  // Controllers
  final _lengthController = TextEditingController(text: '16');
  final _wordCountController = TextEditingController(text: '4');
  final _separatorController = TextEditingController(text: '-');
  final _patternController = TextEditingController();
  final _bulkCountController = TextEditingController(text: '10');

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _generatePassword();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _lengthController.dispose();
    _wordCountController.dispose();
    _separatorController.dispose();
    _patternController.dispose();
    _bulkCountController.dispose();
    super.dispose();
  }

  void _generatePassword() {
    setState(() {
      final password = AdvancedPasswordGenerator.generatePassword(_options);
      _generatedPasswords = [password];
    });
  }

  void _generateBulkPasswords() {
    final count = int.tryParse(_bulkCountController.text) ?? 10;
    setState(() {
      _generatedPasswords = AdvancedPasswordGenerator.generateBulkPasswords(_options, count);
    });
  }

  void _updateOptions() {
    setState(() {
      _options = PasswordGenerationOptions(
        type: _getSelectedType(),
        length: int.tryParse(_lengthController.text) ?? 16,
        includeUppercase: _options.includeUppercase,
        includeLowercase: _options.includeLowercase,
        includeNumbers: _options.includeNumbers,
        includeSymbols: _options.includeSymbols,
        excludeSimilar: _options.excludeSimilar,
        excludeAmbiguous: _options.excludeAmbiguous,
        customPattern: _patternController.text,
        wordCount: int.tryParse(_wordCountController.text) ?? 4,
        wordSeparator: _separatorController.text,
        capitalizeWords: _options.capitalizeWords,
        includeNumbers2: _options.includeNumbers2,
      );
    });
    _generatePassword();
  }

  PasswordType _getSelectedType() {
    switch (_tabController.index) {
      case 0: return PasswordType.random;
      case 1: return PasswordType.passphrase;
      case 2: return PasswordType.pattern;
      default: return PasswordType.random;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Advanced Password Generator'),
        bottom: TabBar(
          controller: _tabController,
          onTap: (_) => _updateOptions(),
          tabs: const [
            Tab(text: 'Random', icon: Icon(Icons.shuffle)),
            Tab(text: 'Passphrase', icon: Icon(Icons.text_fields)),
            Tab(text: 'Pattern', icon: Icon(Icons.pattern)),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildRandomTab(),
                _buildPassphraseTab(),
                _buildPatternTab(),
              ],
            ),
          ),
          _buildGeneratedPasswordsSection(),
        ],
      ),
    );
  }

  Widget _buildRandomTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Random Password Settings',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 16),
          _buildLengthSlider(),
          const SizedBox(height: 16),
          _buildCharacterOptions(),
          const SizedBox(height: 16),
          _buildExclusionOptions(),
          const SizedBox(height: 24),
          _buildGenerateButtons(),
        ],
      ),
    );
  }

  Widget _buildPassphraseTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Passphrase Settings',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'Creates memorable passwords using common words',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Word Settings', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _wordCountController,
                    decoration: const InputDecoration(
                      labelText: 'Number of Words',
                      helperText: 'Recommended: 4-6 words',
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (_) => _updateOptions(),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _separatorController,
                    decoration: const InputDecoration(
                      labelText: 'Word Separator',
                      helperText: 'Character between words (e.g., -, _, space)',
                    ),
                    onChanged: (_) => _updateOptions(),
                  ),
                  const SizedBox(height: 16),
                  SwitchListTile(
                    title: const Text('Capitalize Words'),
                    subtitle: const Text('Make first letter of each word uppercase'),
                    value: _options.capitalizeWords,
                    onChanged: (value) {
                      setState(() {
                        _options = PasswordGenerationOptions(
                          type: _options.type,
                          length: _options.length,
                          includeUppercase: _options.includeUppercase,
                          includeLowercase: _options.includeLowercase,
                          includeNumbers: _options.includeNumbers,
                          includeSymbols: _options.includeSymbols,
                          excludeSimilar: _options.excludeSimilar,
                          excludeAmbiguous: _options.excludeAmbiguous,
                          customPattern: _options.customPattern,
                          wordCount: _options.wordCount,
                          wordSeparator: _options.wordSeparator,
                          capitalizeWords: value,
                          includeNumbers2: _options.includeNumbers2,
                        );
                      });
                      _generatePassword();
                    },
                  ),
                  SwitchListTile(
                    title: const Text('Add Numbers'),
                    subtitle: const Text('Occasionally add numbers to words'),
                    value: _options.includeNumbers2,
                    onChanged: (value) {
                      setState(() {
                        _options = PasswordGenerationOptions(
                          type: _options.type,
                          length: _options.length,
                          includeUppercase: _options.includeUppercase,
                          includeLowercase: _options.includeLowercase,
                          includeNumbers: _options.includeNumbers,
                          includeSymbols: _options.includeSymbols,
                          excludeSimilar: _options.excludeSimilar,
                          excludeAmbiguous: _options.excludeAmbiguous,
                          customPattern: _options.customPattern,
                          wordCount: _options.wordCount,
                          wordSeparator: _options.wordSeparator,
                          capitalizeWords: _options.capitalizeWords,
                          includeNumbers2: value,
                        );
                      });
                      _generatePassword();
                    },
                  ),
                  SwitchListTile(
                    title: const Text('Add Symbols'),
                    subtitle: const Text('Add symbols at the end'),
                    value: _options.includeSymbols,
                    onChanged: (value) {
                      setState(() {
                        _options = PasswordGenerationOptions(
                          type: _options.type,
                          length: _options.length,
                          includeUppercase: _options.includeUppercase,
                          includeLowercase: _options.includeLowercase,
                          includeNumbers: _options.includeNumbers,
                          includeSymbols: value,
                          excludeSimilar: _options.excludeSimilar,
                          excludeAmbiguous: _options.excludeAmbiguous,
                          customPattern: _options.customPattern,
                          wordCount: _options.wordCount,
                          wordSeparator: _options.wordSeparator,
                          capitalizeWords: _options.capitalizeWords,
                          includeNumbers2: _options.includeNumbers2,
                        );
                      });
                      _generatePassword();
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          _buildGenerateButtons(),
        ],
      ),
    );
  }

  Widget _buildPatternTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Custom Pattern Settings',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'Create passwords using custom patterns',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Pattern Syntax', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text(
                    'l = lowercase, u = UPPERCASE, d = digit, s = symbol, w = word, a = any',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontFamily: 'monospace',
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _patternController,
                    decoration: const InputDecoration(
                      labelText: 'Custom Pattern',
                      hintText: 'e.g., Ulldd-ssss',
                      helperText: 'Enter your custom pattern',
                    ),
                    onChanged: (_) => _updateOptions(),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Predefined Patterns', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  ...AdvancedPasswordGenerator.getPredefinedPatterns().map(
                    (pattern) => ListTile(
                      title: Text(pattern['name']!),
                      subtitle: Text(pattern['pattern']!),
                      trailing: IconButton(
                        icon: const Icon(Icons.copy),
                        onPressed: () {
                          _patternController.text = pattern['pattern']!;
                          _updateOptions();
                        },
                      ),
                      onTap: () {
                        _patternController.text = pattern['pattern']!;
                        _updateOptions();
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          _buildGenerateButtons(),
        ],
      ),
    );
  }

  Widget _buildLengthSlider() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Password Length', style: Theme.of(context).textTheme.titleMedium),
                SizedBox(
                  width: 60,
                  child: TextField(
                    controller: _lengthController,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    onChanged: (_) => _updateOptions(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Slider(
              value: (int.tryParse(_lengthController.text) ?? 16).toDouble(),
              min: 4,
              max: 128,
              divisions: 124,
              onChanged: (value) {
                _lengthController.text = value.toInt().toString();
                _updateOptions();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCharacterOptions() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Character Types', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            SwitchListTile(
              title: const Text('Lowercase (a-z)'),
              value: _options.includeLowercase,
              onChanged: (value) {
                setState(() {
                  _options = PasswordGenerationOptions(
                    type: _options.type,
                    length: _options.length,
                    includeUppercase: _options.includeUppercase,
                    includeLowercase: value,
                    includeNumbers: _options.includeNumbers,
                    includeSymbols: _options.includeSymbols,
                    excludeSimilar: _options.excludeSimilar,
                    excludeAmbiguous: _options.excludeAmbiguous,
                    customPattern: _options.customPattern,
                    wordCount: _options.wordCount,
                    wordSeparator: _options.wordSeparator,
                    capitalizeWords: _options.capitalizeWords,
                    includeNumbers2: _options.includeNumbers2,
                  );
                });
                _generatePassword();
              },
            ),
            SwitchListTile(
              title: const Text('Uppercase (A-Z)'),
              value: _options.includeUppercase,
              onChanged: (value) {
                setState(() {
                  _options = PasswordGenerationOptions(
                    type: _options.type,
                    length: _options.length,
                    includeUppercase: value,
                    includeLowercase: _options.includeLowercase,
                    includeNumbers: _options.includeNumbers,
                    includeSymbols: _options.includeSymbols,
                    excludeSimilar: _options.excludeSimilar,
                    excludeAmbiguous: _options.excludeAmbiguous,
                    customPattern: _options.customPattern,
                    wordCount: _options.wordCount,
                    wordSeparator: _options.wordSeparator,
                    capitalizeWords: _options.capitalizeWords,
                    includeNumbers2: _options.includeNumbers2,
                  );
                });
                _generatePassword();
              },
            ),
            SwitchListTile(
              title: const Text('Numbers (0-9)'),
              value: _options.includeNumbers,
              onChanged: (value) {
                setState(() {
                  _options = PasswordGenerationOptions(
                    type: _options.type,
                    length: _options.length,
                    includeUppercase: _options.includeUppercase,
                    includeLowercase: _options.includeLowercase,
                    includeNumbers: value,
                    includeSymbols: _options.includeSymbols,
                    excludeSimilar: _options.excludeSimilar,
                    excludeAmbiguous: _options.excludeAmbiguous,
                    customPattern: _options.customPattern,
                    wordCount: _options.wordCount,
                    wordSeparator: _options.wordSeparator,
                    capitalizeWords: _options.capitalizeWords,
                    includeNumbers2: _options.includeNumbers2,
                  );
                });
                _generatePassword();
              },
            ),
            SwitchListTile(
              title: const Text('Symbols (!@#\$...)'),
              value: _options.includeSymbols,
              onChanged: (value) {
                setState(() {
                  _options = PasswordGenerationOptions(
                    type: _options.type,
                    length: _options.length,
                    includeUppercase: _options.includeUppercase,
                    includeLowercase: _options.includeLowercase,
                    includeNumbers: _options.includeNumbers,
                    includeSymbols: value,
                    excludeSimilar: _options.excludeSimilar,
                    excludeAmbiguous: _options.excludeAmbiguous,
                    customPattern: _options.customPattern,
                    wordCount: _options.wordCount,
                    wordSeparator: _options.wordSeparator,
                    capitalizeWords: _options.capitalizeWords,
                    includeNumbers2: _options.includeNumbers2,
                  );
                });
                _generatePassword();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExclusionOptions() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Exclusion Options', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            SwitchListTile(
              title: const Text('Exclude Similar Characters'),
              subtitle: const Text('Avoid i, l, 1, L, o, 0, O'),
              value: _options.excludeSimilar,
              onChanged: (value) {
                setState(() {
                  _options = PasswordGenerationOptions(
                    type: _options.type,
                    length: _options.length,
                    includeUppercase: _options.includeUppercase,
                    includeLowercase: _options.includeLowercase,
                    includeNumbers: _options.includeNumbers,
                    includeSymbols: _options.includeSymbols,
                    excludeSimilar: value,
                    excludeAmbiguous: _options.excludeAmbiguous,
                    customPattern: _options.customPattern,
                    wordCount: _options.wordCount,
                    wordSeparator: _options.wordSeparator,
                    capitalizeWords: _options.capitalizeWords,
                    includeNumbers2: _options.includeNumbers2,
                  );
                });
                _generatePassword();
              },
            ),
            SwitchListTile(
              title: const Text('Exclude Ambiguous Characters'),
              subtitle: const Text('Avoid {}, [], (), /, \\, \', ", `, ~, etc.'),
              value: _options.excludeAmbiguous,
              onChanged: (value) {
                setState(() {
                  _options = PasswordGenerationOptions(
                    type: _options.type,
                    length: _options.length,
                    includeUppercase: _options.includeUppercase,
                    includeLowercase: _options.includeLowercase,
                    includeNumbers: _options.includeNumbers,
                    includeSymbols: _options.includeSymbols,
                    excludeSimilar: _options.excludeSimilar,
                    excludeAmbiguous: value,
                    customPattern: _options.customPattern,
                    wordCount: _options.wordCount,
                    wordSeparator: _options.wordSeparator,
                    capitalizeWords: _options.capitalizeWords,
                    includeNumbers2: _options.includeNumbers2,
                  );
                });
                _generatePassword();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGenerateButtons() {
    return Row(
      children: [
        Expanded(
          child: ElevatedButton.icon(
            onPressed: _generatePassword,
            icon: const Icon(Icons.refresh),
            label: const Text('Generate New'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () => _showBulkGenerationDialog(),
            icon: const Icon(Icons.copy_all),
            label: const Text('Bulk Generate'),
          ),
        ),
      ],
    );
  }

  Widget _buildGeneratedPasswordsSection() {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        border: Border(top: BorderSide(color: Colors.grey.shade300)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Generated Passwords',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (_generatedPasswords.length > 1)
                  TextButton.icon(
                    onPressed: _copyAllPasswords,
                    icon: const Icon(Icons.copy_all),
                    label: const Text('Copy All'),
                  ),
              ],
            ),
          ),
          SizedBox(
            height: 200,
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              itemCount: _generatedPasswords.length,
              itemBuilder: (context, index) {
                final password = _generatedPasswords[index];
                return _buildPasswordItem(password);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPasswordItem(GeneratedPassword password) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8.0),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SelectableText(
                    password.password,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      _buildStrengthIndicator(password.strength),
                      const SizedBox(width: 12),
                      Text(
                        'Entropy: ${password.entropy.toStringAsFixed(1)} bits',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () => _copyPassword(password.password),
              icon: const Icon(Icons.copy),
              tooltip: 'Copy password',
            ),
            IconButton(
              onPressed: () => Navigator.of(context).pop(password.password),
              icon: const Icon(Icons.check),
              tooltip: 'Use this password',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStrengthIndicator(int strength) {
    Color color;
    String label;
    
    if (strength >= 80) {
      color = Colors.green;
      label = 'Strong';
    } else if (strength >= 60) {
      color = Colors.orange;
      label = 'Good';
    } else if (strength >= 40) {
      color = Colors.deepOrange;
      label = 'Fair';
    } else {
      color = Colors.red;
      label = 'Weak';
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        '$label ($strength%)',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  void _showBulkGenerationDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Bulk Password Generation'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _bulkCountController,
              decoration: const InputDecoration(
                labelText: 'Number of passwords',
                helperText: 'Generate multiple passwords at once',
              ),
              keyboardType: TextInputType.number,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              _generateBulkPasswords();
            },
            child: const Text('Generate'),
          ),
        ],
      ),
    );
  }

  void _copyPassword(String password) {
    Clipboard.setData(ClipboardData(text: password));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Password copied to clipboard')),
    );
  }

  void _copyAllPasswords() {
    final allPasswords = _generatedPasswords.map((p) => p.password).join('\n');
    Clipboard.setData(ClipboardData(text: allPasswords));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${_generatedPasswords.length} passwords copied to clipboard')),
    );
  }
}
