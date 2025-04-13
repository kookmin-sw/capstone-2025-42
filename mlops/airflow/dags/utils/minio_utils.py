import os
import json
from urllib.parse import unquote_plus


def download_meta_and_file(client, bucket, meta_key):
    meta_key = unquote_plus(meta_key)
    local_folder = "/opt/airflow/files"
    os.makedirs(local_folder, exist_ok=True)
    meta_local_path = os.path.join(local_folder, os.path.basename(meta_key))

    client.fget_object(bucket, meta_key, meta_local_path)

    with open(meta_local_path) as f:
        meta = json.load(f)

    file_name_list = meta["file_name"].rsplit(".", 1)
    original_file_key = f"{file_name_list[0]}_{meta['uuid']}.{file_name_list[-1]}"
    file_local_path = os.path.join(local_folder, os.path.basename(original_file_key))

    client.fget_object(bucket, original_file_key, file_local_path)

    return meta_local_path, file_local_path
