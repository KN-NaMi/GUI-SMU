export function isDev(): boolean {
    return process.env.NODE_ENV === 'development';
}

export const platformConfig = {
    isWindows: process.platform === 'win32',
    isLinux: process.platform === 'linux',
    isMacOS: process.platform === 'darwin',
    
    getBackendPath(): { dir: string; executable: string } {
        if (this.isWindows) {
            return { dir: 'python-win', executable: 'main.exe' };
        } else if (this.isLinux) {
            return { dir: 'python-linux', executable: 'main.bin' };
        } else if (this.isMacOS) {
            return { dir: 'python-mac', executable: 'main' };
        }
        return { dir: 'python-linux', executable: 'main.bin' };
    },
    
    filterSerialPorts(ports: any[]): any[] {
        return ports.filter(port => {
            if (this.isWindows) {
                return port.path.match(/^COM\d+$/);
            } else if (this.isLinux) {
                // Tylko USB/ACM porty, nie puste ttyS*
                return port.path.match(/^\/dev\/(ttyUSB|ttyACM)\d+$/);
            } else if (this.isMacOS) {
                return port.path.match(/^\/dev\/(tty\.usbserial|cu\.usbserial|tty\.usbmodem|cu\.usbmodem)/);
            }
            return true;
        });
    },
    
    formatPortDisplay(portPath: string): string {
        if (this.isWindows) {
            return portPath; // COM1 zostaje COM1
        } else if (this.isLinux) {
            const usbMatch = portPath.match(/\/dev\/ttyUSB(\d+)/);
            if (usbMatch) return `USB${usbMatch[1]}`;
            
            const acmMatch = portPath.match(/\/dev\/ttyACM(\d+)/);
            if (acmMatch) return `ACM${acmMatch[1]}`;
        }
        return portPath;
    }
};