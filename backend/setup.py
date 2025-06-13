import subprocess
import sys
import os

def install_requirements():
    requirements = [
        'fastapi',
        'uvicorn',
        'pymeasure',
        'numpy',
        'pydantic'
    ]
    
    for package in requirements:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])

if __name__ == '__main__':
    install_requirements() 