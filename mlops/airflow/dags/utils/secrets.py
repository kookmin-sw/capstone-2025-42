import os


def load_secret(name):
    path = f"/run/secrets/{name}"
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    else:
        raise FileNotFoundError(f"Secret {name} not found at {path}")
