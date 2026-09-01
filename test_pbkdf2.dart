import 'dart:convert';
import 'dart:typed_data';
import 'package:cryptography/cryptography.dart';

void main() async {
  final pbkdf2 = Pbkdf2(
    macAlgorithm: Hmac.sha256(),
    iterations: 210000,
    bits: 256,
  );
  
  final salt = utf8.encode("salt1234salt1234");
  final secretKey = await pbkdf2.deriveKeyFromPassword(
    password: "password123",
    nonce: salt,
  );
  
  final keyBytes = await secretKey.extractBytes();
  print(base64Encode(keyBytes));
}
