import subprocess
import sys

def install(package, index_url=None):
    command = [sys.executable, "-m", "pip", "install", package]
    if index_url:
        command.extend(["--index-url", index_url])
    subprocess.check_call(command)

packages = ["torch", "torchvision", "torchaudio", "Flask", "Flask-Cors", "Pillow", "open-clip-torch", "requests"]

for pkg in packages:
    try:
        if pkg in ["torch", "torchvision", "torchaudio"]:
            install(pkg, "https://download.pytorch.org/whl/cpu")
        else:
            install(pkg)
    except Exception as e:
        print(f"Failed to install {pkg}: {e}")
