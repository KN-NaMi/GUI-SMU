# -*- mode: python ; coding: utf-8 -*-

# Ustaw folder wyjściowy
import os
dist_path = os.path.join(os.getcwd(), 'python-win')

a = Analysis(
    ['main.py'],
    pathex=[],  # PyInstaller sam znajdzie ścieżki, zostaw puste
    binaries=[],
    datas=[
        # Jeśli masz jakieś pliki konfiguracyjne lub statyczne, dodaj tutaj
        # np. ('config.json', '.'),
    ],
    hiddenimports=[
        # FastAPI i związane
        'fastapi',
        'starlette',
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        
        # WebSockets
        'websockets',
        'websockets.legacy',
        'websockets.legacy.server',
        
        # Asyncio
        'asyncio',
        
        # PySerial i PyVISA
        'serial',
        'serial.tools',
        'serial.tools.list_ports',
        'pyvisa',
        'pyvisa_py',
        
        # PyMeasure
        'pymeasure',
        'pymeasure.instruments',
        'pymeasure.instruments.keithley',
        'pymeasure.experiment',
        
        # Pydantic
        'pydantic',
        'pydantic_core',
        
        # Numpy i związane
        'numpy',
        'numpy.core._multiarray_umath',
        'numpy.core._multiarray_tests',
        'numpy.random._pickle',
        
        # Pandas i związane
        'pandas',
        'pandas._libs',
        'pandas._libs.tslibs',
        'pandas._libs.tslibs.timedeltas',
        'pandas._libs.tslibs.nattype',
        'pandas._libs.tslibs.timestamps',
        'pandas._libs.tslibs.np_datetime',
        'pandas._libs.hashtable',
        'pandas._libs.properties',
        'pandas._libs.algos',
        'pandas._libs.indexing',
        
        # Matplotlib może też być potrzebny przez PyMeasure
        'matplotlib',
        'matplotlib.pyplot',
        'matplotlib.backends',
        
        # Pillow może być wymagany
        'PIL',
        
        # Twoje moduły
        'Keithley2400_adapter',
        'SMU',
        
        # Dodatkowe które mogą być potrzebne
        'logging.handlers',
        'multiprocessing',
        'concurrent.futures',
        'h11',
        'anyio',
        'sniffio',
        'click',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Wyklucz GUI biblioteki których nie używasz
        'tkinter',
        'PyQt5',
        'PyQt6',
        'PySide2',
        'PySide6',
        
        # Wyklucz niepotrzebne
        'pyqtgraph',   # to jest GUI, nie potrzebne w backendzie
        
        # Inne niepotrzebne
        'notebook',
        'ipython',
        'jupyter',
    ],
    noarchive=False,
    optimize=0,  # Nie optymalizuj bytecode (0 = bez optymalizacji)
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='main',
    debug=False,  # False = normalny tryb, True = więcej informacji debugowania
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,  # Kompresja UPX - zmniejsza rozmiar
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # True = z oknem konsoli
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # Bez ikony
    version=None,
    onefile=True  # Jeden plik exe
)