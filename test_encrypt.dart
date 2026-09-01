import 'dart:convert';
import 'dart:typed_data';
import 'package:cryptography/cryptography.dart';
import 'package:encrypt/encrypt.dart' as encrypt_pkg;

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
  
  final key = encrypt_pkg.Key(Uint8List.fromList(keyBytes));
  final nonceBytes = Uint8List.fromList(List<int>.filled(12, 1));
  final iv = encrypt_pkg.IV(nonceBytes);
  
  final encrypter = encrypt_pkg.Encrypter(encrypt_pkg.AES(key, mode: encrypt_pkg.AESMode.gcm));
  final encrypted = encrypter.encrypt('{"check":"VALID"}', iv: iv);
  
  print('n: ${base64Encode(nonceBytes)}');
  print('c: ${base64Encode(encrypted.bytes)}');
}
