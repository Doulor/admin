#!/usr/bin/env python3
"""用纯标准库给香港对象存储（Garage S3）上传文件的示例脚本。

凭据只从环境变量读取，脚本里不存任何密钥：
    S3_ENDPOINT       默认 https://cdn.yangtzeu.work
    S3_REGION         默认 garage
    S3_ACCESS_KEY_ID  必填
    S3_SECRET_KEY     必填
    S3_BUCKET         默认 cdn

用法：
    S3_ACCESS_KEY_ID=… S3_SECRET_KEY=… python3 upload_demo.py <本地文件> [远程名] [桶名]

注入方式见 docs/ops/STORAGE-CDN.md「凭据」：用凭据工具把值放进进程环境，不要写进文件或 shell 历史。
"""

import datetime
import hashlib
import hmac
import os
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

ENDPOINT = os.environ.get('S3_ENDPOINT', 'https://cdn.yangtzeu.work')
REGION = os.environ.get('S3_REGION', 'garage')
SERVICE = 's3'
BUCKET = os.environ.get('S3_BUCKET', 'cdn')
KEY_ID = os.environ.get('S3_ACCESS_KEY_ID', '')
SECRET_KEY = os.environ.get('S3_SECRET_KEY', '')
HOST = urlparse(ENDPOINT).netloc


def sign(key, msg):
    return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()


def get_signature_key(key, date_stamp, region_name, service_name):
    k_date = sign(('AWS4' + key).encode('utf-8'), date_stamp)
    k_region = sign(k_date, region_name)
    k_service = sign(k_region, service_name)
    return sign(k_service, 'aws4_request')


def upload_file(local_path, object_name=None, bucket=BUCKET):
    if not KEY_ID or not SECRET_KEY:
        sys.exit('缺少 S3_ACCESS_KEY_ID / S3_SECRET_KEY：从凭据库注入后再运行（脚本不保存密钥）')
    if not object_name:
        object_name = os.path.basename(local_path)

    with open(local_path, 'rb') as handle:
        content = handle.read()

    now = datetime.datetime.now(datetime.timezone.utc)
    amz_date = now.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = now.strftime('%Y%m%d')

    payload_hash = hashlib.sha256(content).hexdigest()
    canonical_uri = f'/{bucket}/{object_name}'
    canonical_headers = f'host:{HOST}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n'
    signed_headers = 'host;x-amz-content-sha256;x-amz-date'

    canonical_request = f'PUT\n{canonical_uri}\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}'
    algorithm = 'AWS4-HMAC-SHA256'
    scope = f'{date_stamp}/{REGION}/{SERVICE}/aws4_request'
    string_to_sign = f'{algorithm}\n{amz_date}\n{scope}\n{hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()}'

    signing_key = get_signature_key(SECRET_KEY, date_stamp, REGION, SERVICE)
    signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()
    auth_header = f'{algorithm} Credential={KEY_ID}/{scope}, SignedHeaders={signed_headers}, Signature={signature}'

    request = urllib.request.Request(f'{ENDPOINT}{canonical_uri}', data=content, method='PUT')
    request.add_header('Host', HOST)
    request.add_header('x-amz-date', amz_date)
    request.add_header('x-amz-content-sha256', payload_hash)
    request.add_header('Authorization', auth_header)

    try:
        with urllib.request.urlopen(request) as response:
            print(f'[SUCCESS] 上传成功：HTTP {response.status}')
            print(f'公网直链：{ENDPOINT}/{bucket}/{object_name}')
    except urllib.error.HTTPError as error:
        print(f'[FAILED] 上传失败：{error.code} {error.reason}')
        print(error.read().decode('utf-8', errors='replace'))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f'用法：python3 {sys.argv[0]} <本地文件> [远程文件名] [桶名]')
        sys.exit(1)
    upload_file(
        sys.argv[1],
        sys.argv[2] if len(sys.argv) > 2 else None,
        sys.argv[3] if len(sys.argv) > 3 else BUCKET,
    )
