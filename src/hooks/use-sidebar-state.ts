"use client";

import { useState, useEffect } from "react";

export function useSidebarState() {
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [rightCollapsed, setRightCollapsed] = useState(false);

    // Load state from localStorage on mount
    useEffect(() => {
        const savedLeft = localStorage.getItem('drako-left-sidebar');
        const savedRight = localStorage.getItem('drako-right-sidebar');

        if (savedLeft === 'collapsed') setLeftCollapsed(true);
        if (savedRight === 'collapsed') setRightCollapsed(true);

        // Auto-collapse right sidebar on tablets/mobile
        const handleResize = () => {
            if (window.innerWidth < 1280) {
                setRightCollapsed(true);
            }
        };

        handleResize(); // Check immediately
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleLeft = () => {
        setLeftCollapsed(prev => {
            const newState = !prev;
            localStorage.setItem('drako-left-sidebar', newState ? 'collapsed' : 'expanded');
            return newState;
        });
    };

    const toggleRight = () => {
        setRightCollapsed(prev => {
            const newState = !prev;
            localStorage.setItem('drako-right-sidebar', newState ? 'collapsed' : 'expanded');
            return newState;
        });
    };

    return {
        leftCollapsed,
        rightCollapsed,
        toggleLeft,
        toggleRight
    };
}
