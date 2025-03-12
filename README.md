# GUI - SMU: KEITHLEY 2401

Interface do obsługi, odczytu oraz zapisu pomiarów z jednostki SMU.

## Narzędzia deweloperskie / technologie

**Narzędzia potrzebe do rozwijania frontendu:**
- Dla uproszczenia pracy, dobrze korzystać z terminala **Git Bash**, <ins>zamiast powershella<ins/>
- [NodeJS](https://nodejs.org/en)
    - dobrze pobrać też narzędzie [npm-run-all](https://www.npmjs.com/package/npm-run-all)
- [TypeScript](https://www.npmjs.com/package/typescript)
- electron-builder
```
npm i --save-dev electron-builder
```

**Technologie:**
- Electron
- Vite
- React

## Praca przy aplikacji

1. **Build**
```
npm run build
```
2. **Otworzenie aplikacji w trybie deweloperskim** (skonfigurowany jest local server Vite, więc zmiany wprowadzane w projekcie widoczne są od razu w trybie deweloperskim, bez konieczności odświeżania)
```
npm run dev
```
3. **Budowanie gotowej aplikacji** (na windowsie potrzebne będzie otworzenie Git Basha, lub w przypadku korzystania z konsoli w edytorze, np. VS Code samego edytora, w trybie administratora)
- Dla Windowsa
```
npm run dist:win
```
- Dla Mac
```
npm run dist:mac
```
- Dla Linuxa
```
npm run dist:linux
```