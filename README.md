# GUI - SMU: KEITHLEY 2401  

An interface for operating, reading, and recording measurements from the SMU unit.  

![taskbar-alpha1 1](https://github.com/user-attachments/assets/b8776dc2-0aab-4577-833c-a7bc6a52d970)  

## Development Tools / Technologies  

**Tools required for frontend development:**  
- For ease of use, it's recommended to use **Git Bash** <ins>instead of PowerShell<ins/>  
- [NodeJS](https://nodejs.org/en)  
    - It is also recommended to install [npm-run-all](https://www.npmjs.com/package/npm-run-all)  
- [TypeScript](https://www.npmjs.com/package/typescript)  
- electron-builder  
```
npm i --save-dev electron-builder
```

**Technologies:**  
- Electron  
- Vite  
- React  

## Working on the Application  

1. **Build**  
```
npm run build
```
2. **Running the application in developer mode** (A Vite local server is configured, so changes made to the project are immediately visible in developer mode without the need for refreshing)  
```
npm run dev
```
3. **Building the final application** (On Windows, you may need to open Git Bash or, if using a console within an editor such as VS Code, run the editor in administrator mode)  
- For Windows  
```
npm run dist:win
```
- For Mac  
```
npm run dist:mac
```
- For Linux  
```
npm run dist:linux
```