import os
from utils.get_env import get_app_data_directory_env


def get_images_directory():
    images_directory = os.path.join(get_app_data_directory_env(), "images")
    os.makedirs(images_directory, exist_ok=True)
    return images_directory


def get_exports_directory():
    export_directory = os.path.join(get_app_data_directory_env(), "exports")
    os.makedirs(export_directory, exist_ok=True)
    return export_directory

def get_uploads_directory():
    uploads_directory = os.path.join(get_app_data_directory_env(), "uploads")
    os.makedirs(uploads_directory, exist_ok=True)
    return uploads_directory


def get_logs_directory():
    logs_directory = os.path.join(get_app_data_directory_env(), "logs")
    os.makedirs(logs_directory, exist_ok=True)
    return logs_directory


def get_image_generation_logs_directory():
    image_gen_logs_directory = os.path.join(get_logs_directory(), "image_generation")
    os.makedirs(image_gen_logs_directory, exist_ok=True)
    return image_gen_logs_directory
