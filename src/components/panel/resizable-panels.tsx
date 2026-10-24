"use client";

import { useState, useRef, useEffect, MouseEvent } from "react";

interface ResizablePanelsProps {
    left: React.ReactNode;
    center: React.ReactNode;
    right: React.ReactNode;
    defaultLeftWidth?: number;
    defaultRightWidth?: number;
    minWidth?: number;
}

export function ResizablePanels({
    left,
    center,
    right,
    defaultLeftWidth = 20,
    defaultRightWidth = 25,
    minWidth = 15,
}: ResizablePanelsProps) {
    const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
    const [rightWidth, setRightWidth] = useState(defaultRightWidth);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingLeft = useRef(false);
    const isDraggingRight = useRef(false);

    useEffect(() => {
        const savedLeft = localStorage.getItem("panel_left_width");
        const savedRight = localStorage.getItem("panel_right_width");

        if (savedLeft) setLeftWidth(Number(savedLeft));
        if (savedRight) setRightWidth(Number(savedRight));
    }, []);

    const handleMouseDown = (divider: "left" | "right") => (e: MouseEvent) => {
        e.preventDefault();
        if (divider === "left") {
            isDraggingLeft.current = true;
        } else {
            isDraggingRight.current = true;
        }
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    };

    useEffect(() => {
        const handleMouseMove = (e: globalThis.MouseEvent) => {
            if (!containerRef.current) return;

            const containerWidth = containerRef.current.offsetWidth;
            const mouseX = e.clientX - containerRef.current.getBoundingClientRect().left;
            const newPercentage = (mouseX / containerWidth) * 100;

            if (isDraggingLeft.current) {
                const clamped = Math.max(minWidth, Math.min(40, newPercentage));
                setLeftWidth(clamped);
                localStorage.setItem("panel_left_width", String(clamped));
            } else if (isDraggingRight.current) {
                const rightPercentage = 100 - newPercentage;
                const clamped = Math.max(minWidth, Math.min(45, rightPercentage));
                setRightWidth(clamped);
                localStorage.setItem("panel_right_width", String(clamped));
            }
        };

        const handleMouseUp = () => {
            isDraggingLeft.current = false;
            isDraggingRight.current = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [minWidth]);

    const centerWidth = 100 - leftWidth - rightWidth;

    return (
        <div ref={containerRef} className="flex h-full w-full relative">
            {/* Left Panel */}
            <div style={{ width: `${leftWidth}%` }} className="flex-shrink-0 overflow-auto">
                {left}
            </div>

            {/* Left Divider */}
            <div
                onMouseDown={handleMouseDown("left")}
                className="w-1 bg-slate-200 hover:bg-sky-400 cursor-col-resize flex-shrink-0 transition-colors group relative"
            >
                <div className="absolute inset-y-0 -left-1 -right-1" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-12 bg-slate-400 group-hover:bg-sky-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Center Panel */}
            <div style={{ width: `${centerWidth}%` }} className="flex-shrink-0 overflow-auto">
                {center}
            </div>

            {/* Right Divider */}
            <div
                onMouseDown={handleMouseDown("right")}
                className="w-1 bg-slate-200 hover:bg-sky-400 cursor-col-resize flex-shrink-0 transition-colors group relative"
            >
                <div className="absolute inset-y-0 -left-1 -right-1" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-12 bg-slate-400 group-hover:bg-sky-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Right Panel */}
            <div style={{ width: `${rightWidth}%` }} className="flex-shrink-0 overflow-auto">
                {right}
            </div>
        </div>
    );
}
