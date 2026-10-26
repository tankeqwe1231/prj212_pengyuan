# -*- coding: utf-8 -*-
"""可独立复制到父项目的 AES-GCM 工具

AES_KEY 支持 16/24/32 字节的 bytes，或这些字节的标准 Base64 字符串。
密文格式：v1.<URL-safe Base64(nonce[12] + tag[16] + ciphertext)>。
每次加密生成新 nonce，不需要 AES_IV，也不兼容旧 AES-CBC 密文。
"""

import base64
import binascii
import re

from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes


class AESConfigurationError(ValueError):
    """AES 密钥未配置或格式不正确。"""


class InvalidCiphertextError(ValueError):
    """密文格式、认证标签或明文编码无效。"""


_VERSION = 'v1'
_AAD = b'iframe-token:v1'
_NONCE_SIZE = 12
_TAG_SIZE = 16


def _get_aes_key(config):
    key = config.get('AES_KEY')
    if isinstance(key, str):
        try:
            key = base64.b64decode(key, validate=True)
        except (ValueError, binascii.Error):
            raise AESConfigurationError('AES_KEY 必须是有效的 Base64 密钥') from None
    if not isinstance(key, bytes) or len(key) not in (16, 24, 32):
        raise AESConfigurationError('AES_KEY 解码后必须为 16、24 或 32 字节')
    return key


def aes_encrypt_gcm(plain_text, config):
    """使用随机 nonce 加密 UTF-8 字符串，并返回可放入 URL 的密文。"""
    key = _get_aes_key(config)
    if not isinstance(plain_text, str):
        raise TypeError('plain_text 必须是字符串')
    nonce = get_random_bytes(_NONCE_SIZE)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce, mac_len=_TAG_SIZE)
    cipher.update(_AAD)
    ciphertext, tag = cipher.encrypt_and_digest(plain_text.encode('utf-8'))
    encoded = base64.urlsafe_b64encode(nonce + tag + ciphertext).decode('ascii')
    return _VERSION + '.' + encoded.rstrip('=')


def aes_decrypt_gcm(cipher_text, config):
    """校验 GCM 认证标签后返回明文；任何无效密文均拒绝。"""
    key = _get_aes_key(config)
    if not isinstance(cipher_text, str) or not cipher_text.startswith(_VERSION + '.'):
        raise InvalidCiphertextError('访问凭证无效')
    encoded = cipher_text[len(_VERSION) + 1:]
    if not re.fullmatch(r'[A-Za-z0-9_-]+', encoded):
        raise InvalidCiphertextError('访问凭证无效')
    try:
        data = base64.b64decode(encoded + '=' * (-len(encoded) % 4),
                                altchars=b'-_', validate=True)
        # 拒绝同一组字节的非规范 Base64 表示。
        if base64.urlsafe_b64encode(data).decode('ascii').rstrip('=') != encoded:
            raise ValueError('无效编码')
        if len(data) < _NONCE_SIZE + _TAG_SIZE:
            raise ValueError('密文过短')
        nonce = data[:_NONCE_SIZE]
        tag = data[_NONCE_SIZE:_NONCE_SIZE + _TAG_SIZE]
        ciphertext = data[_NONCE_SIZE + _TAG_SIZE:]
        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce, mac_len=_TAG_SIZE)
        cipher.update(_AAD)
        return cipher.decrypt_and_verify(ciphertext, tag).decode('utf-8')
    except (ValueError, UnicodeError, binascii.Error):
        raise InvalidCiphertextError('访问凭证无效') from None
