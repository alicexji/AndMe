import hashlib
from pathlib import Path

class LocalMediaStore:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def put(self, key: str, content: bytes) -> tuple[str, int, str]:
        safe_key = key.replace("..", "_").replace("\\", "/")
        destination = self.root / safe_key
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
        return safe_key, len(content), hashlib.sha256(content).hexdigest()
