import { useState, useEffect } from "react";

export const useScale = () => {

    const [scale, setScale] = useState(1);

    const baseWidth = 1920;

        const updateScale = () => {
            
            const availableWidth = window.innerWidth;

            const newScale = Math.max(availableWidth/baseWidth, 0.5);
            setScale(newScale);
        };

        useEffect(() => {
            window.addEventListener('resize', updateScale);
            updateScale();
            return () => window.removeEventListener('resize', updateScale);
        }, []);

    return scale;
};