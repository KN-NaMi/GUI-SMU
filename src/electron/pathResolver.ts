import path from 'path';
import {app} from 'electron';
import { isDev } from './util.js';

export function getPreloadPath() {
    // Avoid path segments starting with "/" — on Windows, path.join treats
    // "\dist-electron\..." as drive-root-relative and breaks packaged apps.
    if (isDev()) {
        return path.join(app.getAppPath(), 'dist-electron', 'preload.cjs');
    }
    return path.join(app.getAppPath(), '..', 'dist-electron', 'preload.cjs');
}