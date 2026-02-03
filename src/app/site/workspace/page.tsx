"use client";

import { useSidebarState } from "@/hooks/use-sidebar-state";
import { ProjectSidebar } from "@/components/workspace/project-sidebar";
import { WorkspaceCanvas } from "@/components/workspace/workspace-canvas";
import { OrchestratorChat } from "@/components/workspace/orchestrator-chat";

export default function WorkspacePage() {
    const { leftCollapsed, rightCollapsed, toggleLeft, toggleRight } = useSidebarState();

    return (
        <div className="h-screen flex overflow-hidden bg-slate-50">
            {/* Left Sidebar */}
            <ProjectSidebar
                collapsed={leftCollapsed}
                onToggle={toggleLeft}
            />

            {/* Center Canvas */}
            <WorkspaceCanvas />

            {/* Right Chat */}
            <OrchestratorChat
                collapsed={rightCollapsed}
                onToggle={toggleRight}
            />

            {/* Keyboard Shortcuts Hint */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/90 text-white text-xs font-medium rounded-full backdrop-blur-sm hidden lg:block">
                <kbd className="px-2 py-1 bg-slate-700 rounded">Ctrl+B</kbd> Toggle Left •
                <kbd className="px-2 py-1 bg-slate-700 rounded ml-2">Ctrl+E</kbd> Toggle Right •
                <kbd className="px-2 py-1 bg-slate-700 rounded ml-2">Ctrl+K</kbd> Focus Chat
            </div>
        </div>
    );
}
